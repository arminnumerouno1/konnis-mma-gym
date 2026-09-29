import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inviteUsed, namesMatch, normalizeInviteEmail, normalizePersonName, verifyInvite } from './invite.mjs'
import { sendMembershipEmails } from './membership-mail.mjs'
import { createMemberStore, ingestSignup } from './member-store.mjs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+0-9][0-9 ()/-]{5,24}$/
const NAME_RE = /^[\p{L}][\p{L}\s.'-]{1,79}$/u
const ZIP_RE = /^\d{5}$/
const MAX_BODY = 24_576
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 6
const PLAN_IDS = ['standard', 'flex', 'daypass', 'first50']

/** Muss mit src/brand/plans.ts SIGNUP_OPEN zusammenpassen, außer SIGNUP_OPEN=true/false in der Umgebung. */
export const SIGNUP_OPEN = false

export function isSignupOpen(env = {}) {
  const raw = String(env.SIGNUP_OPEN ?? '').trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return SIGNUP_OPEN
}

const PLAN_META = {
  standard: { name: 'Standard', price: 99.99, months: 24, fee: 0 },
  flex: { name: 'Flex', price: 109.99, months: 12, fee: 0 },
  daypass: { name: 'Day Pass', price: 19.99, months: null, fee: 0 },
  first50: { name: 'First 50', price: 89.99, months: 24, fee: 0 },
}

/** @type {Map<string, number[]>} */
const hits = new Map()

export function normalizeEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

export function isValidEmail(email) {
  return email.length >= 6 && email.length <= 254 && EMAIL_RE.test(email)
}

export function isValidName(name) {
  const value = String(name ?? '').trim()
  return NAME_RE.test(value)
}

export function isValidPhone(phone) {
  const value = String(phone ?? '').trim()
  return PHONE_RE.test(value)
}

export function ageOn(birthDate, at = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const born = new Date(Date.UTC(year, month - 1, day))
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) {
    return null
  }
  if (born.getTime() > Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())) return null
  let age = at.getUTCFullYear() - year
  const monthDiff = at.getUTCMonth() - (month - 1)
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < day)) age -= 1
  return age
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
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

async function readBody(req) {
  if (req.body != null && !Buffer.isBuffer(req.body)) {
    if (typeof req.body === 'object') return req.body
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return {}
      return JSON.parse(req.body)
    }
  }
  return readJsonBody(req)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

