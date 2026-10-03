import { createHmac } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  addMonthsIso,
  cancelDeadlineDate,
  cancelInfo,
  bankMissing,
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
import { createMembershipHandler } from '../server/membership.mjs'
import { buildReport } from '../server/member-report.mjs'

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

const deskTransfer = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
  body: {
    action: 'create',
    plan: 'standard',
    payMethod: 'transfer',
    firstName: 'Lina',
    lastName: 'Berg',
    birthDate: '1992-08-08',
    email: 'lina.berg@example.com',
    phone: '+49 171 3030405',
    street: 'Wittenberger Straße 15',
    zip: '04129',
    city: 'Leipzig',
    startDate: '2026-11-02',
  },
})
assert(deskTransfer.status === 200 && deskTransfer.data.member.payMethod === 'transfer', 'desk member can pay by transfer')
assert(deskTransfer.data.member.transfer.iban === 'DE77860555921090429270', 'desk transfer stores the gym iban')
assert(!deskTransfer.data.member.bank, 'desk transfer does not invent a member iban')
assert(deskTransfer.data.member.docs.payment.name === 'Banküberweisung.pdf', 'desk transfer files the payment notice')
assert(!deskTransfer.data.member.docs.contract, 'desk contract stays for the signed paper upload')
const deskList = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
const lina = deskList.data.members.find((row) => row.email === 'lina.berg@example.com')
assert(lina && lina.payMethod === 'transfer' && !lina.bankMissing, 'desk transfer is not flagged for missing bank details')

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

const sessionEvt = await stripeCall({
  id: 'evt_cs',
  type: 'checkout.session.completed',
  data: {
    object: {
      object: 'checkout.session',
      id: 'cs_1',
      mode: 'subscription',
      payment_status: 'no_payment_required',
      customer: 'cus_TEST123456',
      subscription: 'sub_NOVEMBER',
      client_reference_id: withBank.data.member.id,
      metadata: { memberId: withBank.data.member.id },
    },
  },
})
assert(sessionEvt.data.handled && sessionEvt.data.charged === false, 'checkout links without charging')
const afterSession = (await store.load()).members.find((row) => row.id === withBank.data.member.id)
assert(afterSession.stripe.subscriptionId === 'sub_NOVEMBER', 'subscription stored')
assert(afterSession.payments.find((row) => row.period === '2026-11').status === 'paid', 'november stays as the invoice left it')

async function rawCall({ method, url, headers = {}, bytes }) {
  const req = bytes ? Readable.from([bytes]) : Readable.from([])
  Object.assign(req, { method, url, headers: { cookie, ...headers }, socket: { remoteAddress: '10.0.0.3' } })
  const { res, captured } = mockRes()
  const chunks = []
  res.end = function end(payload) {
    captured.status = this.statusCode
    chunks.push(payload)
  }
  await handle(req, res)
  const buf = chunks[0] == null ? Buffer.alloc(0) : Buffer.from(chunks[0])
  const isJson = String(captured.headers['content-type'] ?? '').includes('json')
  return { status: captured.status, headers: captured.headers, bytes: buf, data: isJson ? JSON.parse(buf.toString()) : null }
}

const pdfBytes = Buffer.from('%PDF-1.4\n% test contract\n')
const doraId = withBank.data.member.id
const beforeDocs = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
assert(beforeDocs.data.members.find((row) => row.id === doraId).contractMissing, 'desk member flags missing contract')

const fakePdf = await rawCall({
  method: 'POST',
  url: `/api/admin?upload=contract&id=${doraId}`,
  headers: { 'content-type': 'application/pdf' },
  bytes: Buffer.from('<html>nope</html>'),
})
assert(fakePdf.status === 400 && fakePdf.data.error === 'doctype', 'rejects fake pdf')

const upContract = await rawCall({
  method: 'POST',
  url: `/api/admin?upload=contract&id=${doraId}`,
  headers: { 'content-type': 'application/pdf', 'x-file-name': encodeURIComponent('Vertrag Dora.pdf') },
  bytes: pdfBytes,
})
assert(upContract.status === 200 && upContract.data.member.docs.contract.name === 'Vertrag Dora.pdf', 'contract uploaded')

const upSepa = await rawCall({
  method: 'POST',
  url: `/api/admin?upload=sepa&id=${doraId}`,
  headers: { 'content-type': 'image/jpeg' },
  bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
})
assert(upSepa.status === 200 && upSepa.data.member.docs.sepa.type === 'image/jpeg', 'sepa uploaded')

