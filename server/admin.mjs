import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isValidEmail, isValidName, isValidPhone, ageOn, normalizeEmail } from './membership.mjs'
import {
  ADMIN_COOKIE,
  cancelInfo,
  ensurePayments,
  isoDate,
  duesListItem,
  listMember,
  memberFromSignup,
  openDuesOf,
  publicMember,
  setPayment,
  waiveFuturePayments,
  termEndDate,
  cancelDeadlineDate,
  memberStartDate,
  isValidBic,
  isValidIban,
  mandateRefFor,
  maskIban,
  membershipTaken,
  normalizeIban,
} from './member-model.mjs'
import { createMemberStore, storeKind } from './member-store.mjs'
import { buildContractPdf } from './membership-pdf.mjs'
import {
  sendBroadcastEmail,
  sendMembershipEmails,
  sendPaperReturnEmail,
  sendPayLinkEmail,
  sendPriceChangeEmail,
  sendReminderEmail,
} from './membership-mail.mjs'
import {
  BROADCAST_CONFIRM,
  broadcastRecipients,
  normalizeBroadcastPayload,
  runBroadcast,
} from './broadcast-mail.mjs'
import { signupFeeFor } from './signup-fee.mjs'
import { matchBankTransactions, parseBankCsv } from './bank-import.mjs'
import { runDueReminders } from './dues-cron.mjs'
import { attachSignupDocs, attachTransferNotice } from './signup-docs.mjs'
import { GYM_BANK } from './gym-bank.mjs'
import { berlinYm, buildReport } from './member-report.mjs'
import { createPreregStore, importPreregs, patchPrereg, preregCsv, preregStats, sortPreregs } from './prereg.mjs'
import { BILLING_START, createCheckoutSession, siteOrigin } from './stripe-checkout.mjs'
import { allocateInvoiceNumber, buildReceiptPdf } from './receipt-pdf.mjs'
import { FIRST50_ID, INVITE_TTL_HOURS, PLUS_ID, contractStart, contractTerm, nextFirst50Slot, normalizePersonName, splitPersonName } from './invite.mjs'
import { deliverFirst50Invite } from './invite-mail.mjs'

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 12
const MAX_BODY = 420_000
const SESSION_MS = 12 * 60 * 60 * 1000
const PHOTO_MAX = 140_000
const PLAN_IDS = ['slowstart', 'standard', 'flex', 'plus', 'daypass', 'first50']
const PLAN_META = {
  slowstart: { name: 'Slow Start Tarif', price: 79.99, months: 12 },
  standard: { name: 'Standard', price: 99.99, months: 24 },
  flex: { name: 'Flex', price: 109.99, months: 12 },
  plus: { name: 'Plus', price: 119, months: 6 },
  daypass: { name: 'Day Pass', price: 19.99, months: null },
  first50: { name: 'First 50', price: 89.99, months: 24 },
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

const DOC_KINDS = ['contract', 'sepa', 'payment']
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
  let openDebt = 0
  let openDebtAmount = 0
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
    if (view.openCount > 0) {
      openDebt += 1
      openDebtAmount += view.openAmount
    }
    if (view.cancel?.canCancelNow) canCancel += 1
    if (row.plan === 'daypass') daypass += 1
  }
  return {
    total: members.length,
    active,
    openPay,
    openDebt,
    openDebtAmount: Math.round(openDebtAmount * 100) / 100,
    canCancel,
    daypass,
    todo,
    fresh,
  }
}

function matches(member, { q, plan, status, pay, payMethod, joined }, today) {
  const view = listMember(member, today)
  if (joined) {
    const month = member.plan === 'daypass' ? String(member.visitDay ?? '').slice(0, 7) : berlinYm(member.createdAt)
    if (month !== joined) return false
  }
  if (plan && member.plan !== plan) return false
  if (status && member.status !== status) return false
  if (pay && view.payThisMonth !== pay) return false
  if (payMethod === 'transfer' || payMethod === 'card') {
    if (view.payMethod !== payMethod) return false
  }
  if (!q) return true
  const hay = `${member.firstName} ${member.lastName} ${member.email} ${member.phone} ${member.planName}`.toLowerCase()
  return hay.includes(q)
}

const REMINDER_STAGES = ['reminder', 'mahnung1', 'mahnung2']
const REMINDER_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000

