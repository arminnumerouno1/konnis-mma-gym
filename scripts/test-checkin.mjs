import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAdminHandler } from '../server/admin.mjs'
import {
  collectCheckinCodes,
  createCheckinHandler,
  createCheckinStore,
  ensureCheckinCode,
  generateCheckinCode,
  isValidCheckinCode,
  normalizeCheckinCode,
  performCheckin,
} from '../server/checkin.mjs'
import { currentSlot } from '../server/kursplan.mjs'
import { createMemberStore } from '../server/member-store.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const code = generateCheckinCode()
assert(isValidCheckinCode(code), 'generated code valid')
assert(normalizeCheckinCode(` ${code.toLowerCase()} `) === code, 'normalize uppercases')

const taken = collectCheckinCodes([{ checkinCode: code }], [])
const next = generateCheckinCode(taken)
assert(next !== code, 'unique code')

const ensured = ensureCheckinCode({ name: 'x' }, new Set([code, next]))
assert(isValidCheckinCode(ensured.checkinCode), 'ensure assigns')

{
  // Friday 18:10 Berlin ≈ Kickboxen window (depends on plan)
  const friday = new Date('2026-11-06T17:10:00.000Z') // 18:10 Berlin (CET)
  const slot = currentSlot(friday)
  assert(slot, `currentSlot finds Friday evening class, got ${slot}`)
  assert(slot.dayId === 'fr', `friday dayId, got ${slot.dayId}`)
}

{
  const early = new Date('2026-11-06T06:00:00.000Z')
  assert(currentSlot(early) == null, 'no slot early morning')
}

const tmp = mkdtempSync(join(tmpdir(), 'konni-checkin-'))
const secret = 'test-admin-secret-key-checkin'
const members = createMemberStore({ dataDir: tmp, env: {} })
const checkins = createCheckinStore({ dataDir: tmp, env: {} })

const member = ensureCheckinCode(
  {
    id: 'm-checkin-1',
    firstName: 'Alex',
    lastName: 'Check',
    email: 'alex.check@example.com',
    phone: '+491711111111',
    status: 'active',
    plan: 'standard',
    planName: 'Standard',
    price: 99.99,
    termMonths: 24,
    fee: 19.99,
    startDate: '2026-11-01',
    payMethod: 'transfer',
    payments: [{ kind: 'month', period: '2026-11', amount: 99.99, status: 'open' }],
    createdAt: new Date().toISOString(),
    source: 'admin',
  },
  new Set(),
)

await members.update((db) => {
  db.members.push(member)
  return db
})

const friday = new Date('2026-11-06T17:10:00.000Z')
const slot = currentSlot(friday)
assert(slot, 'slot for perform')

const testCode = await performCheckin(
  { members: [member], trials: [], checkins: [] },
  { code: '123456', slotId: slot.id, now: friday },
)
assert(testCode.ok && testCode.entry.name === 'Armin Test', 'fixed test code 123456')

const first = await performCheckin(
  { members: [member], trials: [], checkins: [testCode.entry] },
  { code: member.checkinCode, slotId: slot.id, now: friday },
)
assert(first.ok && !first.already, 'first checkin ok')
assert(first.entry.openDues > 0, 'open dues captured')
assert(first.entry.memberId === member.id, 'member linked')

const dup = await performCheckin(
  { members: [member], trials: [], checkins: [first.entry] },
  { code: member.checkinCode, slotId: slot.id, now: friday },
)
assert(dup.ok && dup.already, 'double scan idempotent')

await checkins.update((db) => {
  db.entries.push(first.entry)
  return db
})

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

async function call(handle, req) {
  const { res, captured } = mockRes()
  await handle(req, res)
  return { status: captured.status, data: JSON.parse(captured.body || '{}'), headers: captured.headers }
}

const handle = createCheckinHandler({ dataDir: tmp, env: {} })
const get = await call(handle, { method: 'GET', url: '/api/checkin', headers: {}, socket: { remoteAddress: '127.0.0.1' } })
assert(get.status === 200 && get.data.ok, 'checkin GET ok')
assert(Array.isArray(get.data.todaySlots), 'todaySlots array')

const postBad = await call(handle, {
  method: 'POST',
  url: '/api/checkin',
  headers: {},
  socket: { remoteAddress: '10.0.0.9' },
  body: { code: 'ZZZZZZ', slotId: slot.id },
})
assert(postBad.status === 400 && postBad.data.error === 'code', 'unknown code rejected')

const postOk = await call(handle, {
  method: 'POST',
  url: '/api/checkin',
  headers: {},
  socket: { remoteAddress: '10.0.0.10' },
  body: { code: member.checkinCode.toLowerCase(), slotId: slot.id },
})
assert(postOk.status === 200 && postOk.data.ok && postOk.data.already, 'door post finds existing')

const admin = createAdminHandler({ dataDir: tmp, env: { ADMIN_SECRET: secret } })
const login = await call(admin, {
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.0.0.11' },
  body: { action: 'login', password: secret },
})
assert(login.status === 200 && login.data.ok, 'admin login')
const cookie = String(login.headers['set-cookie'] || '')
assert(cookie.includes('konni_admin='), 'admin cookie')

const list = await call(admin, {
  method: 'GET',
  url: `/api/admin?checkins=1&day=2026-11-06&slotId=${encodeURIComponent(slot.id)}`,
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.11' },
})
assert(list.status === 200 && list.data.ok, 'admin checkins list')
assert(list.data.entries.length >= 1, 'admin sees checkin')
assert(list.data.entries[0].name.includes('Alex'), 'admin list name')
assert(list.data.checkinUrl.includes('/checkin'), 'checkin url')

const manual = await call(admin, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.11' },
  body: { action: 'checkinManual', memberId: member.id, slotId: slot.id },
})
assert(manual.status === 200 && manual.data.ok && manual.data.already, 'manual already present')

const ensure = await call(admin, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.11' },
  body: { action: 'ensureCheckinCodes' },
})
assert(ensure.status === 200 && ensure.data.ok, 'ensure codes')

console.log('test-checkin: ok')