const afterDocs = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
assert(!afterDocs.data.members.find((row) => row.id === doraId).contractMissing, 'contract flag cleared')

const download = await rawCall({ method: 'GET', url: `/api/admin?id=${doraId}&doc=contract` })
assert(download.status === 200 && download.headers['content-type'] === 'application/pdf', 'doc download type')
assert(download.bytes.equals(pdfBytes), 'doc bytes roundtrip')

const noCookie = await (async () => {
  const req = Readable.from([pdfBytes])
  Object.assign(req, { method: 'POST', url: `/api/admin?upload=contract&id=${doraId}`, headers: { 'content-type': 'application/pdf' }, socket: {} })
  const { res, captured } = mockRes()
  await handle(req, res)
  return captured.status
})()
assert(noCookie === 401, 'upload needs login')

const replaced = await rawCall({
  method: 'POST',
  url: `/api/admin?upload=contract&id=${doraId}`,
  headers: { 'content-type': 'application/pdf' },
  bytes: Buffer.from('%PDF-1.7\n% second\n'),
})
assert(replaced.data.member.docs.contract.path !== upContract.data.member.docs.contract.path, 'replace makes new file')
const oldGone = await createMemberStore({ dataDir: tmp, env: {} }).getDoc(upContract.data.member.docs.contract.path)
assert(oldGone === null, 'replaced file removed')

const delDoc = await post({ action: 'deleteDoc', id: doraId, kind: 'sepa' })
assert(delDoc.status === 200 && !delDoc.data.member.docs.sepa, 'sepa doc deleted')

const kid2 = await post({
  action: 'create',
  plan: 'standard',
  firstName: 'Mia',
  lastName: 'Kurz',
  birthDate: '2011-01-01',
  email: 'mia@example.com',
  phone: '+49 171 3334456',
  guardian: { name: 'Sabine Kurz', relation: 'Mutter', phone: '+49 171 9998877', signed: false },
})
assert(kid2.data.member.status === 'received', 'second minor waits')
const kid2Up = await rawCall({
  method: 'POST',
  url: `/api/admin?upload=contract&id=${kid2.data.member.id}`,
  headers: { 'content-type': 'application/pdf' },
  bytes: pdfBytes,
})
assert(kid2Up.data.member.status === 'active' && kid2Up.data.member.guardian.signedVia === 'paper', 'signed contract activates minor')

const moved = await post({
  action: 'update',
  id: doraId,
  profile: { street: 'Karl-Liebknecht-Straße 10', zip: '04107', city: 'Leipzig', email: 'Dora.Neu@Example.com' },
})
assert(moved.status === 200 && moved.data.member.street === 'Karl-Liebknecht-Straße 10', 'address changed')
assert(moved.data.member.email === 'dora.neu@example.com', 'email normalized')
const hist = moved.data.member.history
assert(hist.some((row) => row.field === 'email' && row.from === 'dora@example.com'), 'history keeps old email')
assert(hist.some((row) => row.field === 'zip' && row.to === '04107'), 'history keeps zip')

const badMail = await post({ action: 'update', id: doraId, profile: { email: 'kaputt' } })
assert(badMail.status === 400 && badMail.data.error === 'email', 'rejects bad email')
const badZip = await post({ action: 'update', id: doraId, profile: { zip: '4107' } })
assert(badZip.status === 400 && badZip.data.error === 'address', 'rejects bad zip')

const nowMinor = await post({ action: 'update', id: doraId, profile: { birthDate: '2012-06-01' } })
assert(nowMinor.data.member.minor === true, 'birth date change recomputes minor')

const ibanSwap = await post({ action: 'update', id: doraId, bank: { iban: 'DE02120300000000202051', holder: 'Dora Lang', mandateSigned: false } })
assert(ibanSwap.data.member.history.some((row) => row.field === 'iban' && row.to.endsWith('2051')), 'iban change logged masked')
assert(!ibanSwap.data.member.history.some((row) => row.to.includes('120300000000')), 'full iban not in history')

