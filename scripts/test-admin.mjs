import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  addMonthsIso,
  cancelDeadlineDate,
  cancelInfo,
  memberFromSignup,
  payStatusThisMonth,
  setPayment,
  termEndDate,
} from '../server/member-model.mjs'
import { createMemberStore, ingestSignup } from '../server/member-store.mjs'
import { createAdminHandler } from '../server/admin.mjs'

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

console.log('admin tests ok')
