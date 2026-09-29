import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isValidEmail, isValidPhone, normalizeEmail } from './membership.mjs'

export const PREREG_SPORTS = ['MMA', 'BOXEN', 'RINGEN', 'BJJ', 'K1', 'FITNESS BOXEN', 'SONSTIGES']
export const PREREG_SOURCES = ['Instagram', 'Freunde und Bekannte', 'Tiktok', 'Google', 'Sonstiges']
export const PREREG_OFFER = ['ja', 'nein', 'vielleicht']
export const PREREG_STATUS = ['neu', 'kontaktiert', 'mitglied', 'abgesagt']

const FILE_NAME = 'voranmeldungen.json'
const BLOB_PATH = 'konni/voranmeldungen.json'
const MAX_BODY = 12_000
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 6
const NAME_RE = /^[\p{L}][\p{L}\s.'-]{1,79}$/u
const hits = new Map()

function text(value, max) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function longText(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

function pickList(value, allowed) {
  const list = Array.isArray(value) ? value.map((item) => String(item)) : []
  return allowed.filter((item) => list.includes(item))
}

export function readPrereg(body) {
  const name = text(body.name, 80)
  if (!NAME_RE.test(name) || !name.includes(' ')) return { ok: false, error: 'name' }
  const age = Number(String(body.age ?? '').trim())
  if (!Number.isInteger(age) || age < 5 || age > 99) return { ok: false, error: 'age' }
  const email = normalizeEmail(body.email)
  if (!isValidEmail(email)) return { ok: false, error: 'email' }
  const phone = text(body.phone, 30)
  if (phone && !isValidPhone(phone)) return { ok: false, error: 'phone' }
  const sports = pickList(body.sports, PREREG_SPORTS)
  if (!sports.length) return { ok: false, error: 'sports' }
  const experience = longText(body.experience, 400)
  if (!experience) return { ok: false, error: 'experience' }
  const times = longText(body.times, 300)
  if (!times) return { ok: false, error: 'times' }
  const offer = String(body.offer ?? '')
  if (!PREREG_OFFER.includes(offer)) return { ok: false, error: 'offer' }
  const sources = pickList(body.sources, PREREG_SOURCES)
  if (!sources.length) return { ok: false, error: 'sources' }
  if (body.notify !== true && body.notify !== false) return { ok: false, error: 'notify' }
  const goal = longText(body.goal, 600)
  if (!goal) return { ok: false, error: 'goal' }
  if (body.consent !== true) return { ok: false, error: 'consent' }

  return {
    ok: true,
    entry: {
      name,
      age,
      email,
      phone,
      sports,
      sportsOther: sports.includes('SONSTIGES') ? text(body.sportsOther, 80) : '',
      experience,
      times,
      offer,
      sources,
      sourceOther: sources.includes('Sonstiges') ? text(body.sourceOther, 80) : '',
      notify: body.notify,
      goal,
      message: longText(body.message, 1500),
    },
  }
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function normalize(parsed) {
  return { version: 1, entries: Array.isArray(parsed?.entries) ? parsed.entries : [] }
}

export function createPreregStore({ dataDir, env = process.env }) {
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

export async function addPrereg(store, entry, now = new Date()) {
  const at = now.toISOString()
  let saved = null
  let repeat = false
  await store.update((db) => {
    const index = db.entries.findIndex((row) => row.email === entry.email)
    if (index >= 0) {
      const row = db.entries[index]
      repeat = true
      saved = { ...row, ...entry, status: row.status, note: row.note, submissions: (row.submissions ?? 1) + 1, updatedAt: at }
      db.entries[index] = saved
    } else {
      saved = { id: randomUUID(), ...entry, status: 'neu', note: '', submissions: 1, createdAt: at, updatedAt: at }
      db.entries.push(saved)
    }
    return db
  })
  return { entry: saved, repeat }
}

export function preregStats(entries) {
  const count = (fn) => entries.filter(fn).length
  const bySport = Object.fromEntries(PREREG_SPORTS.map((sport) => [sport, count((row) => row.sports?.includes(sport))]))
  const bySource = Object.fromEntries(PREREG_SOURCES.map((source) => [source, count((row) => row.sources?.includes(source))]))
  return {
    total: entries.length,
    fresh: count((row) => row.status === 'neu'),
    offerYes: count((row) => row.offer === 'ja'),
    offerMaybe: count((row) => row.offer === 'vielleicht'),
    notify: count((row) => row.notify),
    minors: count((row) => row.age < 18),
    members: count((row) => row.status === 'mitglied'),
    bySport,
    bySource,
  }
}

export function patchPrereg(row, patch, now = new Date()) {
  const next = { ...row }
  if (patch.status !== undefined) {
    if (!PREREG_STATUS.includes(String(patch.status))) return { ok: false, error: 'invalid' }
    next.status = String(patch.status)
  }
  if (patch.note !== undefined) next.note = longText(patch.note, 1500)
  next.updatedAt = now.toISOString()
  return { ok: true, entry: next }
}

function csvCell(value) {
  const raw = Array.isArray(value) ? value.join(', ') : String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

export function preregCsv(entries) {
  const head = [
    'Eingang',
    'Name',
    'Alter',
    'E-Mail',
    'Telefon',
    'Sportarten',
    'Sonstige Sportart',
    'Erfahrung',
    'Trainingszeiten',
    'Eröffnungspreis',
    'Erfahren über',
    'Sonstige Quelle',
    'Infos erwünscht',
    'Ziel',
    'Nachricht',
    'Status',
    'Notiz',
  ]
  const rows = entries.map((row) =>
    [
      row.createdAt,
      row.name,
      row.age,
      row.email,
      row.phone,
      row.sports,
      row.sportsOther,
      row.experience,
      row.times,
      row.offer,
      row.sources,
      row.sourceOther,
      row.notify ? 'ja' : 'nein',
      row.goal,
      row.message,
      row.status,
      row.note,
    ]
      .map(csvCell)
      .join(';'),
  )
  return `\uFEFF${[head.map(csvCell).join(';'), ...rows].join('\r\n')}\r\n`
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

export function createPreregHandler({ dataDir, env }) {
  const store = createPreregStore({ dataDir, env })

  return async function handlePrereg(req, res) {
    try {
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
        json(res, 200, { ok: true })
        return
      }
      const parsed = readPrereg(body)
      if (!parsed.ok) {
        json(res, 400, { ok: false, error: parsed.error })
        return
      }
      const { repeat } = await addPrereg(store, parsed.entry)
      json(res, 200, { ok: true, repeat })
    } catch (error) {
      console.error('[voranmeldung]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