const signupHandle = createMembershipHandler({ dataDir: tmp, env: { SIGNUP_OPEN: 'true' } })
const signupRes = mockRes()
await signupHandle(
  {
    method: 'POST',
    url: '/api/mitglied',
    headers: {},
    socket: { remoteAddress: '10.9.9.9' },
    body: {
      plan: 'flex',
      firstName: 'Olga',
      lastName: 'Online',
      birthDate: '1995-05-05',
      street: 'Wittenberger Straße 15',
      zip: '04129',
      city: 'Leipzig',
      email: 'olga.online@example.com',
      phone: '+49 171 4445566',
      place: 'Leipzig',
      signature: 'Olga Online',
      consents: { agb: true, hausordnung: true, widerruf: true, privacy: true, health: true, sign: true },
    },
  },
  signupRes.res,
)
assert(signupRes.captured.status === 200, `online signup accepted ${signupRes.captured.body}`)
const afterSignup = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
const olga = afterSignup.data.members.find((row) => row.email === 'olga.online@example.com')
assert(olga && olga.isNew && olga.planName === 'Flex', 'online signup shows up as new in admin')
assert(olga.payMethod === 'card' && !olga.bankMissing, 'card signup is marked as card, not missing bank details')
const olgaStored = (await store.load()).members.find((row) => row.id === olga.id)
assert(olgaStored.docs?.contract?.name === 'Mitgliedsvertrag.pdf', 'online card signup stores the contract')
assert(!olgaStored.docs?.payment, 'card signup has no transfer notice')

