import { createHmac } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  addMonthsIso,
  cancelDeadlineDate,
  cancelInfo,
  isValidIban,
  memberFromSignup,
  payStatusThisMonth,
  setPayment,
  termEndDate,
} from '../server/member-model.mjs'
import { createMemberStore, ingestSignup } from '../server/member-store.mjs'
import { createAdminHandler } from '../server/admin.mjs'
import { createStripeHandler } from '../server/stripe.mjs'
import { toSuggestions } from '../server/address.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(termEndDate('2026-11-02', 24) === '2028-11-01', '24 month term end')
assert(cancelDeadlineDate('2026-11-02', 24) === '2028-10-01', '24 month cancel deadline')
assert(termEndDate('2026-11-02', 12) === '2027-11-01', '12 month term end')
assert(addMonthsIso('2026-01-31', 1) === '2026-02-28', 'month clamp')

const standard = memberFromSignup({
  id: 'm1',
  status: 'active',
  plan: 'standard',
  planName: 'Standard',
  price: 99.99,
  termMonths: 24,
  fee: 0,
  firstName: 'Anna',
  lastName: 'Müller',
  birthDate: '1994-04-12',
  email: 'anna@example.com',
  phone: '+49 171 1234567',
  startDate: '2026-11-02',
  createdAt: '2026-09-29T10:00:00.000Z',
  source: 'online',
})

const beforeOpen = cancelInfo(standard, '2026-12-01')
assert(beforeOpen.canCancelNow === true, 'can cancel during window')
assert(beforeOpen.nextEnd === '2028-11-01', 'next end is term end')
assert(beforeOpen.deadline === '2028-10-01', 'deadline')

const locked = cancelInfo(standard, '2028-10-15')
assert(locked.canCancelNow === false, 'missed min-term cancel')

const rolling = cancelInfo(standard, '2028-11-15')
assert(rolling.canCancelNow === true, 'rolling after term')
assert(rolling.nextEnd === '2028-12-15', 'one month notice')

const day = memberFromSignup({
  id: 'd1',
  plan: 'daypass',
  planName: 'Day Pass',
  price: 19.99,
  termMonths: null,
  firstName: 'Ben',
  lastName: 'Berg',
  email: 'ben@example.com',
  phone: '+49 171 7654321',
  visitDay: '2026-11-03',
  createdAt: '2026-09-29T10:00:00.000Z',
})
assert(day.startDate === '2026-11-03', 'day start is visit day')
assert(payStatusThisMonth(day, '2026-11-03') === 'open', 'day pass unpaid')
const paidDay = setPayment(day, { period: '2026-11-03', kind: 'day', status: 'paid' }, '2026-11-03')
assert(payStatusThisMonth(paidDay, '2026-11-03') === 'paid', 'day pass paid')

const tmp = mkdtempSync(join(tmpdir(), 'konni-admin-'))
const store = createMemberStore({ dataDir: tmp, env: {} })
await ingestSignup(store, standard)
const loaded = await store.load()
assert(loaded.members.length === 1, 'ingested')
assert(loaded.members[0].email === 'anna@example.com', 'email kept')

const secret = 'test-admin-secret-key'
const handle = createAdminHandler({ dataDir: tmp, env: { ADMIN_SECRET: secret } })

function mockRes() {
  const captured = { status: 0, body: '', headers: {} }
  const res = {
    get headersSent() {
      return captured.status !== 0
    },
    statusCode: 0,
    setHeader(key, value) {
      captured.headers[String(key).toLowerCase()] = value
    },
    end(payload) {
      captured.status = this.statusCode
      captured.body = String(payload ?? '')
    },
  }
  return { res, captured }
}

async function call(req) {
  const { res, captured } = mockRes()
  await handle(req, res)
  return { status: captured.status, data: captured.body ? JSON.parse(captured.body) : {}, headers: captured.headers }
}

const denied = await call({
  method: 'GET',
  url: '/api/admin',
  headers: { cookie: '' },
  socket: { remoteAddress: '127.0.0.1' },
})
assert(denied.status === 401 && denied.data.error === 'auth', 'admin needs login')

const badLogin = await call({
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.0.0.2' },
  body: { action: 'login', password: 'nope-nope-nope-nope' },
})
assert(badLogin.status === 403, 'bad password')

