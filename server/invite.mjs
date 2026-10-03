import { createHmac, timingSafeEqual } from 'node:crypto'

export const FIRST50_ID = 'first50'
export const FIRST50_LIMIT = 50
export const INVITE_TTL_HOURS = 48

export function normalizeInviteEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

export function normalizePersonName(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function namesMatch(left, right) {
  return normalizePersonName(left).toLocaleLowerCase('de-DE') === normalizePersonName(right).toLocaleLowerCase('de-DE')
}

export function splitPersonName(full) {
  const parts = normalizePersonName(full).split(' ').filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) }
}

function getSecret(secret) {
  const value = String(secret ?? '').trim()
  return value.length >= 16 ? value : ''
}

export function signInvite(secret, payload) {
  const key = getSecret(secret)
  if (!key) throw new Error('invite_secret')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyInvite(secret, token) {
  const key = getSecret(secret)
  if (!key) return { ok: false, error: 'invite' }
  const raw = String(token ?? '')
  const dot = raw.lastIndexOf('.')
  if (dot < 8) return { ok: false, error: 'invite' }
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = createHmac('sha256', key).update(body).digest('base64url')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, error: 'invite' }
  }
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'invite' }
  }
  if (payload?.p !== FIRST50_ID) return { ok: false, error: 'invite' }
  const email = normalizeInviteEmail(payload.e)
  const name = normalizePersonName(payload.n)
  const slot = Number(payload.s)
  const exp = Number(payload.exp)
  if (!email || !name || !Number.isInteger(slot) || slot < 1 || slot > FIRST50_LIMIT) {
    return { ok: false, error: 'invite' }
  }
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return { ok: false, error: 'expired' }
  return { ok: true, payload: { email, name, slot, exp, plan: FIRST50_ID } }
}

export function inviteUsed(memberships, email) {
  const needle = normalizeInviteEmail(email)
  return memberships.some(
    (row) =>
      row?.plan === FIRST50_ID &&
      row?.status !== 'cancelled' &&
      normalizeInviteEmail(row.email) === needle,
  )
}

export function makeInvitePayload({ email, name, slot, ttlHours = INVITE_TTL_HOURS, nowMs = Date.now() }) {
  return {
    p: FIRST50_ID,
    e: normalizeInviteEmail(email),
    n: normalizePersonName(name),
    s: Number(slot),
    exp: Math.floor(nowMs / 1000) + ttlHours * 60 * 60,
  }
}
