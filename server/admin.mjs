import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isValidEmail, isValidName, isValidPhone, ageOn, normalizeEmail } from './membership.mjs'
import {
  ADMIN_COOKIE,
  cancelInfo,
  ensurePayments,
  isoDate,
  listMember,
  memberFromSignup,
  publicMember,
  setPayment,
  termEndDate,
  cancelDeadlineDate,
  memberStartDate,
  isValidBic,
  isValidIban,
  mandateRefFor,
  maskIban,
  normalizeIban,
} from './member-model.mjs'
import { createMemberStore, storeKind } from './member-store.mjs'
import { buildContractPdf } from './membership-pdf.mjs'
import { berlinYm, buildReport } from './member-report.mjs'

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 12
const MAX_BODY = 420_000
const SESSION_MS = 12 * 60 * 60 * 1000
const PHOTO_MAX = 140_000
const PLAN_IDS = ['standard', 'flex', 'daypass', 'first50']
const PLAN_META = {
  standard: { name: 'Standard', price: 99.99, months: 24, fee: 0 },
  flex: { name: 'Flex', price: 109.99, months: 12, fee: 0 },
  daypass: { name: 'Day Pass', price: 19.99, months: null, fee: 0 },
  first50: { name: 'First 50', price: 89.99, months: 24, fee: 0 },
}
const hits = new Map()

function adminSecret(env) {
  const value = env.ADMIN_SECRET?.trim() || env.INVITE_SECRET?.trim() || ''
  return value.length >= 16 ? value : ''
}

