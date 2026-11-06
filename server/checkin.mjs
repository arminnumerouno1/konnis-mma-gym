import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { collectCheckinCodes, ensureCheckinCode, isValidCheckinCode, normalizeCheckinCode } from './checkin-code.mjs'
import { currentSlot, findTrialSlot, todaySlots } from './kursplan.mjs'
import { createMemberStore } from './member-store.mjs'
import { isoDate, openDuesOf } from './member-model.mjs'
import { berlinIsoDate } from './opening.mjs'
import { createTrialStore } from './trial.mjs'

const FILE_NAME = 'checkins.json'
const BLOB_PATH = 'konni/checkins.json'
const MAX_BODY = 4096
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 20
const hits = new Map()

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function normalize(raw) {
  return { version: 1, entries: Array.isArray(raw?.entries) ? raw.entries : [] }
}

export function createCheckinStore({ dataDir, env = process.env }) {
  const file = join(dataDir, FILE_NAME)
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() || ''
  let chain = Promise.resolve()

  async function loadUnlocked() {
    if (token) {
      const { get } = await import('@vercel/blob')
      const res = await get(BLOB_PATH, { access: 'private', token, useCache: false })
      if (res && res.statusCode === 200 && res.stream) {
        return normalize(JSON.parse(await new Response(res.stream).text()))
      }
    }
    return normalize(await readJsonFile(file))
  }

  async function saveUnlocked(db) {
    const payload = { version: 1, entries: db.entries }
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
    if (token) {
      const { put } = await import('@vercel/blob')
      await put(BLOB_PATH, JSON.stringify(payload), {
        access: 'private',
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
    }
  }

  function withLock(fn) {
    const run = chain.then(fn, fn)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    load: () => withLock(loadUnlocked),
    update: (mutator) =>
      withLock(async () => {
        const db = await loadUnlocked()
        const next = (await mutator(db)) ?? db
        await saveUnlocked(next)
        return next
      }),
  }
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  if (req.body != null && !Buffer.isBuffer(req.body)) {
    if (typeof req.body === 'object') return req.body
    if (typeof req.body === 'string') return req.body.trim() ? JSON.parse(req.body) : {}
  }
  return await new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too_large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

function activeMember(row) {
  return row && row.status !== 'cancelled' && row.status !== 'withdrawn' && row.status !== 'expired'
}

export function sortCheckins(entries) {
  return [...entries].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
}

export function checkinsForDay(entries, day) {
  const wanted = String(day || '').slice(0, 10)
  return sortCheckins(entries.filter((row) => String(row.at || '').slice(0, 10) === wanted || row.day === wanted))
}

/** Slow Start: 2 Trainingstage pro Kalenderwoche. Andere Tarife unbegrenzt. */
export function weeklyVisitLimitForPlan(plan) {
  return plan === 'slowstart' ? 2 : null
}

function addCalendarDays(isoDay, delta) {
  const [year, month, day] = String(isoDay)
    .slice(0, 10)
    .split('-')
    .map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0))
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`
}

/** Monday–Sunday week in Europe/Berlin for the given instant. */
export function berlinWeekRange(now = new Date()) {
  const day = berlinIsoDate(now)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  }).format(now)
  const offset = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[weekday] ?? 0
  const start = addCalendarDays(day, -offset)
  return { start, end: addCalendarDays(start, 6) }
}

export function uniqueCheckinDaysForMember(entries, memberId, { start, end }) {
  const days = new Set()
  const wanted = String(memberId || '')
  if (!wanted) return days
  for (const row of entries || []) {
    if (String(row.memberId || '') !== wanted) continue
    const day = String(row.day || row.at || '').slice(0, 10)
    if (day >= start && day <= end) days.add(day)
  }
  return days
}

export function countUniqueCheckinDays(entries, memberId, week) {
  return uniqueCheckinDaysForMember(entries, memberId, week).size
}

function memberPerson(member, today) {
  const dues = openDuesOf(member, today)
  return {
    kind: 'member',
    memberId: member.id,
    trialId: null,
    name: `${member.firstName} ${member.lastName}`.trim(),
    email: member.email,
    plan: member.plan || null,
    openDues: dues.openAmount,
    openCount: dues.openCount,
    hasPhoto: Boolean(member.photoData || member.hasPhoto),
  }
}

export async function performCheckin(
  { members, trials, checkins },
  { code, slotId, now = new Date(), manual = false, memberId = null, trialId = null },
) {
  const today = berlinIsoDate(now)
  let slot = slotId ? findTrialSlot(slotId) : currentSlot(now)
  if (!slot) return { ok: false, error: 'slot' }

  let person = null
  if (manual && memberId) {
    const member = (members || []).find((row) => row.id === memberId)
    if (!member || !activeMember(member)) return { ok: false, error: 'missing' }
    person = memberPerson(member, isoDate(now))
  } else if (manual && trialId) {
    const trial = (trials || []).find((row) => row.id === trialId)
    if (!trial) return { ok: false, error: 'missing' }
    person = {
      kind: 'trial',
      memberId: null,
      trialId: trial.id,
      name: trial.name,
      email: trial.email,
      plan: null,
      openDues: 0,
      openCount: 0,
      hasPhoto: false,
    }
  } else {
    const normalized = normalizeCheckinCode(code)
    if (!isValidCheckinCode(normalized)) return { ok: false, error: 'code' }
    // Temporary desk test code for Armin — remove after door test.
    if (normalized === '123456') {
      person = {
        kind: 'member',
        memberId: 'test-123456',
        trialId: null,
        name: 'Armin Test',
        email: null,
        plan: null,
        openDues: 0,
        openCount: 0,
        hasPhoto: false,
      }
    } else {
      const member = (members || []).find(
        (row) => activeMember(row) && normalizeCheckinCode(row.checkinCode) === normalized,
      )
      if (member) {
        person = memberPerson(member, isoDate(now))
      } else {
        const trial = (trials || []).find(
          (row) =>
            normalizeCheckinCode(row.checkinCode) === normalized &&
            (row.status === 'bestaetigt' || row.status === 'gekommen' || row.status === 'neu'),
        )
        if (!trial) return { ok: false, error: 'code' }
        person = {
          kind: 'trial',
          memberId: null,
          trialId: trial.id,
          name: trial.name,
          email: trial.email,
          plan: null,
          openDues: 0,
          openCount: 0,
          hasPhoto: false,
        }
      }
    }
  }

  const existing = (checkins || []).find(
    (row) =>
      row.slotId === slot.id &&
      row.day === today &&
      ((person.memberId && row.memberId === person.memberId) || (person.trialId && row.trialId === person.trialId)),
  )
  if (existing) {
    return { ok: true, already: true, entry: existing, slot }
  }

  if (!manual && person.kind === 'member' && person.memberId) {
    const limit = weeklyVisitLimitForPlan(person.plan)
    if (limit != null) {
      const week = berlinWeekRange(now)
      const days = uniqueCheckinDaysForMember(checkins, person.memberId, week)
      if (!days.has(today) && days.size >= limit) {
        return { ok: false, error: 'limit', used: days.size, limit }
      }
    }
  }

  const entry = {
    id: randomUUID(),
    at: now.toISOString(),
    day: today,
    slotId: slot.id,
    slotLabel: slot.label,
    slot: {
      id: slot.id,
      dayId: slot.dayId,
      dayLabel: slot.dayLabel,
      time: slot.time,
      title: slot.title,
      label: slot.label,
    },
    kind: person.kind,
    memberId: person.memberId,
    trialId: person.trialId,
    name: person.name,
    email: person.email,
    plan: person.plan || null,
    openDues: person.openDues,
    openCount: person.openCount,
    hasPhoto: person.hasPhoto,
    source: manual ? 'desk' : 'door',
  }
  return { ok: true, already: false, entry, slot }
}

export function createCheckinHandler({ dataDir, env }) {
  const checkins = createCheckinStore({ dataDir, env })
  const members = createMemberStore({ dataDir, env })
  const trials = createTrialStore({ dataDir, env })

  return async function handleCheckin(req, res) {
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.setHeader('allow', 'GET, POST, OPTIONS')
        res.end()
        return
      }

      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://localhost')
        const now = new Date()
        const slot = currentSlot(now)
        json(res, 200, {
          ok: true,
          slot,
          todaySlots: todaySlots(now),
          day: berlinIsoDate(now),
        })
        return
      }

      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method' })
        return
      }
      if (rateLimited(clientIp(req))) {
        json(res, 429, { ok: false, error: 'rate' })
        return
      }

      let body
      try {
        body = await readBody(req)
      } catch {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }
      if (typeof body.company === 'string' && body.company.trim()) {
        json(res, 200, { ok: true, already: false })
        return
      }

      const memberDb = await members.load()
      const trialDb = await trials.load()
      const result = await performCheckin(
        { members: memberDb.members, trials: trialDb.entries, checkins: (await checkins.load()).entries },
        { code: body.code, slotId: body.slotId },
      )
      if (!result.ok) {
        json(res, 400, {
          ok: false,
          error: result.error,
          ...(result.used != null ? { used: result.used } : {}),
          ...(result.limit != null ? { limit: result.limit } : {}),
        })
        return
      }
      if (result.already) {
        json(res, 200, { ok: true, already: true, slot: result.slot, name: result.entry.name })
        return
      }

      await checkins.update((db) => {
        db.entries.push(result.entry)
        return db
      })
      json(res, 200, {
        ok: true,
        already: false,
        slot: result.slot,
        name: result.entry.name,
      })
    } catch (error) {
      console.error('[checkin]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}

export { ensureCheckinCode, collectCheckinCodes, normalizeCheckinCode, isValidCheckinCode, generateCheckinCode } from './checkin-code.mjs'