const transferRes = mockRes()
await signupHandle(
  {
    method: 'POST',
    url: '/api/mitglied',
    headers: {},
    socket: { remoteAddress: '10.9.9.10' },
    body: {
      plan: 'standard',
      payMethod: 'transfer',
      firstName: 'Heiko',
      lastName: 'Hahn',
      birthDate: '1988-03-03',
      street: 'Wittenberger Straße 15',
      zip: '04129',
      city: 'Leipzig',
      email: 'heiko.transfer@example.com',
      phone: '+49 171 7778899',
      place: 'Leipzig',
      signature: 'Heiko Hahn',
      consents: { agb: true, hausordnung: true, widerruf: true, privacy: true, health: true, sign: true },
    },
  },
  transferRes.res,
)
assert(transferRes.captured.status === 200, `transfer signup accepted ${transferRes.captured.body}`)
const transferId = JSON.parse(transferRes.captured.body).id
const bare = memberFromSignup(
  {
    id: 'bare-transfer',
    plan: 'standard',
    planName: 'Standard',
    price: 99.99,
    termMonths: 24,
    firstName: 'Mia',
    lastName: 'Alt',
    birthDate: '1991-01-01',
    email: 'mia.alt@example.com',
    phone: '+49 171 1010101',
    street: 'Wittenberger Straße 15',
    zip: '04129',
    city: 'Leipzig',
    place: 'Leipzig',
    signature: 'Mia Alt',
    payMethod: 'transfer',
    transfer: { holder: 'KONNI MMA GYM GbR', iban: 'DE77860555921090429270', bic: 'WELADE8LXXX', bank: 'Stadt- und Kreissparkasse Leipzig' },
    source: 'online',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
  '2026-10-03',
)
assert(!bankMissing(bare), 'transfer member does not need a sepa mandate')
const cardOnly = memberFromSignup(
  {
    ...bare,
    id: 'bare-card',
    email: 'mia.card@example.com',
    payMethod: 'card',
    transfer: null,
    bank: null,
  },
  '2026-10-03',
)
assert(!bankMissing(cardOnly), 'card, Apple Pay and Google Pay do not need an iban')
assert(
  bankMissing({ ...cardOnly, bank: { iban: 'DE89370400440532013000', mandateSignedAt: null } }),
  'a started sepa mandate still needs the signature',
)
await store.update((db) => {
  db.members.push(bare)
  return db
})
const transferList = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
const heiko = transferList.data.members.find((row) => row.id === transferId)
assert(heiko && heiko.payMethod === 'transfer' && !heiko.bankMissing, 'transfer signup is not flagged for missing bank details')
const heikoDetail = await call({
  method: 'GET',
  url: `/api/admin?id=${transferId}`,
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
})
assert(heikoDetail.data.member.docs.contract.name === 'Mitgliedsvertrag.pdf', 'transfer detail has the contract')
assert(heikoDetail.data.member.docs.payment.name === 'Banküberweisung.pdf', 'transfer detail has the payment notice')
assert(heikoDetail.data.member.transfer.iban === 'DE77860555921090429270', 'gym iban on the member')
const backfill = await call({
  method: 'GET',
  url: '/api/admin?id=bare-transfer',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
})
assert(backfill.data.member.docs.contract.name === 'Mitgliedsvertrag.pdf', 'opening an old transfer member stores the contract')
assert(backfill.data.member.docs.payment.name === 'Banküberweisung.pdf', 'opening an old transfer member stores the payment notice')
const backfillAgain = await call({
  method: 'GET',
  url: '/api/admin?id=bare-transfer',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.3' },
})
assert(backfillAgain.data.member.docs.contract.path === backfill.data.member.docs.contract.path, 'backfill does not replace the contract')
assert(backfillAgain.data.member.docs.payment.path === backfill.data.member.docs.payment.path, 'backfill does not replace the payment notice')
assert(afterSignup.data.stats.fresh >= 1, 'fresh stat')
const reviewed = await post({ action: 'update', id: olga.id, reviewed: true })
assert(reviewed.data.member.reviewedAt, 'marked reviewed')
const afterReview = await call({ method: 'GET', url: '/api/admin', headers: { cookie }, socket: { remoteAddress: '10.0.0.3' } })
assert(!afterReview.data.members.find((row) => row.id === olga.id).isNew, 'no longer new')

const reportMembers = [
  memberFromSignup({ id: 'r1', plan: 'standard', planName: 'Standard', price: 99.99, termMonths: 24, firstName: 'A', lastName: 'A', email: 'r1@example.com', startDate: '2026-11-02', createdAt: '2026-10-05T10:00:00.000Z', source: 'online' }, '2026-12-15'),
  memberFromSignup({ id: 'r2', plan: 'flex', planName: 'Flex', price: 109.99, termMonths: 12, firstName: 'B', lastName: 'B', email: 'r2@example.com', minor: true, startDate: '2026-11-02', createdAt: '2026-10-31T23:30:00.000Z', source: 'admin' }, '2026-12-15'),
  { ...memberFromSignup({ id: 'r3', plan: 'standard', planName: 'Standard', price: 99.99, termMonths: 24, firstName: 'C', lastName: 'C', email: 'r3@example.com', startDate: '2026-11-02', createdAt: '2026-11-10T10:00:00.000Z', source: 'online' }, '2026-12-15'), status: 'cancelled', cancelledAt: '2026-12-01T09:00:00.000Z', cancelEffectiveOn: '2028-11-01' },
  memberFromSignup({ id: 'r4', plan: 'daypass', planName: 'Day Pass', price: 19.99, termMonths: null, firstName: 'D', lastName: 'D', email: 'r4@example.com', visitDay: '2026-11-20', createdAt: '2026-11-19T10:00:00.000Z' }, '2026-12-15'),
]
reportMembers[0] = setPayment(reportMembers[0], { period: '2026-11', kind: 'month', status: 'paid' }, '2026-12-15')
reportMembers[3] = setPayment(reportMembers[3], { period: '2026-11-20', kind: 'day', status: 'paid' }, '2026-12-15')
const rep = buildReport(reportMembers, '2026', '2026-12-15')
const rOct = rep.months.find((row) => row.ym === '2026-10')
const rNov = rep.months.find((row) => row.ym === '2026-11')
const rDec = rep.months.find((row) => row.ym === '2026-12')
assert(rOct.signups === 1 && rNov.signups === 2, 'signups by Berlin month (31.10. 23:30 UTC is November)')
assert(rNov.desk === 1 && rNov.minors === 1, 'desk and minor split')
assert(rDec.cancellations === 1 && rDec.endings === 0, 'cancellation received, not yet ended')
assert(rNov.daypasses === 1 && rNov.dayRevenue === 19.99, 'day pass counted by visit day')
assert(rNov.stock === 3 && rOct.stock === 0, 'stock at month end')
assert(rNov.paid === 99.99 && rNov.openCount === 2, 'payments paid and open')
assert(rep.totals.signups === 3, 'year total')

const suggestions = toSuggestions([
  { properties: { type: 'house', street: 'Wittenberger Straße', housenumber: '15', postcode: '04129', city: 'Leipzig', countrycode: 'DE' } },
  { properties: { type: 'house', street: 'Wittenberger Straße', housenumber: '15', postcode: '04129', city: 'Leipzig', countrycode: 'DE' } },
  { properties: { type: 'street', name: 'Karl-Liebknecht-Straße', postcode: '04107', city: 'Leipzig', countrycode: 'DE' } },
  { properties: { type: 'street', name: 'Wiener Straße', postcode: '1010', city: 'Wien', countrycode: 'AT' } },
])
assert(suggestions.length === 2, 'address dedupe and DE only')
assert(suggestions[1].street === 'Karl-Liebknecht-Straße' && suggestions[1].housenumber === '', 'street suggestion')

const off = await post({ action: 'stripeLink', id: kid.data.member.id })
assert(off.status === 503 && off.data.error === 'stripe_off', 'link needs stripe key')

const capturedCheckout = []
const stripeAdmin = createAdminHandler({
  dataDir: tmp,
  env: { ADMIN_SECRET: secret, STRIPE_SECRET_KEY: 'sk_test_example' },
  fetchImpl: async (_url, init) => {
    capturedCheckout.push(String(init.body))
    return {
      ok: true,
      async json() {
        return { id: 'cs_test_link', url: 'https://checkout.stripe.com/c/pay/cs_test_link' }
      },
    }
  },
})
const linkCall = await (async () => {
  const { res, captured } = mockRes()
  await stripeAdmin(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie },
      socket: { remoteAddress: '10.0.0.3' },
      body: { action: 'stripeLink', id: withBank.data.member.id },
    },
    res,
  )
  return { status: captured.status, data: JSON.parse(captured.body) }
})()
assert(linkCall.status === 409 && linkCall.data.error === 'stripe_exists', 'no second subscription')