const login = await call({
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.0.0.3' },
  body: { action: 'login', password: secret },
})
assert(login.status === 200 && login.data.ok, 'login ok')
const cookie = String(login.headers['set-cookie'] || '')
assert(cookie.includes('konni_admin='), 'session cookie')

const list = await call({
  method: 'GET',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
})
assert(list.status === 200 && list.data.members.length === 1, 'lists ingested member')
assert(list.data.members[0].cancel.deadline === '2028-10-01', 'list has cancel date')

const created = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
  body: {
    action: 'create',
    plan: 'flex',
    firstName: 'Clara',
    lastName: 'Koch',
    birthDate: '1990-02-02',
    email: 'clara@example.com',
    phone: '+49 171 1112233',
    street: 'Wittenberger Straße 15',
    zip: '04129',
    city: 'Leipzig',
    startDate: '2026-11-02',
  },
})
assert(created.status === 200 && created.data.member.plan === 'flex', 'desk create')
assert(created.data.member.cancel.termEnd === '2027-11-01', 'flex term')

const pay = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
  body: {
    action: 'pay',
    id: created.data.member.id,
    period: '2026-11',
    kind: 'month',
    status: 'paid',
  },
})
assert(pay.status === 200, 'mark paid')
assert(pay.data.member.payments.some((row) => row.status === 'paid'), 'has paid row')

assert(isValidIban('DE89 3704 0044 0532 0130 00'), 'valid iban')
assert(!isValidIban('DE89 3704 0044 0532 0130 01'), 'checksum iban')
assert(!isValidIban('DE89370400440532'), 'short iban')

