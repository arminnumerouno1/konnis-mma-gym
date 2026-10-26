import { createHmac, timingSafeEqual } from 'node:crypto'

export const FIRST50_ID = 'first50'
export const PLUS_ID = 'plus'
export const INVITE_PLAN_IDS = [FIRST50_ID, PLUS_ID]
export const FIRST50_LIMIT = 50
/** Extra personal seats past the original fifty. They stay First 50 in price, without a “Platz N von 50”. */
export const FIRST50_SLOT_MAX = 400
/** Slots through this number were already mailed. The desk sender starts after them. */
export const FIRST50_ISSUED_THROUGH = 65
export const INVITE_TTL_HOURS = 48
/** Plus-Links „bis zur Anmeldung“: praktisch ein Jahr, ohne 48-Stunden-Druck. */
export const INVITE_OPEN_UNTIL_SIGNUP_HOURS = 24 * 365

export function nextFirst50Slot(members, issued = []) {
  const used = new Set()
  for (let slot = 1; slot <= FIRST50_ISSUED_THROUGH; slot += 1) used.add(slot)
  for (const slot of issued) {
    const n = Number(slot)
    if (Number.isInteger(n) && n >= 1) used.add(n)
  }
  for (const row of members ?? []) {
    if (row?.plan !== FIRST50_ID || row?.status === 'cancelled' || row?.status === 'withdrawn' || row?.status === 'expired') continue
    const slot = Number(row?.inviteSlot)
    if (Number.isInteger(slot) && slot >= 1) used.add(slot)
  }
  for (let slot = FIRST50_ISSUED_THROUGH + 1; slot <= FIRST50_SLOT_MAX; slot += 1) {
    if (!used.has(slot)) return slot
  }
  return 0
}

export function first50SeatLabel(slot) {
  const n = Number(slot)
  if (!Number.isInteger(n) || n < 1 || n > FIRST50_LIMIT) return ''
  return `Platz ${n} von 50`
}

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
  const plan = String(payload?.p ?? '')
  if (!INVITE_PLAN_IDS.includes(plan)) return { ok: false, error: 'invite' }
  const email = normalizeInviteEmail(payload.e)
  const name = normalizePersonName(payload.n)
  const slot = Number(payload.s)
  const exp = Number(payload.exp)
  if (!email || !name || !Number.isInteger(slot) || slot < 1 || slot > FIRST50_SLOT_MAX) {
    return { ok: false, error: 'invite' }
  }
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return { ok: false, error: 'expired' }
  return {
    ok: true,
    payload: {
      email,
      name,
      slot,
      exp,
      plan,
      openUntilSignup: payload.o === 1,
      start: contractStart(payload.d),
      term: plan === PLUS_ID ? 6 : contractTerm(payload.m) || 24,
    },
  }
}

export function storedContractTerm(issued, email, slot) {
  const needle = normalizeInviteEmail(email)
  const n = Number(slot)
  if (!needle || !Number.isInteger(n)) return 0
  const hit = (issued ?? []).some(
    (row) => normalizeInviteEmail(row?.email) === needle && Number(row?.slot) === n && contractTerm(row?.term) === 12,
  )
  return hit ? 12 : 0
}

export function inviteRevoked(revoked, email, slot) {
  const needle = normalizeInviteEmail(email)
  const n = Number(slot)
  if (!needle || !Number.isInteger(n)) return false
  return (revoked ?? []).some((row) => normalizeInviteEmail(row?.email) === needle && Number(row?.slot) === n)
}

export function inviteUsed(memberships, email) {
  const needle = normalizeInviteEmail(email)
  return memberships.some(
    (row) =>
      row?.plan === FIRST50_ID &&
      row?.status !== 'cancelled' &&
      row?.status !== 'withdrawn' &&
      normalizeInviteEmail(row.email) === needle,
  )
}

/** Späterer Vertragsbeginn, nur am 1. eines Monats nach der ersten normalen Fälligkeit. */
export function contractStart(raw) {
  const value = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-01$/.test(value)) return ''
  if (value <= '2026-11-01' || value > '2027-12-01') return ''
  return value
}

/** Sonderlaufzeit. 12 Monate statt der üblichen 24. */
export function contractTerm(raw) {
  return Number(raw) === 12 ? 12 : 0
}

export function makeInvitePayload({
  email,
  name,
  slot,
  plan = FIRST50_ID,
  start = '',
  term = 0,
  ttlHours = INVITE_TTL_HOURS,
  openUntilSignup = false,
  nowMs = Date.now(),
}) {
  const planId = INVITE_PLAN_IDS.includes(plan) ? plan : FIRST50_ID
  const hours = openUntilSignup
    ? INVITE_OPEN_UNTIL_SIGNUP_HOURS
    : Number.isFinite(Number(ttlHours)) && Number(ttlHours) > 0
      ? Number(ttlHours)
      : INVITE_TTL_HOURS
  const payload = {
    p: planId,
    e: normalizeInviteEmail(email),
    n: normalizePersonName(name),
    s: Number(slot),
    exp: Math.floor(nowMs / 1000) + hours * 60 * 60,
  }
  if (openUntilSignup) payload.o = 1
  const deferred = contractStart(start)
  if (deferred) payload.d = deferred
  if (planId === FIRST50_ID) {
    const months = contractTerm(term)
    if (months) payload.m = months
  }
  return payload
}