const fresh = await post({
  action: 'create',
  plan: 'first50',
  firstName: 'Niko',
  lastName: 'Berg',
  birthDate: '1991-01-01',
  email: 'niko@example.com',
  phone: '+49 171 4445566',
})
const freshLink = await (async () => {
  const { res, captured } = mockRes()
  await stripeAdmin(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie, 'content-type': 'application/json' },
      socket: { remoteAddress: '10.0.0.3' },
      body: { action: 'stripeLink', id: fresh.data.member.id },
    },
    res,
  )
  return { status: captured.status, data: JSON.parse(captured.body) }
})()
assert(freshLink.status === 200 && freshLink.data.checkoutUrl.includes('checkout.stripe.com'), 'admin payment link')
assert(freshLink.data.member.stripe.billingStart === '2026-11-01', 'first charge stored as november')
assert(freshLink.data.member.stripe.chargeNow === false, 'nothing charged now')
const posted = new URLSearchParams(capturedCheckout.at(-1) || '')
assert(posted.get('subscription_data[trial_end]'), 'trial until november')
assert(posted.get('line_items[0][price_data][unit_amount]') === '8999', 'first50 cents')
assert(posted.get('payment_method_types[0]') === 'card' && !posted.get('payment_method_types[1]'), 'card only')
assert(posted.get('line_items[0][price_data][recurring][interval]') === 'month', 'monthly')
assert(posted.get('subscription_data[proration_behavior]') == null, 'no proration before november')

const dropId = fresh.data.member.id
const docPath = `${dropId}/contract-1.pdf`
await store.putDoc(docPath, Buffer.from('%PDF-1.4 test'), 'application/pdf')
await store.update((db) => {
  const row = db.members.find((item) => item.id === dropId)
  row.docs = {
    ...(row.docs ?? {}),
    contract: { path: docPath, name: 'Vertrag.pdf', type: 'application/pdf', size: 12, uploadedAt: '2026-10-03T12:00:00.000Z' },
  }
  return db
})
const beforeDelete = await store.load()
const beforeCount = beforeDelete.members.length
const deleted = await post({ action: 'delete', id: dropId })
assert(deleted.status === 200 && deleted.data.ok, 'delete member')
const afterDelete = await store.load()
assert(afterDelete.members.length === beforeCount - 1, 'one member removed')
assert(!afterDelete.members.some((row) => row.id === dropId), 'deleted member is gone')
assert(afterDelete.members.some((row) => row.email === 'anna@example.com'), 'other members stay')
assert((await store.getDoc(docPath)) == null, 'uploaded contract is removed')
const missingDelete = await post({ action: 'delete', id: 'does-not-exist' })
assert(missingDelete.status === 404 && missingDelete.data.error === 'missing', 'delete missing member')
const deniedDelete = await call({
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.9.9.9' },
  body: { action: 'delete', id: 'm1' },
})
assert(deniedDelete.status === 401 && deniedDelete.data.error === 'auth', 'delete needs login')
const stillThere = await store.load()
assert(stillThere.members.some((row) => row.id === 'm1'), 'unauthenticated delete does not remove')

console.log('admin tests ok')