async function post(body) {
  return await call({ method: 'POST', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' }, body })
}

const badIban = await post({
  action: 'create',
  plan: 'standard',
  firstName: 'Dora',
  lastName: 'Lang',
  birthDate: '1992-03-03',
  email: 'dora@example.com',
  phone: '+49 171 2223344',
  bank: { iban: 'DE00 1234', holder: 'Dora Lang' },
})
assert(badIban.status === 400 && badIban.data.error === 'iban', 'rejects bad iban')

const withBank = await post({
  action: 'create',
  plan: 'standard',
  firstName: 'Dora',
  lastName: 'Lang',
  birthDate: '1992-03-03',
  email: 'dora@example.com',
  phone: '+49 171 2223344',
  photoData: 'data:image/jpeg;base64,AAAA',
  bank: { iban: 'de89 3704 0044 0532 0130 00', holder: '', mandateSigned: true },
})
assert(withBank.status === 200, 'desk create with bank')
assert(withBank.data.member.bank.iban === 'DE89370400440532013000', 'iban normalized')
assert(withBank.data.member.bank.holder === 'Dora Lang', 'holder defaults to member')
assert(withBank.data.member.bank.mandateRef.startsWith('KONNI-'), 'mandate ref')
assert(withBank.data.member.photoData.startsWith('data:image/'), 'photo stored on create')

const kidNoGuardian = await post({
  action: 'create',
  plan: 'flex',
  firstName: 'Emil',
  lastName: 'Kurz',
  birthDate: '2012-05-05',
  email: 'emil@example.com',
  phone: '+49 171 3334455',
})
assert(kidNoGuardian.status === 400 && kidNoGuardian.data.error === 'guardian', 'minor needs guardian')

const kid = await post({
  action: 'create',
  plan: 'flex',
  firstName: 'Emil',
  lastName: 'Kurz',
  birthDate: '2012-05-05',
  email: 'emil@example.com',
  phone: '+49 171 3334455',
  guardian: { name: 'Sabine Kurz', relation: 'Mutter', phone: '+49 171 9998877', email: '', signed: false },
  bank: { iban: 'DE89370400440532013000', mandateSigned: false },
})
assert(kid.status === 200 && kid.data.member.status === 'received', 'unsigned minor waits')
assert(kid.data.member.bank.holder === 'Sabine Kurz', 'minor holder defaults to guardian')

const kidList = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
const kidRow = kidList.data.members.find((row) => row.id === kid.data.member.id)
assert(kidRow.guardianMissing && kidRow.bankMissing, 'list flags missing guardian and mandate')
assert(kidList.data.stats.todo >= 1, 'todo stat')

const signed = await post({
  action: 'update',
  id: kid.data.member.id,
  guardian: { name: 'Sabine Kurz', relation: 'Mutter', phone: '+49 171 9998877', idChecked: true, signed: true },
})
assert(signed.status === 200 && signed.data.member.status === 'active', 'signed guardian activates')
assert(signed.data.member.guardian.signedVia === 'paper', 'paper signature')

const pdfCall = await (async () => {
  const { res, captured } = mockRes()
  const chunks = []
  res.end = function end(payload) {
    captured.status = this.statusCode
    chunks.push(payload)
  }
  await handle(
    {
      method: 'GET',
      url: `/api/admin?id=${kid.data.member.id}&pdf=contract`,
      headers: { cookie },
      socket: { remoteAddress: '10.0.0.3' },
    },
    res,
  )
  return { status: captured.status, type: captured.headers['content-type'], bytes: Buffer.from(chunks[0]) }
})()
assert(pdfCall.status === 200 && pdfCall.type === 'application/pdf', 'contract pdf served')
assert(pdfCall.bytes.subarray(0, 5).toString() === '%PDF-', 'pdf bytes')

const whsec = 'whsec_test_secret'
const stripeHandle = createStripeHandler({ dataDir: tmp, env: { STRIPE_WEBHOOK_SECRET: whsec } })

async function stripeCall(event, { sign = true } = {}) {
  const raw = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', whsec).update(`${t}.${raw}`).digest('hex')
  const { res, captured } = mockRes()
  const req = {
    method: 'POST',
    headers: { 'stripe-signature': sign ? `t=${t},v1=${sig}` : `t=${t},v1=bad` },
    rawBody: raw,
  }
  await stripeHandle(req, res)
  return { status: captured.status, data: JSON.parse(captured.body) }
}

const nov = Math.floor(Date.UTC(2026, 10, 1, 0, 0, 0) / 1000)
const invoice = (type, extra = {}) => ({
  id: 'evt_1',
  type,
  data: {
    object: {
      object: 'invoice',
      id: 'in_1',
      customer: 'cus_TEST123456',
      customer_email: 'dora@example.com',
      amount_due: 9999,
      lines: { data: [{ period: { start: nov } }] },
      ...extra,
    },
  },
})

const unsigned = await stripeCall(invoice('invoice.paid'), { sign: false })
assert(unsigned.status === 400, 'stripe rejects bad signature')

const failed = await stripeCall(invoice('invoice.payment_failed'))
assert(failed.status === 200 && failed.data.handled && failed.data.status === 'failed', 'stripe failed by email')
const afterFail = (await store.load()).members.find((row) => row.id === withBank.data.member.id)
assert(afterFail.stripe.customerId === 'cus_TEST123456', 'stripe customer linked')
assert(afterFail.payments.find((row) => row.period === '2026-11').status === 'failed', 'month red')

const paidEvt = await stripeCall(invoice('invoice.paid', { customer_email: 'other@example.com' }))
assert(paidEvt.data.handled && paidEvt.data.memberId === withBank.data.member.id, 'matched by customer id')
const afterPaid = (await store.load()).members.find((row) => row.id === withBank.data.member.id)
const novRow = afterPaid.payments.find((row) => row.period === '2026-11')
assert(novRow.status === 'paid' && novRow.source === 'stripe' && novRow.ref === 'in_1', 'month green via stripe')

const late = await stripeCall(invoice('invoice.finalized'))
assert(late.data.status === 'paid', 'late finalized does not reopen paid month')

const nobody = await stripeCall(invoice('invoice.paid', { customer: 'cus_NOBODY0000', customer_email: 'x@example.com' }))
assert(nobody.status === 200 && nobody.data.reason === 'unmatched', 'unmatched invoice acknowledged')

const suggestions = toSuggestions([
  { properties: { type: 'house', street: 'Wittenberger Straße', housenumber: '15', postcode: '04129', city: 'Leipzig', countrycode: 'DE' } },
  { properties: { type: 'house', street: 'Wittenberger Straße', housenumber: '15', postcode: '04129', city: 'Leipzig', countrycode: 'DE' } },
  { properties: { type: 'street', name: 'Karl-Liebknecht-Straße', postcode: '04107', city: 'Leipzig', countrycode: 'DE' } },
  { properties: { type: 'street', name: 'Wiener Straße', postcode: '1010', city: 'Wien', countrycode: 'AT' } },
])
assert(suggestions.length === 2, 'address dedupe and DE only')
assert(suggestions[1].street === 'Karl-Liebknecht-Straße' && suggestions[1].housenumber === '', 'street suggestion')

console.log('admin tests ok')