function secretsEqual(left, right) {
  const a = Buffer.from(String(left ?? ''))
  const b = Buffer.from(String(right ?? ''))
  if (!a.length || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function signSession(secret, exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function readSession(secret, token) {
  const [payload, sig] = String(token ?? '').split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number(data.exp) > Date.now()
  } catch {
    return false
  }
}

function cookieValue(header, name) {
  if (!header) return ''
  const prefix = `${name}=`
  const hit = String(header)
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : ''
}

function cookieHeader(token, secure) {
  const base = `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_MS / 1000)}`
  return secure ? `${base}; Secure` : base
}

function clearCookie(secure) {
  const base = `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  return secure ? `${base}; Secure` : base
}

function isSecure(req) {
  const proto = req.headers['x-forwarded-proto']
  if (typeof proto === 'string') return proto.split(',')[0].trim() === 'https'
  return Boolean(process.env.VERCEL)
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

function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value)
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

const DOC_KINDS = ['contract', 'sepa']
const DOC_MAX = 4_200_000
const DOC_TYPES = {
  'application/pdf': { ext: 'pdf', magic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(1, 4).toString('latin1') === 'PNG' },
  'image/webp': {
    ext: 'webp',
    magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
}

async function readRawBody(req, limit) {
  if (Buffer.isBuffer(req.body)) return req.body
  return await new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('too_large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function applyDocSideEffects(member, kind, at) {
  const next = { ...member }
  if (kind === 'sepa' && next.bank?.iban && !next.bank.mandateSignedAt) {
    next.bank = { ...next.bank, mandateSignedAt: at }
  }
  if (kind === 'contract' && next.minor && next.guardian && !next.guardian.signedAt) {
    next.guardian = { ...next.guardian, signedAt: at, signedVia: 'paper' }
    if (next.status === 'received') next.status = 'active'
  }
  return next
}

function statsOf(members, today) {
  let active = 0
  let openPay = 0
  let canCancel = 0
  let daypass = 0
  let todo = 0
  let fresh = 0
  for (const row of members) {
    const view = listMember(row, today)
    if (view.isNew) fresh += 1
    if (view.bankMissing || view.guardianMissing || view.contractMissing) todo += 1
    if (row.status === 'active' || row.status === 'received') active += 1
    if (view.payThisMonth === 'open' || view.payThisMonth === 'failed') openPay += 1
    if (view.cancel?.canCancelNow) canCancel += 1
    if (row.plan === 'daypass') daypass += 1
  }
  return { total: members.length, active, openPay, canCancel, daypass, todo, fresh }
}

function matches(member, { q, plan, status, pay, joined }, today) {
  const view = listMember(member, today)
  if (joined) {
    const month = member.plan === 'daypass' ? String(member.visitDay ?? '').slice(0, 7) : berlinYm(member.createdAt)
    if (month !== joined) return false
  }
  if (plan && member.plan !== plan) return false
  if (status && member.status !== status) return false
  if (pay && view.payThisMonth !== pay) return false
  if (!q) return true
  const hay = `${member.firstName} ${member.lastName} ${member.email} ${member.phone} ${member.planName}`.toLowerCase()
  return hay.includes(q)
}

function readPhoto(value) {
  if (value == null || value === '') return { ok: true, photoData: null }
  if (typeof value !== 'string' || value.length > PHOTO_MAX || !value.startsWith('data:image/')) {
    return { ok: false, error: 'photo' }
  }
  return { ok: true, photoData: value }
}

function readBank(input, current, id, fallbackHolder) {
  if (input == null) return { ok: true, bank: current ?? null }
  const iban = normalizeIban(input.iban)
  if (!iban) {
    if (current?.iban && input.iban === undefined) return { ok: true, bank: current }
    return { ok: true, bank: null }
  }
  if (!isValidIban(iban)) return { ok: false, error: 'iban' }
  const bic = String(input.bic ?? '')
    .replace(/\s/g, '')
    .toUpperCase()
  if (bic && !isValidBic(bic)) return { ok: false, error: 'bic' }
  const holder = String(input.holder ?? '').trim() || fallbackHolder
  if (holder.length < 3 || holder.length > 120) return { ok: false, error: 'holder' }
  const signed = Boolean(input.mandateSigned)
  const sameAccount = current?.iban === iban
  return {
    ok: true,
    bank: {
      holder,
      iban,
      bic,
      mandateRef: current?.mandateRef || mandateRefFor(id),
      mandateSignedAt: signed ? (sameAccount && current?.mandateSignedAt) || new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  }
}

function readGuardian(input, current, minor) {
  if (!minor) return { ok: true, guardian: current ?? null }
  if (input == null) return { ok: true, guardian: current ?? null }
  const guardian = {
    name: String(input.name ?? '').trim(),
    relation: String(input.relation ?? '').trim().slice(0, 40),
    email: normalizeEmail(input.email),
    phone: String(input.phone ?? '').trim(),
  }
  if (!isValidName(guardian.name) || !isValidPhone(guardian.phone)) return { ok: false, error: 'guardian' }
  if (guardian.email && !isValidEmail(guardian.email)) return { ok: false, error: 'guardian' }
  const signed = Boolean(input.signed)
  return {
    ok: true,
    guardian: {
      ...guardian,
      idChecked: Boolean(input.idChecked),
      signedAt: signed ? current?.signedAt || new Date().toISOString() : null,
      signedVia: signed ? current?.signedVia || 'paper' : null,
    },
  }
}

function createDeskMember(body, today) {
  const plan = String(body.plan ?? '')
  if (!PLAN_IDS.includes(plan)) return { ok: false, error: 'plan' }
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  if (!isValidName(firstName) || !isValidName(lastName)) return { ok: false, error: 'name' }
  const age = ageOn(body.birthDate)
  if (age == null || age < 6 || age > 100) return { ok: false, error: 'birth' }
  const email = normalizeEmail(body.email)
  const phone = String(body.phone ?? '').trim()
  if (!isValidEmail(email)) return { ok: false, error: 'email' }
  if (!isValidPhone(phone)) return { ok: false, error: 'phone' }
  const meta = PLAN_META[plan]
  let visitDay = ''
  if (plan === 'daypass') {
    visitDay = String(body.visitDay ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDay)) return { ok: false, error: 'visit' }
  }
  const id = randomUUID()
  const minor = age < 18
  if (minor && !body.guardian) return { ok: false, error: 'guardian' }
  const guardianRead = readGuardian(body.guardian, null, minor)
  if (!guardianRead.ok) return guardianRead
  const holderFallback = minor ? guardianRead.guardian.name : `${firstName} ${lastName}`
  const bankRead = plan === 'daypass' ? { ok: true, bank: null } : readBank(body.bank, null, id, holderFallback)
  if (!bankRead.ok) return bankRead
  const photo = readPhoto(body.photoData)
  if (!photo.ok) return photo
  const record = {
    id,
    status: minor && !guardianRead.guardian.signedAt ? 'received' : 'active',
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
    street: String(body.street ?? '').trim(),
    zip: String(body.zip ?? '').trim(),
    city: String(body.city ?? '').trim() || 'Leipzig',
    email,
    phone,
    inviteSlot: null,
    guardian: guardianRead.guardian,
    bank: bankRead.bank,
    photoData: photo.photoData,
    visitDay: visitDay || null,
    place: String(body.place ?? 'Leipzig').trim() || 'Leipzig',
    signature: `${firstName} ${lastName}`,
    consents: {},
    notes: String(body.notes ?? '').trim(),
    createdAt: new Date().toISOString(),
    source: 'admin',
  }
  record.startDate = String(body.startDate ?? '').trim() || memberStartDate(record, today)
  return { ok: true, member: { ...memberFromSignup(record, today), status: record.status } }
}

const PROFILE_FIELDS = ['firstName', 'lastName', 'birthDate', 'street', 'zip', 'city', 'email', 'phone']
const HISTORY_FIELDS = [...PROFILE_FIELDS, 'status', 'startDate']
const HISTORY_MAX = 200

function readProfile(input) {
  const values = {}
  for (const field of PROFILE_FIELDS) {
    if (typeof input[field] !== 'string') continue
    values[field] = field === 'email' ? normalizeEmail(input[field]) : input[field].trim()
  }
  if ('firstName' in values && !isValidName(values.firstName)) return { ok: false, error: 'name' }
  if ('lastName' in values && !isValidName(values.lastName)) return { ok: false, error: 'name' }
  if ('birthDate' in values) {
    const age = ageOn(values.birthDate)
    if (age == null || age < 6 || age > 100) return { ok: false, error: 'birth' }
  }
  if ('email' in values && !isValidEmail(values.email)) return { ok: false, error: 'email' }
  if ('phone' in values && !isValidPhone(values.phone)) return { ok: false, error: 'phone' }
  if ('street' in values && values.street && (values.street.length < 4 || values.street.length > 120)) {
    return { ok: false, error: 'address' }
  }
  if ('zip' in values && values.zip && !/^\d{5}$/.test(values.zip)) return { ok: false, error: 'address' }
  if ('city' in values && values.city.length > 80) return { ok: false, error: 'address' }
  return { ok: true, values }
}

function historyOf(before, after, at) {
  const rows = []
  for (const field of HISTORY_FIELDS) {
    const from = before[field] ?? ''
    const to = after[field] ?? ''
    if (String(from) !== String(to)) rows.push({ at, field, from: String(from), to: String(to) })
  }
  const ibanBefore = before.bank?.iban ?? ''
  const ibanAfter = after.bank?.iban ?? ''
  if (ibanBefore !== ibanAfter) {
    rows.push({ at, field: 'iban', from: ibanBefore ? maskIban(ibanBefore) : '', to: ibanAfter ? maskIban(ibanAfter) : '' })
  }
  return rows
}

function patchMember(current, patch, today) {
  const result = patchMemberFields(current, patch, today)
  if (!result.ok) return result
  const at = new Date().toISOString()
  const changes = historyOf(current, result.member, at)
  if (!changes.length) return result
  return {
    ok: true,
    member: { ...result.member, history: [...(current.history ?? []), ...changes].slice(-HISTORY_MAX) },
  }
}

function patchMemberFields(current, patch, today) {
  const next = { ...current }
  if (patch.status && ['received', 'active', 'paused', 'cancelled', 'expired'].includes(patch.status)) {
    next.status = patch.status
    if (patch.status === 'cancelled') {
      next.cancelledAt = new Date().toISOString()
      const info = cancelInfo({ ...next, status: 'active' }, today)
      next.cancelEffectiveOn = patch.cancelEffectiveOn || info.nextEnd || today
    }
    if (patch.status === 'paused') next.pausedUntil = String(patch.pausedUntil ?? '') || null
    if (patch.status === 'active') {
      next.pausedUntil = null
      next.cancelledAt = null
      next.cancelEffectiveOn = null
    }
  }
  if (typeof patch.notes === 'string') next.notes = patch.notes.slice(0, 4000)
  if (patch.reviewed === true && !next.reviewedAt) next.reviewedAt = new Date().toISOString()
  if (patch.profile && typeof patch.profile === 'object') {
    const profile = readProfile(patch.profile)
    if (!profile.ok) return profile
    Object.assign(next, profile.values)
    if (profile.values.birthDate) {
      next.age = ageOn(profile.values.birthDate)
      next.minor = next.age < 18
    }
  }
  if (typeof patch.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(patch.startDate)) {
    next.startDate = patch.startDate
    next.endDate = termEndDate(next.startDate, next.termMonths)
    next.cancelDeadline = cancelDeadlineDate(next.startDate, next.termMonths)
  }
  if (patch.photoData === null || typeof patch.photoData === 'string') {
    const photo = readPhoto(patch.photoData)
    if (!photo.ok) return photo
    next.photoData = photo.photoData
  }
  if (patch.bank !== undefined && next.plan !== 'daypass') {
    const holderFallback = next.minor && next.guardian?.name ? next.guardian.name : `${next.firstName} ${next.lastName}`
    const bankRead = patch.bank === null ? { ok: true, bank: null } : readBank(patch.bank, next.bank, next.id, holderFallback)
    if (!bankRead.ok) return bankRead
    next.bank = bankRead.bank
  }
  if (patch.guardian !== undefined && next.minor) {
    const guardianRead = readGuardian(patch.guardian, next.guardian, true)
    if (!guardianRead.ok) return guardianRead
    next.guardian = guardianRead.guardian
    if (next.guardian?.signedAt && next.status === 'received' && !patch.status) next.status = 'active'
  }
  if (typeof patch.stripeCustomerId === 'string') {
    const customerId = patch.stripeCustomerId.trim()
    if (customerId && !/^cus_[A-Za-z0-9]{6,40}$/.test(customerId)) return { ok: false, error: 'stripe' }
    next.stripe = customerId ? { ...(next.stripe ?? {}), customerId } : null
  }
  next.updatedAt = new Date().toISOString()
  return { ok: true, member: ensurePayments(next, today) }
}

export function createAdminHandler({ dataDir, env }) {
  const store = createMemberStore({ dataDir, env })
  const secret = () => adminSecret(env)

  return async function handleAdmin(req, res) {
    try {
      await run(req, res)
    } catch (error) {
      console.error('[admin]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }

  function authed(req) {
    const key = secret()
    if (!key) return false
    return readSession(key, cookieValue(req.headers.cookie, ADMIN_COOKIE))
  }

  async function run(req, res) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('allow', 'GET, POST, OPTIONS')
      res.end()
      return
    }

    const url = new URL(req.url || '/', 'http://localhost')
    const today = isoDate()
    const key = secret()
    const secure = isSecure(req)

    if (req.method === 'GET' && url.searchParams.get('ping') === '1') {
      json(res, 200, { ok: true, auth: authed(req), store: storeKind(env) })
      return
    }

    const uploadKind = url.searchParams.get('upload')
    if (req.method === 'POST' && uploadKind) {
      if (!authed(req)) {
        json(res, 401, { ok: false, error: 'auth' })
        return
      }
      if (!DOC_KINDS.includes(uploadKind)) {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }
      const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
      const spec = DOC_TYPES[type]
      if (!spec) {
        json(res, 400, { ok: false, error: 'doctype' })
        return
      }
      let bytes
      try {
        bytes = await readRawBody(req, DOC_MAX)
      } catch {
        json(res, 413, { ok: false, error: 'docsize' })
        return
      }
      if (!bytes.length || !spec.magic(bytes)) {
        json(res, 400, { ok: false, error: 'doctype' })
        return
      }
      const id = String(url.searchParams.get('id') ?? '')
      const db = await store.load()
      const current = db.members.find((row) => row.id === id)
      if (!current) {
        json(res, 404, { ok: false, error: 'missing' })
        return
      }
      const at = new Date().toISOString()
      const path = `${id}/${uploadKind}-${Date.now()}.${spec.ext}`
      await store.putDoc(path, bytes, type)
      const rawName = decodeURIComponent(String(req.headers['x-file-name'] ?? ''))
      const name = rawName.replace(/[^\p{L}\p{N} ._()-]+/gu, '_').slice(0, 120) || `${uploadKind}.${spec.ext}`
      let saved = null
      let previous = null
      await store.update((fresh) => {
        const index = fresh.members.findIndex((row) => row.id === id)
        if (index < 0) return fresh
        const row = fresh.members[index]
        previous = row.docs?.[uploadKind]?.path ?? null
        const withDoc = {
          ...row,
          docs: { ...(row.docs ?? {}), [uploadKind]: { path, name, type, size: bytes.length, uploadedAt: at } },
          updatedAt: at,
        }
        fresh.members[index] = ensurePayments(applyDocSideEffects(withDoc, uploadKind, at), today)
        saved = fresh.members[index]
        return fresh
      })
      if (previous && previous !== path) await store.deleteDoc(previous).catch(() => undefined)
      if (!saved) {
        await store.deleteDoc(path).catch(() => undefined)
        json(res, 404, { ok: false, error: 'missing' })
        return
      }
      json(res, 200, { ok: true, member: publicMember(saved, today, true) })
      return
    }

    if (req.method === 'POST') {
      let body
      try {
        body = await readBody(req)
      } catch {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }
      const action = String(body.action ?? '')

      if (action === 'login') {
        if (rateLimited(clientIp(req))) {
          json(res, 429, { ok: false, error: 'rate' })
          return
        }
        if (!key || !secretsEqual(String(body.password ?? ''), key)) {
          json(res, 403, { ok: false, error: 'auth' })
          return
        }
        json(
          res,
          200,
          { ok: true, store: storeKind(env) },
          { 'set-cookie': cookieHeader(signSession(key, Date.now() + SESSION_MS), secure) },
        )
        return
      }

      if (action === 'logout') {
        json(res, 200, { ok: true }, { 'set-cookie': clearCookie(secure) })
        return
      }

      if (!authed(req)) {
        json(res, 401, { ok: false, error: 'auth' })
        return
      }

      if (action === 'create') {
        const made = createDeskMember(body, today)
        if (!made.ok) {
          json(res, 400, { ok: false, error: made.error })
          return
        }
        await store.update((db) => {
          db.members.push(made.member)
          return db
        })
        json(res, 200, { ok: true, member: publicMember(made.member, today, true) })
        return
      }

      if (action === 'update') {
        const id = String(body.id ?? '')
        let result = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          const patched = patchMember(db.members[index], body, today)
          if (!patched.ok) {
            result = patched
            return db
          }
          db.members[index] = patched.member
          result = patched
          return db
        })
        if (!result) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (!result.ok) {
          json(res, 400, { ok: false, error: result.error })
          return
        }
        json(res, 200, { ok: true, member: publicMember(result.member, today, true) })
        return
      }

      if (action === 'pay') {
        const id = String(body.id ?? '')
        const status = String(body.status ?? '')
        if (!['paid', 'open', 'failed', 'waived'].includes(status)) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        let saved = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          db.members[index] = setPayment(
            db.members[index],
            {
              period: String(body.period ?? ''),
              kind: body.kind === 'day' ? 'day' : 'month',
              status,
              note: String(body.note ?? ''),
            },
            today,
          )
          saved = db.members[index]
          return db
        })
        if (!saved) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        json(res, 200, { ok: true, member: publicMember(saved, today, true) })
        return
      }

      if (action === 'deleteDoc') {
        const id = String(body.id ?? '')
        const kind = String(body.kind ?? '')
        if (!DOC_KINDS.includes(kind)) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        let saved = null
        let removed = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          const row = db.members[index]
          removed = row.docs?.[kind]?.path ?? null
          const docs = { ...(row.docs ?? {}) }
          delete docs[kind]
          db.members[index] = { ...row, docs, updatedAt: new Date().toISOString() }
          saved = db.members[index]
          return db
        })
        if (!saved) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (removed) await store.deleteDoc(removed).catch(() => undefined)
        json(res, 200, { ok: true, member: publicMember(saved, today, true) })
        return
      }

      json(res, 400, { ok: false, error: 'invalid' })
      return
    }

    if (req.method !== 'GET') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }

    if (!authed(req)) {
      json(res, 401, { ok: false, error: 'auth' })
      return
    }

    const db = await store.load()
    const reportYear = url.searchParams.get('report')
    if (reportYear) {
      const year = /^\d{4}$/.test(reportYear) ? reportYear : today.slice(0, 4)
      json(res, 200, { ok: true, report: buildReport(db.members, year, today) })
      return
    }
    const id = url.searchParams.get('id')
    if (id) {
      const row = db.members.find((item) => item.id === id)
      if (!row) {
        json(res, 404, { ok: false, error: 'missing' })
        return
      }
      const docKind = url.searchParams.get('doc')
      if (docKind) {
        const meta = DOC_KINDS.includes(docKind) ? row.docs?.[docKind] : null
        const bytes = meta ? await store.getDoc(meta.path) : null
        if (!meta || !bytes) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        res.statusCode = 200
        res.setHeader('content-type', meta.type)
        res.setHeader('cache-control', 'no-store')
        res.setHeader('x-content-type-options', 'nosniff')
        res.setHeader(
          'content-disposition',
          `inline; filename="${docKind}.${DOC_TYPES[meta.type]?.ext ?? 'bin'}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        )
        res.end(bytes)
        return
      }
      if (url.searchParams.get('pdf') === 'contract') {
        const bytes = await buildContractPdf(publicMember(row, today), {
          paper: true,
          creditorId: env.SEPA_CREDITOR_ID?.trim() || '',
        })
        const name = `Vertrag-${row.lastName}-${row.firstName}`.replace(/[^A-Za-z0-9-]+/g, '_')
        res.statusCode = 200
        res.setHeader('content-type', 'application/pdf')
        res.setHeader('cache-control', 'no-store')
        res.setHeader('content-disposition', `inline; filename="${name}.pdf"`)
        res.end(Buffer.from(bytes))
        return
      }
      json(res, 200, { ok: true, member: publicMember(row, today, true), store: storeKind(env) })
      return
    }

    const q = String(url.searchParams.get('q') ?? '')
      .trim()
      .toLowerCase()
    const plan = String(url.searchParams.get('plan') ?? '')
    const status = String(url.searchParams.get('status') ?? '')
    const pay = String(url.searchParams.get('pay') ?? '')
    const joinedParam = String(url.searchParams.get('joined') ?? '')
    const joined = /^\d{4}-\d{2}$/.test(joinedParam) ? joinedParam : ''
    const members = db.members
      .filter((row) => matches(row, { q, plan, status, pay, joined }, today))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .map((row) => listMember(row, today))
    json(res, 200, {
      ok: true,
      store: storeKind(env),
      stats: statsOf(db.members, today),
      members,
    })
  }
}