export async function loadMemberships(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.memberships) ? parsed.memberships : []
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function saveMemberships(file, memberships) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify({ memberships }, null, 2)}\n`, 'utf8')
}

export function first50Taken(memberships) {
  return memberships.filter((row) => row.plan === 'first50' && row.status !== 'cancelled').length
}

function truthy(value) {
  return value === true
}

export function validateMembership(body, ctx = {}) {
  if (typeof body.company === 'string' && body.company.trim()) {
    return { ok: true, honey: true }
  }

  const plan = String(body.plan ?? '')
  if (!PLAN_IDS.includes(plan)) return { ok: false, error: 'plan' }

  let invite = null
  if (plan === 'first50') {
    const checked = verifyInvite(ctx.inviteSecret, body.invite)
    if (!checked.ok) return { ok: false, error: checked.error === 'expired' ? 'expired' : 'invite' }
    if (inviteUsed(ctx.memberships ?? [], checked.payload.email)) {
      return { ok: false, error: 'invite' }
    }
    invite = checked.payload
  }

  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  if (!isValidName(firstName) || !isValidName(lastName)) return { ok: false, error: 'name' }

  const age = ageOn(body.birthDate)
  if (age == null || age < 6 || age > 100) return { ok: false, error: 'birth' }

  const street = String(body.street ?? '').trim()
  const zip = String(body.zip ?? '').trim()
  const city = String(body.city ?? '').trim()
  if (street.length < 4 || street.length > 120) return { ok: false, error: 'address' }
  if (!ZIP_RE.test(zip)) return { ok: false, error: 'address' }
  if (!isValidName(city) && (city.length < 2 || city.length > 80)) return { ok: false, error: 'address' }

  const email = normalizeEmail(body.email)
  const phone = String(body.phone ?? '').trim()
  if (!isValidEmail(email)) return { ok: false, error: 'email' }
  if (!isValidPhone(phone)) return { ok: false, error: 'phone' }

  if (invite) {
    if (normalizeInviteEmail(email) !== invite.email) return { ok: false, error: 'invite' }
    const submittedName = normalizePersonName(`${firstName} ${lastName}`)
    if (!namesMatch(submittedName, invite.name)) return { ok: false, error: 'invite' }
  }

  const minor = age < 18
  const guardian = {
    name: String(body.guardianName ?? '').trim(),
    email: normalizeEmail(body.guardianEmail),
    phone: String(body.guardianPhone ?? '').trim(),
  }
  if (minor) {
    if (!isValidName(guardian.name) || !isValidEmail(guardian.email) || !isValidPhone(guardian.phone)) {
      return { ok: false, error: 'guardian' }
    }
    if (!truthy(body.guardianConsent)) return { ok: false, error: 'guardian' }
  }

  const consents = body.consents && typeof body.consents === 'object' ? body.consents : {}
  if (!truthy(consents.agb) || !truthy(consents.hausordnung) || !truthy(consents.widerruf)) {
    return { ok: false, error: 'consent' }
  }
  if (!truthy(consents.privacy) || !truthy(consents.health) || !truthy(consents.sign)) {
    return { ok: false, error: 'consent' }
  }

  const place = String(body.place ?? '').trim()
  if (place.length < 2 || place.length > 80) return { ok: false, error: 'place' }

  const signature = String(body.signature ?? '').trim().replace(/\s+/g, ' ')
  const expected = `${firstName} ${lastName}`.replace(/\s+/g, ' ')
  if (signature.toLocaleLowerCase('de-DE') !== expected.toLocaleLowerCase('de-DE')) {
    return { ok: false, error: 'signature' }
  }

  let visitDay = ''
  if (plan === 'daypass') {
    visitDay = String(body.visitDay ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDay)) return { ok: false, error: 'visit' }
  }

  const meta = PLAN_META[plan]
  return {
    ok: true,
    honey: false,
    record: {
      id: randomUUID(),
      status: 'received',
      plan,
      planName: meta.name,
      price: meta.price,
      termMonths: meta.months,
      fee: meta.fee,
      firstName,
      lastName,
      birthDate: String(body.birthDate),
      age,
      minor,
      street,
      zip,
      city,
      email,
      phone,
      inviteSlot: invite ? invite.slot : null,
      guardian: minor ? guardian : null,
      visitDay: visitDay || null,
      place,
      signature,
      consents: {
        agb: true,
        hausordnung: true,
        widerruf: true,
        privacy: true,
        health: true,
        sign: true,
        earlyStart: truthy(consents.earlyStart),
        photos: truthy(consents.photos),
        newsletter: truthy(consents.newsletter),
      },
      createdAt: new Date().toISOString(),
    },
  }
}

async function inviteUsedRemote(env, email) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return false
  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers: { 'api-key': apiKey, accept: 'application/json' },
    })
    if (response.status === 404) return false
    if (!response.ok) return false
    const data = await response.json()
    const tarif = String(data?.attributes?.TARIF ?? '')
    const source = String(data?.attributes?.SOURCE ?? '')
    return /first\s*50/i.test(tarif) || source === 'mitglied-first50'
  } catch (error) {
    console.error('[mitglied] invite lookup failed', error)
    return false
  }
}

async function pushBrevo(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  const listId = Number(env.BREVO_LIST_ID)
  if (!apiKey || !Number.isFinite(listId) || listId <= 0) return 'skipped'

  const attributes = {
    VORNAME: record.firstName,
    NACHNAME: record.lastName,
    SOURCE: record.plan === 'first50' ? 'mitglied-first50' : 'mitgliedschaft',
    TARIF: record.planName,
    TELEFON: record.phone,
  }

  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      email: record.email,
      listIds: [listId],
      updateEnabled: true,
      attributes,
    }),
  })
  if (response.status === 201 || response.status === 204 || response.ok) return 'listed'
  const detail = await response.text()
  if (response.status === 400 && /already|duplicate/i.test(detail)) return 'listed'
  throw new Error(`brevo_${response.status}:${detail.slice(0, 240)}`)
}

async function pushWebhook(env, payload) {
  const url = env.MEMBERSHIP_WEBHOOK_URL?.trim() || env.WAITLIST_WEBHOOK_URL?.trim()
  if (!url) return
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`webhook_${response.status}`)
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

export function createMembershipHandler({ dataDir, env }) {
  const file = join(dataDir, 'memberships.json')
  const members = createMemberStore({ dataDir, env })

  return async function handleMembership(req, res) {
    try {
      await runMembership(req, res)
    } catch (error) {
      console.error('[mitglied]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }

  async function runMembership(req, res) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('allow', 'GET, POST, OPTIONS')
      res.end()
      return
    }

    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://localhost')
      const token = url.searchParams.get('invite')
      if (token) {
        const checked = verifyInvite(env.INVITE_SECRET, token)
        if (!checked.ok) {
          json(res, 400, { ok: false, error: checked.error === 'expired' ? 'expired' : 'invite' })
          return
        }
        const memberships = await loadMemberships(file)
        if (inviteUsed(memberships, checked.payload.email) || (await inviteUsedRemote(env, checked.payload.email))) {
          json(res, 400, { ok: false, error: 'invite' })
          return
        }
        json(res, 200, {
          ok: true,
          invite: {
            email: checked.payload.email,
            name: checked.payload.name,
            slot: checked.payload.slot,
            plan: 'first50',
            price: 89.99,
          },
        })
        return
      }
      const memberships = await loadMemberships(file)
      json(res, 200, {
        ok: true,
        first50Taken: first50Taken(memberships),
        remainingFirst50: 0,
      })
      return
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }

    if (!isSignupOpen(env)) {
      json(res, 403, { ok: false, error: 'closed' })
      return
    }

    const ip = clientIp(req)
    if (rateLimited(ip)) {
      json(res, 429, { ok: false, error: 'rate' })
      return
    }

    let body
    try {
      body = await readBody(req)
    } catch (error) {
      json(res, error instanceof Error && error.message === 'too_large' ? 413 : 400, {
        ok: false,
        error: 'invalid',
      })
      return
    }

    const memberships = await loadMemberships(file)
    const checked = validateMembership(body, { inviteSecret: env.INVITE_SECRET, memberships })
    if (checked.ok && checked.honey) {
      json(res, 200, { ok: true, confirmation: 'saved', remainingFirst50: 0 })
      return
    }
    if (!checked.ok) {
      json(res, 400, { ok: false, error: checked.error })
      return
    }

    if (
      checked.record.plan === 'first50' &&
      (await inviteUsedRemote(env, checked.record.email))
    ) {
      json(res, 400, { ok: false, error: 'invite' })
      return
    }

    const record = checked.record
    memberships.push(record)
    try {
      await saveMemberships(file, memberships)
    } catch (error) {
      console.error('[mitglied] local save skipped', error)
    }
    try {
      await ingestSignup(members, record)
    } catch (error) {
      console.error('[mitglied] member store skipped', error)
    }

    try {
      await pushWebhook(env, { type: 'membership', ...record })
    } catch (error) {
      console.error('[mitglied] webhook failed', error)
      json(res, 502, { ok: false, error: 'upstream' })
      return
    }

    let confirmation = 'saved'
    try {
      const brevo = await pushBrevo(env, record)
      if (brevo === 'listed') confirmation = 'listed'
    } catch (error) {
      console.error('[mitglied] brevo failed', error)
    }

    try {
      await sendMembershipEmails(env, record)
    } catch (error) {
      console.error('[mitglied] mail failed', error)
    }

    json(res, 200, {
      ok: true,
      confirmation,
      id: record.id,
      remainingFirst50: 0,
    })
  }
}