function buildDues(members, { q, payMethod, period }, today) {
  const needle = String(q ?? '')
    .trim()
    .toLowerCase()
  const month = /^\d{4}-\d{2}$/.test(String(period ?? '')) ? String(period) : ''
  const rows = []
  for (const member of members) {
    let item = duesListItem(member, today)
    if (!item) continue
    if (payMethod === 'transfer' || payMethod === 'card') {
      if (item.payMethod !== payMethod) continue
    }
    if (month) {
      const openRows = item.openRows.filter(
        (row) => row.period === month || (row.kind === 'day' && String(row.period).startsWith(month)),
      )
      if (!openRows.length) continue
      const openAmount = Math.round(openRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * 100) / 100
      item = {
        ...item,
        openRows,
        openPeriods: openRows.map((row) => row.period),
        openCount: openRows.length,
        openAmount,
      }
    }
    if (needle) {
      const hay = `${item.firstName} ${item.lastName} ${item.email} ${item.phone} ${item.planName}`.toLowerCase()
      if (!hay.includes(needle)) continue
    }
    rows.push(item)
  }
  rows.sort((a, b) => b.openAmount - a.openAmount || String(a.lastName).localeCompare(String(b.lastName), 'de'))
  const amount = Math.round(rows.reduce((sum, row) => sum + row.openAmount, 0) * 100) / 100
  const count = rows.reduce((sum, row) => sum + row.openCount, 0)
  return { dues: rows, totals: { people: rows.length, amount, count }, period: month || null }
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
  const mandate = cleanSignature(input.mandateSignature)
  if (!mandate.ok) return mandate
  const signed = Boolean(input.mandateSigned) || Boolean(mandate.value)
  const sameAccount = current?.iban === iban
  return {
    ok: true,
    bank: {
      holder,
      iban,
      bic,
      mandateRef: current?.mandateRef || mandateRefFor(id),
      mandateSignature: mandate.value || current?.mandateSignature || '',
      mandateSignedAt: signed ? (sameAccount && current?.mandateSignedAt) || new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  }
}

function cleanSignature(raw) {
  const value = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (!value) return { ok: true, value: '' }
  if (value.length < 2 || value.length > 120) return { ok: false, error: 'signature', value: '' }
  return { ok: true, value }
}

function readPlace(raw, fallback = 'Leipzig') {
  const value = String(raw ?? fallback).trim().replace(/\s+/g, ' ') || fallback
  if (value.length < 2 || value.length > 80) return { ok: false, error: 'place' }
  return { ok: true, value }
}

function deskSignaturesReady(member) {
  if (member.docs?.contract?.path && member.email) return true
  const signature = cleanSignature(member.signature)
  const gym = cleanSignature(member.gymSignature)
  if (!signature.ok || signature.value.length < 2) return false
  if (!gym.ok || gym.value.length < 2) return false
  if (member.minor) {
    const guardian = cleanSignature(member.guardian?.signature)
    if (!guardian.ok || guardian.value.length < 2) return false
  }
  if (member.bank?.mandateSignedAt) {
    const mandate = cleanSignature(member.bank.mandateSignature)
    if (!mandate.ok || mandate.value.length < 2) return false
  }
  return true
}

function applyDeskSignatures(member, input) {
  if (input == null || typeof input !== 'object') return { ok: true, member }
  const place = readPlace(input.place, member.place || 'Leipzig')
  if (!place.ok) return place
  const signature = cleanSignature(input.signature)
  if (!signature.ok) return signature
  const gym = cleanSignature(input.gymSignature)
  if (!gym.ok) return gym
  const second = cleanSignature(input.secondGuardianSignature)
  if (!second.ok) return second
  const guardianSignature = cleanSignature(input.guardianSignature)
  if (!guardianSignature.ok) return guardianSignature
  const mandateSignature = cleanSignature(input.mandateSignature)
  if (!mandateSignature.ok) return mandateSignature
  const next = {
    ...member,
    place: place.value,
    signature: signature.value || member.signature,
    gymSignature: gym.value,
    secondGuardianSignature: second.value,
    updatedAt: new Date().toISOString(),
  }
  if (next.minor && next.guardian) {
    const has = Boolean(guardianSignature.value)
    next.guardian = {
      ...next.guardian,
      signature: guardianSignature.value,
      signedAt: has ? next.guardian.signedAt || new Date().toISOString() : next.guardian.signedAt ?? null,
      signedVia: has ? next.guardian.signedVia || 'paper' : next.guardian.signedVia ?? null,
    }
    if (has && next.status === 'received') next.status = 'active'
  }
  if (next.bank) {
    const has = Boolean(mandateSignature.value)
    next.bank = {
      ...next.bank,
      mandateSignature: mandateSignature.value,
      mandateSignedAt: has ? next.bank.mandateSignedAt || new Date().toISOString() : next.bank.mandateSignedAt ?? null,
    }
  }
  return { ok: true, member: next }
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
  const signature = cleanSignature(input.signature)
  if (!signature.ok) return signature
  const signed = Boolean(input.signed) || Boolean(signature.value)
  return {
    ok: true,
    guardian: {
      ...guardian,
      signature: signature.value || current?.signature || '',
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
  const payMethod = plan !== 'daypass' && body.payMethod === 'transfer' ? 'transfer' : 'card'
  const holderFallback = minor ? guardianRead.guardian.name : `${firstName} ${lastName}`
  const bankRead =
    plan === 'daypass' || payMethod === 'transfer' ? { ok: true, bank: null } : readBank(body.bank, null, id, holderFallback)
  if (!bankRead.ok) return bankRead
  const photo = readPhoto(body.photoData)
  if (!photo.ok) return photo
  if (!photo.photoData) return { ok: false, error: 'photo' }
  const record = {
    id,
    status: minor && !guardianRead.guardian.signedAt ? 'received' : 'active',
    plan,
    planName: meta.name,
    price: meta.price,
    termMonths: meta.months,
    fee: signupFeeFor(today, plan),
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
    payMethod,
    transfer:
      payMethod === 'transfer'
        ? {
            holder: GYM_BANK.holder,
            iban: GYM_BANK.iban,
            bic: GYM_BANK.bic,
            bank: GYM_BANK.bank,
            amount: Math.round(meta.price * 100),
          }
        : null,
    bank: bankRead.bank,
    photoData: photo.photoData,
    visitDay: visitDay || null,
    place: 'Leipzig',
    signature: `${firstName} ${lastName}`,
    gymSignature: '',
    secondGuardianSignature: '',
    consents: {},
    notes: String(body.notes ?? '').trim(),
    createdAt: new Date().toISOString(),
    source: 'admin',
  }
  record.startDate = String(body.startDate ?? '').trim() || memberStartDate(record, today)
  const signed = applyDeskSignatures(record, {
    place: body.place,
    signature: body.signature,
    gymSignature: body.gymSignature,
    secondGuardianSignature: body.secondGuardianSignature,
    guardianSignature: body.guardian?.signature,
    mandateSignature: body.bank?.mandateSignature,
  })
  if (!signed.ok) return signed
  return { ok: true, member: { ...memberFromSignup(signed.member, today), status: signed.member.status } }
}

function paperReturnRecord(issuedRows) {
  const rows = (issuedRows ?? []).filter((row) => row?.email)
  const preferred = rows.slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))[0]
  if (!preferred) return null
  const { firstName, lastName } = splitPersonName(preferred.name)
  if (!isValidName(firstName) || !isValidName(lastName)) return null
  const slot = Number(preferred.slot)
  const deferred = contractStart(preferred.start)
  return {
    firstName,
    lastName,
    email: normalizeEmail(preferred.email),
    plan: 'first50',
    planName: 'First 50',
    price: 89.99,
    termMonths: contractTerm(preferred.term) || 24,
    fee: signupFeeFor(deferred || '2026-11-02', 'first50'),
    payMethod: 'transfer',
    startDate: deferred || '2026-11-02',
    inviteSlot: Number.isInteger(slot) && slot >= 1 ? slot : null,
    birthDate: '',
    street: '',
    zip: '',
    city: '',
    phone: '',
    place: 'Leipzig',
  }
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
  if (patch.status && ['received', 'active', 'paused', 'cancelled', 'withdrawn', 'expired'].includes(patch.status)) {
    next.status = patch.status
    if (patch.status === 'cancelled') {
      next.cancelledAt = new Date().toISOString()
      const info = cancelInfo({ ...next, status: 'active' }, today)
      next.cancelEffectiveOn = patch.cancelEffectiveOn || info.nextEnd || today
    }
    if (patch.status === 'withdrawn') {
      next.cancelledAt = next.cancelledAt || new Date().toISOString()
      next.cancelEffectiveOn = today
      next.pausedUntil = null
    }
    if (patch.status === 'paused') {
      next.pausedUntil = String(patch.pausedUntil ?? '') || null
      const waived = waiveFuturePayments(next, today)
      next.payments = waived.payments
      next.updatedAt = waived.updatedAt
    }
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
  if (patch.signatures && typeof patch.signatures === 'object') {
    const signed = applyDeskSignatures(next, patch.signatures)
    if (!signed.ok) return signed
    Object.assign(next, signed.member)
  }
  if (typeof patch.stripeCustomerId === 'string') {
    const customerId = patch.stripeCustomerId.trim()
    if (customerId && !/^cus_[A-Za-z0-9]{6,40}$/.test(customerId)) return { ok: false, error: 'stripe' }
    next.stripe = customerId ? { ...(next.stripe ?? {}), customerId } : null
  }
  next.updatedAt = new Date().toISOString()
  return { ok: true, member: ensurePayments(next, today) }
}

export function createAdminHandler({
  dataDir,
  env,
  fetchImpl = fetch,
  sendMail = sendMembershipEmails,
  sendPayLink = sendPayLinkEmail,
  sendReminder = sendReminderEmail,
  sendBroadcast = sendBroadcastEmail,
  deliverInvite = deliverFirst50Invite,
}) {
  const store = createMemberStore({ dataDir, env })
  const preregs = createPreregStore({ dataDir, env })
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

      const proofOk = secretsEqual(String(body.proof ?? ''), env.SIGNUP_MAIL_PROOF?.trim() || '')
      const proofSend =
        (action === 'sendContract' ||
          action === 'sendPayLink' ||
          action === 'sendPriceNote' ||
          action === 'sendPaperReturn' ||
          action === 'sendReminder' ||
          action === 'sendFirst50' ||
          action === 'sendPlusInvite' ||
          action === 'revokeInvite') &&
        proofOk
      if (!authed(req) && !proofSend) {
        json(res, 401, { ok: false, error: 'auth' })
        return
      }

      if (action === 'sendFirst50' || action === 'sendPlusInvite') {
        const email = normalizeEmail(body.email)
        const name = normalizePersonName(body.name)
        const start = body.start ? contractStart(body.start) : ''
        const plan = action === 'sendPlusInvite' || body.plan === PLUS_ID ? PLUS_ID : FIRST50_ID
        if (!isValidEmail(email) || name.length < 3) {
          json(res, 400, { ok: false, error: name.length < 3 ? 'name' : 'email' })
          return
        }
        if (body.start && !start) {
          json(res, 400, { ok: false, error: 'start' })
          return
        }
        if (plan === PLUS_ID && !start) {
          json(res, 400, { ok: false, error: 'start' })
          return
        }
        if (membershipTaken((await store.load()).members ?? [], email)) {
          json(res, 409, { ok: false, error: 'duplicate' })
          return
        }
        const now = new Date().toISOString()
        const freshUntil = Date.now() - INVITE_TTL_HOURS * 60 * 60 * 1000
        let reserved = null
        await store.update((db) => {
          const issued = Array.isArray(db.issuedFirst50) ? db.issuedFirst50 : []
          db.issuedFirst50 = issued
          const open = issued.find(
            (row) =>
              row?.email === email &&
              Date.parse(row.at || '') > freshUntil &&
              (row?.plan || FIRST50_ID) === plan,
          )
          if (open) {
            reserved = { ok: false, error: 'invite_open' }
            return db
          }
          const slot = nextFirst50Slot(db.members, issued.map((row) => row?.slot))
          if (!slot) {
            reserved = { ok: false, error: 'full' }
            return db
          }
          issued.push({
            slot,
            email,
            name,
            at: now,
            plan,
            ...(start ? { start } : {}),
          })
          reserved = { ok: true, slot }
          return db
        })
        if (!reserved?.ok) {
          json(res, 409, { ok: false, error: reserved?.error || 'full' })
          return
        }
        const lastChance = plan === FIRST50_ID && body.lastChance === true
        const mailed = await deliverInvite({
          env,
          fetchImpl,
          email,
          name,
          slot: reserved.slot,
          plan,
          start,
          lastChance,
        })
        if (!mailed?.ok) {
          await store.update((db) => {
            db.issuedFirst50 = (db.issuedFirst50 ?? []).filter((row) => !(row?.email === email && row?.at === now))
            return db
          })
          json(res, mailed?.error === 'mail_off' ? 503 : 502, { ok: false, error: mailed?.error || 'mail' })
          return
        }
        if (lastChance) {
          await store.update((db) => {
            db.issuedFirst50 = (db.issuedFirst50 ?? []).map((row) => {
              if (normalizeEmail(row?.email) !== email || Number(row?.slot) !== reserved.slot) return row
              return { ...row, lastChance: true, lastChanceAt: now }
            })
            return db
          })
        }
        json(res, 200, { ok: true, email, slot: reserved.slot, plan, lastChance, ...(start ? { start } : {}) })
        return
      }

      if (action === 'revokeInvite') {
        const email = normalizeEmail(body.email)
        const slot = Number(body.slot)
        if (!isValidEmail(email) || !Number.isInteger(slot) || slot < 1) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        const at = new Date().toISOString()
        await store.update((db) => {
          const revoked = Array.isArray(db.revokedInvites) ? db.revokedInvites : []
          const exists = revoked.some(
            (row) => normalizeEmail(row?.email) === email && Number(row?.slot) === slot,
          )
          if (!exists) revoked.push({ email, slot, at, reason: String(body.reason || 'desk') })
          db.revokedInvites = revoked
          return db
        })
        json(res, 200, { ok: true, email, slot })
        return
      }

      if (action === 'create') {
        const made = createDeskMember(body, today)
        if (!made.ok) {
          json(res, 400, { ok: false, error: made.error })
          return
        }
        let created = null
        await store.update((db) => {
          if (membershipTaken(db.members, made.member.email)) {
            created = { ok: false, error: 'duplicate' }
            return db
          }
          db.members.push(made.member)
          created = { ok: true, member: made.member }
          return db
        })
        if (!created?.ok) {
          json(res, 409, { ok: false, error: created?.error || 'duplicate' })
          return
        }
        let member = created.member
        if (member.payMethod === 'transfer') {
          try {
            member = await attachTransferNotice(store, member)
          } catch (error) {
            console.error('[admin] transfer notice skipped', error)
          }
        }
        json(res, 200, { ok: true, member: publicMember(member, today, true) })
        return
      }

      if (action === 'sendContract') {
        let id = String(body.id ?? '')
        if (!id && proofOk) {
          const wanted = normalizePersonName(body.name).toLocaleLowerCase('de-DE')
          if (wanted.length < 3) {
            json(res, 400, { ok: false, error: 'name' })
            return
          }
          const found = (await store.load()).members.filter((row) => {
            const full = normalizePersonName(`${row.firstName ?? ''} ${row.lastName ?? ''}`).toLocaleLowerCase('de-DE')
            return full === wanted
          })
          if (found.length === 0) {
            json(res, 404, { ok: false, error: 'missing' })
            return
          }
          if (found.length > 1) {
            json(res, 409, { ok: false, error: 'duplicate' })
            return
          }
          id = found[0].id
        }
        let prepared = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          const applied = applyDeskSignatures(db.members[index], body.signatures)
          if (!applied.ok) {
            prepared = applied
            return db
          }
          if (!deskSignaturesReady(applied.member)) {
            prepared = { ok: false, error: 'signature' }
            return db
          }
          db.members[index] = applied.member
          prepared = { ok: true, member: applied.member }
          return db
        })
        if (!prepared) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (!prepared.ok) {
          json(res, 400, { ok: false, error: prepared.error })
          return
        }
        const current = prepared.member
        const extra = []
        const uploaded = current.docs?.contract
        if (uploaded?.path) {
          try {
            const bytes = await store.getDoc(uploaded.path)
            if (bytes?.length) {
              extra.push({
                name: uploaded.name || 'Unterschriebener-Vertrag.pdf',
                content: Buffer.from(bytes).toString('base64'),
              })
            }
          } catch (error) {
            console.error('[admin] signed contract attachment skipped', error)
          }
        }
        const mailRecord = extra.length ? { ...current, signedUploadName: extra[0].name } : current
        let mailed
        try {
          mailed = await sendMail(env, mailRecord, {
            paper: current.source === 'admin',
            creditorId: env.SEPA_CREDITOR_ID?.trim() || '',
            extra,
          })
        } catch (error) {
          console.error('[admin] contract mail failed', error)
          json(res, 502, { ok: false, error: 'mail' })
          return
        }
        if (!mailed || mailed.member === 'skipped') {
          json(res, 503, { ok: false, error: 'mail_off' })
          return
        }
        const at = new Date().toISOString()
        let saved = current
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          db.members[index] = { ...db.members[index], contractMail: 'sent', contractMailAt: at, updatedAt: at }
          saved = db.members[index]
          return db
        })
        if (proofOk) {
          json(res, 200, { ok: true, email: saved.email, contract: Boolean(saved.docs?.contract?.path) })
          return
        }
        json(res, 200, { ok: true, member: publicMember(saved, today, true) })
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

      if (action === 'stripeLink') {
        const id = String(body.id ?? '')
        const current = (await store.load()).members.find((row) => row.id === id)
        if (!current) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (current.plan === 'daypass') {
          json(res, 400, { ok: false, error: 'stripe_early' })
          return
        }
        if (current.stripe?.subscriptionId) {
          json(res, 409, { ok: false, error: 'stripe_exists' })
          return
        }
        const secretKey = env.STRIPE_SECRET_KEY?.trim() || ''
        if (!secretKey) {
          json(res, 503, { ok: false, error: 'stripe_off' })
          return
        }
        const session = await createCheckoutSession({
          secret: secretKey,
          member: current,
          origin: siteOrigin(req, env),
          fetchImpl,
        })
        if (!session.ok || !session.url) {
          console.error('[admin] stripe checkout failed', session.detail || session.error)
          json(res, 502, { ok: false, error: session.skipped ? 'stripe_early' : 'stripe_fail' })
          return
        }
        let saved = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          db.members[index] = {
            ...db.members[index],
            stripe: {
              ...(db.members[index].stripe ?? {}),
              checkoutSessionId: session.id,
              billingStart: session.billingStart || BILLING_START,
              chargeNow: Boolean(session.chargeNow),
              delay: session.delay,
            },
            updatedAt: new Date().toISOString(),
          }
          saved = db.members[index]
          return db
        })
        if (!saved) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        json(res, 200, { ok: true, checkoutUrl: session.url, member: publicMember(saved, today, true) })
        return
      }

      if (action === 'sendPriceNote') {
        let id = String(body.id ?? '')
        if (!id && proofOk) {
          const wanted = normalizePersonName(body.name).toLocaleLowerCase('de-DE')
          if (wanted.length < 3) {
            json(res, 400, { ok: false, error: 'name' })
            return
          }
          const found = (await store.load()).members.filter((row) => {
            const full = normalizePersonName(`${row.firstName ?? ''} ${row.lastName ?? ''}`).toLocaleLowerCase('de-DE')
            return full === wanted && row.status !== 'cancelled' && row.status !== 'withdrawn'
          })
          if (found.length === 0) {
            json(res, 404, { ok: false, error: 'missing' })
            return
          }
          if (found.length > 1) {
            json(res, 409, { ok: false, error: 'duplicate' })
            return
          }
          id = found[0].id
        }
        const current = (await store.load()).members.find((row) => row.id === id)
        if (!current) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (current.payMethod !== 'transfer') {
          json(res, 400, { ok: false, error: 'pay' })
          return
        }
        let mailed
        try {
          mailed = await sendPriceChangeEmail(env, current)
        } catch (error) {
          console.error('[admin] price note failed', error)
          json(res, 502, { ok: false, error: 'mail' })
          return
        }
        if (!mailed || mailed === 'skipped') {
          json(res, 503, { ok: false, error: 'mail_off' })
          return
        }
        const at = new Date().toISOString()
        let saved = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          db.members[index] = { ...db.members[index], priceNote: 'sent', priceNoteAt: at, updatedAt: at }
          saved = db.members[index]
          return db
        })
        json(res, 200, {
          ok: true,
          email: current.email,
          price: current.price,
          member: saved ? publicMember(saved, today, true) : undefined,
        })
        return
      }

      if (action === 'sendPaperReturn') {
        const email = normalizeEmail(body.email)
        if (!isValidEmail(email)) {
          json(res, 400, { ok: false, error: 'email' })
          return
        }
        const loaded = await store.load()
        if (membershipTaken(loaded.members, email)) {
          json(res, 409, { ok: false, error: 'duplicate' })
          return
        }
        const issued = (loaded.issuedFirst50 ?? []).filter((row) => normalizeEmail(row?.email) === email)
        const record = paperReturnRecord(issued)
        if (!record) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        let mailed
        try {
          mailed = await sendPaperReturnEmail(env, record)
        } catch (error) {
          console.error('[admin] paper return failed', error)
          json(res, 502, { ok: false, error: 'mail' })
          return
        }
        if (!mailed || mailed === 'skipped') {
          json(res, 503, { ok: false, error: 'mail_off' })
          return
        }
        const at = new Date().toISOString()
        await store.update((db) => {
          db.issuedFirst50 = (db.issuedFirst50 ?? []).map((row) => {
            if (normalizeEmail(row?.email) !== email) return row
            return { ...row, paperMail: 'sent', paperMailAt: at }
          })
          return db
        })
        json(res, 200, { ok: true, email: record.email, name: `${record.firstName} ${record.lastName}`, price: record.price })
        return
      }

      if (action === 'sendPayLink') {
        let id = String(body.id ?? '')
        if (!id && proofOk) {
          const wanted = normalizePersonName(body.name).toLocaleLowerCase('de-DE')
          if (wanted.length < 3) {
            json(res, 400, { ok: false, error: 'name' })
            return
          }
          const found = (await store.load()).members.filter((row) => {
            const full = normalizePersonName(`${row.firstName ?? ''} ${row.lastName ?? ''}`).toLocaleLowerCase('de-DE')
            return full === wanted && row.status !== 'cancelled' && row.status !== 'withdrawn' && row.status !== 'expired'
          })
          if (found.length === 0) {
            json(res, 404, { ok: false, error: 'missing' })
            return
          }
          if (found.length > 1) {
            json(res, 409, { ok: false, error: 'duplicate' })
            return
          }
          id = found[0].id
        }
        const current = (await store.load()).members.find((row) => row.id === id)
        if (!current) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (current.plan === 'daypass' || current.payMethod === 'transfer') {
          json(res, 400, { ok: false, error: 'pay' })
          return
        }
        if (current.stripe?.subscriptionId) {
          json(res, 409, { ok: false, error: 'stripe_exists' })
          return
        }
        const secretKey = env.STRIPE_SECRET_KEY?.trim() || ''
        if (!secretKey) {
          json(res, 503, { ok: false, error: 'stripe_off' })
          return
        }
        const session = await createCheckoutSession({
          secret: secretKey,
          member: current,
          origin: siteOrigin(req, env),
          fetchImpl,
        })
        if (!session.ok || !session.url) {
          console.error('[admin] pay link failed', session.detail || session.error)
          json(res, 502, { ok: false, error: session.skipped ? 'stripe_early' : 'stripe_fail' })
          return
        }
        let saved = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          db.members[index] = {
            ...db.members[index],
            stripe: {
              ...(db.members[index].stripe ?? {}),
              checkoutSessionId: session.id,
              billingStart: session.billingStart || BILLING_START,
              chargeNow: Boolean(session.chargeNow),
              delay: session.delay,
            },
            updatedAt: new Date().toISOString(),
          }
          saved = db.members[index]
          return db
        })
        if (!saved) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        let mailed
        try {
          mailed = await sendPayLink(env, saved, session.url)
        } catch (error) {
          console.error('[admin] pay link mail failed', error)
          json(res, 502, { ok: false, error: 'mail' })
          return
        }
        if (!mailed || mailed === 'skipped') {
          json(res, 503, { ok: false, error: 'mail_off' })
          return
        }
        const at = new Date().toISOString()
        let mailedMember = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          db.members[index] = { ...db.members[index], payLinkAt: at, updatedAt: at }
          mailedMember = db.members[index]
          return db
        })
        json(res, 200, {
          ok: true,
          email: saved.email,
          checkoutUrl: session.url,
          member: mailedMember ? publicMember(mailedMember, today, true) : publicMember(saved, today, true),
        })
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
              kind: body.kind === 'day' ? 'day' : body.kind === 'fee' ? 'fee' : 'month',
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

      if (action === 'payOpen') {
        const id = String(body.id ?? '')
        let saved = null
        let marked = 0
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          let next = db.members[index]
          const dues = openDuesOf(next, today)
          for (const row of dues.openRows) {
            next = setPayment(
              next,
              {
                period: row.period,
                kind: row.kind === 'day' ? 'day' : row.kind === 'fee' ? 'fee' : 'month',
                status: 'paid',
                note: String(body.note ?? 'Tresen: offene Beiträge ausgeglichen'),
              },
              today,
            )
            marked += 1
          }
          db.members[index] = next
          saved = next
          return db
        })
        if (!saved) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        json(res, 200, { ok: true, marked, member: publicMember(saved, today, true) })
        return
      }

      if (action === 'payBulk') {
        const period = String(body.period ?? '')
        if (!/^\d{4}-\d{2}$/.test(period)) {
          json(res, 400, { ok: false, error: 'period' })
          return
        }
        const method =
          body.payMethod === 'transfer' || body.payMethod === 'card' ? body.payMethod : ''
        let marked = 0
        let people = 0
        await store.update((db) => {
          for (let index = 0; index < db.members.length; index += 1) {
            const row = db.members[index]
            if (method && row.payMethod !== method) continue
            const dues = openDuesOf(row, today)
            const rows = dues.openRows.filter(
              (item) => item.period === period || (item.kind === 'day' && String(item.period).startsWith(period)),
            )
            if (!rows.length) continue
            let next = row
            for (const item of rows) {
              next = setPayment(
                next,
                {
                  period: item.period,
                  kind: item.kind === 'day' ? 'day' : item.kind === 'fee' ? 'fee' : 'month',
                  status: 'paid',
                  note: String(body.note ?? `Tresen: Sammelausgleich ${period}`),
                },
                today,
              )
              marked += 1
            }
            db.members[index] = next
            people += 1
          }
          return db
        })
        json(res, 200, { ok: true, period, payMethod: method || null, marked, people })
        return
      }

      if (action === 'runDueReminders') {
        const result = await runDueReminders({
          store,
          env,
          today,
          sendReminder,
          stage: REMINDER_STAGES.includes(body.stage) ? body.stage : 'auto',
          payMethod: body.payMethod === 'card' ? 'card' : body.payMethod === '' ? '' : 'transfer',
        })
        json(res, 200, result)
        return
      }

      if (action === 'issueReceipt') {
        const id = String(body.id ?? '')
        const period = String(body.period ?? '')
        const kind = body.kind === 'day' ? 'day' : body.kind === 'fee' ? 'fee' : 'month'
        if (!id || !period) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        let number = ''
        let saved = null
        let payment = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          const member = ensurePayments(db.members[index], today)
          const row = (member.payments ?? []).find((item) => item.period === period && item.kind === kind)
          if (!row || row.status !== 'paid') return db
          number = allocateInvoiceNumber(db, today)
          const at = new Date().toISOString()
          const nextPayments = member.payments.map((item) =>
            item.period === period && item.kind === kind
              ? { ...item, receiptNumber: number, receiptAt: at }
              : item,
          )
          db.members[index] = { ...member, payments: nextPayments, updatedAt: at }
          saved = db.members[index]
          payment = nextPayments.find((item) => item.period === period && item.kind === kind)
          return db
        })
        if (!saved || !payment || !number) {
          json(res, 400, { ok: false, error: 'receipt' })
          return
        }
        json(res, 200, {
          ok: true,
          number,
          member: publicMember(saved, today, true),
          pdfUrl: `/api/admin?id=${encodeURIComponent(id)}&pdf=receipt&period=${encodeURIComponent(period)}&kind=${encodeURIComponent(kind)}`,
        })
        return
      }

      if (action === 'bankImportPreview') {
        const csv = String(body.csv ?? '')
        const parsed = parseBankCsv(csv)
        if (!parsed.ok) {
          json(res, 400, { ok: false, error: parsed.error || 'invalid' })
          return
        }
        const db = await store.load()
        const matched = matchBankTransactions(db.members, parsed.rows, today)
        json(res, 200, {
          ok: true,
          parsed: parsed.rows.length,
          matches: matched.matches,
          unmatched: matched.unmatched,
        })
        return
      }

      if (action === 'bankImportApply') {
        const picks = Array.isArray(body.matches) ? body.matches : []
        if (!picks.length) {
          json(res, 400, { ok: false, error: 'empty' })
          return
        }
        let applied = 0
        await store.update((db) => {
          for (const pick of picks) {
            const id = String(pick.memberId ?? '')
            const period = String(pick.period ?? '')
            const kind = pick.kind === 'day' ? 'day' : pick.kind === 'fee' ? 'fee' : 'month'
            if (!id || !period) continue
            const index = db.members.findIndex((row) => row.id === id)
            if (index < 0) continue
            db.members[index] = setPayment(
              db.members[index],
              {
                period,
                kind,
                status: 'paid',
                note: `Kontoauszug ${pick.date || today}`,
                source: 'bank_csv',
                ref: `csv:${pick.txnIndex ?? applied}`,
                amount: typeof pick.amount === 'number' ? pick.amount : null,
              },
              today,
            )
            applied += 1
          }
          return db
        })
        json(res, 200, { ok: true, applied })
        return
      }

      if (action === 'broadcastPreview') {
        const audience = String(body.audience ?? 'active').trim()
        const plan = String(body.plan ?? '').trim()
        const includeDaypass = body.includeDaypass === true
        if (!['active', 'current', 'all'].includes(audience)) {
          json(res, 400, { ok: false, error: 'audience' })
          return
        }
        if (plan && !PLAN_IDS.includes(plan)) {
          json(res, 400, { ok: false, error: 'plan' })
          return
        }
        const people = broadcastRecipients((await store.load()).members ?? [], {
          audience,
          plan,
          includeDaypass,
        })
        json(res, 200, {
          ok: true,
          total: people.length,
          sample: people.slice(0, 8).map((row) => ({ name: row.name, email: row.email, plan: row.plan })),
        })
        return
      }

      if (action === 'broadcastSend') {
        if (!env.BREVO_API_KEY?.trim()) {
          json(res, 503, { ok: false, error: 'mail_off' })
          return
        }
        const payload = normalizeBroadcastPayload(body)
        if (!payload.ok) {
          json(res, 400, { ok: false, error: payload.error })
          return
        }
        if (!payload.testEmail && payload.confirm !== BROADCAST_CONFIRM) {
          json(res, 403, { ok: false, error: 'confirm' })
          return
        }
        const result = await runBroadcast({
          env,
          members: (await store.load()).members ?? [],
          payload,
          sendOne: sendBroadcast,
        })
        if (!result.ok) {
          json(
            res,
            result.error === 'confirm' ? 403 : result.error === 'no_recipients' ? 409 : 502,
            {
              ok: false,
              error: result.error || 'mail',
              sent: result.sent ?? 0,
              failed: result.failed ?? 0,
              total: result.total ?? 0,
            },
          )
          return
        }
        json(res, 200, result)
        return
      }

      if (action === 'sendReminder') {
        const id = String(body.id ?? '')
        const stage = REMINDER_STAGES.includes(body.stage) ? body.stage : 'reminder'
        const force = Boolean(body.force)
        const db = await store.load()
        const current = db.members.find((row) => row.id === id)
        if (!current) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        const dues = openDuesOf(current, today)
        if (!dues.openCount) {
          json(res, 400, { ok: false, error: 'no_open' })
          return
        }
        if (!force && dues.lastReminderAt) {
          const age = Date.now() - Date.parse(dues.lastReminderAt)
          if (Number.isFinite(age) && age < REMINDER_COOLDOWN_MS) {
            json(res, 409, { ok: false, error: 'cooldown', lastReminderAt: dues.lastReminderAt })
            return
          }
        }
        let mailed = 'skipped'
        try {
          mailed = await sendReminder(env, current, {
            stage,
            periods: dues.openPeriods,
            amount: dues.openAmount,
          })
        } catch (error) {
          console.error('[admin] reminder mail', error)
          json(res, 502, { ok: false, error: 'mail' })
          return
        }
        const at = new Date().toISOString()
        const entry = {
          at,
          stage,
          periods: dues.openPeriods,
          amount: dues.openAmount,
          email: current.email,
          mail: mailed,
        }
        let saved = null
        await store.update((fresh) => {
          const index = fresh.members.findIndex((row) => row.id === id)
          if (index < 0) return fresh
          const row = fresh.members[index]
          fresh.members[index] = {
            ...row,
            reminders: [...(row.reminders ?? []), entry].slice(-40),
            updatedAt: at,
          }
          saved = fresh.members[index]
          return fresh
        })
        if (!saved) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        json(res, 200, {
          ok: true,
          mail: mailed,
          reminder: entry,
          member: publicMember(saved, today, true),
        })
        return
      }

      if (action === 'delete') {
        const id = String(body.id ?? '')
        if (!id) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        let removed = null
        await store.update((db) => {
          const index = db.members.findIndex((row) => row.id === id)
          if (index < 0) return db
          removed = db.members[index]
          db.members.splice(index, 1)
          return db
        })
        if (!removed) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        const paths = [
          ...DOC_KINDS.map((kind) => removed.docs?.[kind]?.path).filter(Boolean),
          `mail-lock/${id}`,
        ]
        await Promise.all(paths.map((path) => store.deleteDoc(path).catch(() => undefined)))
        json(res, 200, { ok: true })
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

      if (action === 'preregImport') {
        let result = null
        await preregs.update((db) => {
          result = importPreregs(db, body.rows)
          return db
        })
        json(res, 200, { ok: true, ...result })
        return
      }

      if (action === 'preregUpdate' || action === 'preregDelete') {
        const id = String(body.id ?? '')
        let result = null
        await preregs.update((db) => {
          const index = db.entries.findIndex((row) => row.id === id)
          if (index < 0) return db
          if (action === 'preregDelete') {
            db.entries.splice(index, 1)
            result = { ok: true, entry: null }
            return db
          }
          result = patchPrereg(db.entries[index], body)
          if (result.ok) db.entries[index] = result.entry
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
        json(res, 200, { ok: true, entry: result.entry })
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

    const preregView = url.searchParams.get('prereg')
    if (preregView) {
      const { entries } = await preregs.load()
      const sorted = sortPreregs(entries)
      if (preregView === 'csv') {
        res.statusCode = 200
        res.setHeader('content-type', 'text/csv; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.setHeader('content-disposition', `attachment; filename="voranmeldungen-${today}.csv"`)
        res.end(preregCsv(sorted))
        return
      }
      json(res, 200, { ok: true, entries: sorted, stats: preregStats(entries) })
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
      let row = db.members.find((item) => item.id === id)
      if (!row) {
        json(res, 404, { ok: false, error: 'missing' })
        return
      }
      if (!url.searchParams.get('doc') && url.searchParams.get('pdf') !== 'contract') {
        try {
          row = await attachSignupDocs(store, row)
        } catch (error) {
          console.error('[admin] signup docs skipped', error)
        }
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
      if (url.searchParams.get('pdf') === 'receipt') {
        const period = String(url.searchParams.get('period') ?? '')
        const kind =
          url.searchParams.get('kind') === 'day' ? 'day' : url.searchParams.get('kind') === 'fee' ? 'fee' : 'month'
        const ready = ensurePayments(row, today)
        const payment = (ready.payments ?? []).find((item) => item.period === period && item.kind === kind)
        if (!payment || payment.status !== 'paid' || !payment.receiptNumber) {
          json(res, 404, { ok: false, error: 'receipt' })
          return
        }
        const bytes = await buildReceiptPdf(ready, payment, {
          number: payment.receiptNumber,
          issuedAt: payment.receiptAt || today,
        })
        const name = `Quittung-${payment.receiptNumber}`.replace(/[^A-Za-z0-9-]+/g, '_')
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

    if (url.searchParams.get('dues') === '1') {
      const q = String(url.searchParams.get('q') ?? '')
      const payMethod = String(url.searchParams.get('payMethod') ?? '')
      const period = String(url.searchParams.get('period') ?? '')
      const built = buildDues(db.members, { q, payMethod, period }, today)
      json(res, 200, {
        ok: true,
        store: storeKind(env),
        stats: statsOf(db.members, today),
        ...built,
      })
      return
    }

    const q = String(url.searchParams.get('q') ?? '')
      .trim()
      .toLowerCase()
    const plan = String(url.searchParams.get('plan') ?? '')
    const status = String(url.searchParams.get('status') ?? '')
    const pay = String(url.searchParams.get('pay') ?? '')
    const payMethod = String(url.searchParams.get('payMethod') ?? '')
    const joinedParam = String(url.searchParams.get('joined') ?? '')
    const joined = /^\d{4}-\d{2}$/.test(joinedParam) ? joinedParam : ''
    const members = db.members
      .filter((row) => matches(row, { q, plan, status, pay, payMethod, joined }, today))
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
