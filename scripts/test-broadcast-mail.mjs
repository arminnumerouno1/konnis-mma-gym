import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAdminHandler } from '../server/admin.mjs'
import { createMemberStore, ingestSignup } from '../server/member-store.mjs'
import { memberFromSignup } from '../server/member-model.mjs'
import {
  BROADCAST_CONFIRM,
  broadcastRecipients,
  normalizeBroadcastPayload,
} from '../server/broadcast-mail.mjs'
import { broadcastMailHtml } from '../server/membership-mail.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const html = broadcastMailHtml({ first: 'Anna', body: 'Montag fällt aus.\n\nOpen Mat ab 19.' })
assert(html.includes('Hi Anna,'), 'greet')
assert(html.includes('Montag fällt aus.'), 'body1')
assert(html.includes('Open Mat ab 19.'), 'body2')
assert(html.includes('Konrad und Mehmet'), 'signoff')

const members = [
  memberFromSignup({
    id: 'a1',
    status: 'active',
    plan: 'standard',
    planName: 'Standard',
    price: 99.99,
    termMonths: 24,
    firstName: 'Anna',
    lastName: 'Aktiv',
    email: 'anna@example.com',
    phone: '+49 171 1111111',
    startDate: '2026-11-02',
    createdAt: '2026-09-29T10:00:00.000Z',
  }),
  memberFromSignup({
    id: 'p1',
    status: 'paused',
    plan: 'flex',
    planName: 'Flex',
    price: 109.99,
    termMonths: 12,
    firstName: 'Paul',
    lastName: 'Pause',
    email: 'paul@example.com',
    phone: '+49 171 2222222',
    startDate: '2026-11-02',
    createdAt: '2026-09-29T10:00:00.000Z',
  }),
  memberFromSignup({
    id: 'c1',
    status: 'cancelled',
    plan: 'standard',
    planName: 'Standard',
    price: 99.99,
    termMonths: 24,
    firstName: 'Carl',
    lastName: 'Cancel',
    email: 'carl@example.com',
    phone: '+49 171 3333333',
    startDate: '2026-11-02',
    createdAt: '2026-09-29T10:00:00.000Z',
  }),
  memberFromSignup({
    id: 'd1',
    status: 'active',
    plan: 'daypass',
    planName: 'Day Pass',
    price: 19.99,
    termMonths: null,
    firstName: 'Dana',
    lastName: 'Day',
    email: 'dana@example.com',
    phone: '+49 171 4444444',
    visitDay: '2026-11-03',
    createdAt: '2026-09-29T10:00:00.000Z',
  }),
]

assert(broadcastRecipients(members, { audience: 'active' }).length === 1, 'active only')
assert(broadcastRecipients(members, { audience: 'current' }).length === 2, 'active+paused')
assert(broadcastRecipients(members, { audience: 'all' }).length === 2, 'all without daypass')
assert(broadcastRecipients(members, { audience: 'all', includeDaypass: true }).length === 3, 'with daypass')
assert(broadcastRecipients(members, { audience: 'active', plan: 'flex' }).length === 0, 'plan filter empty')
assert(broadcastRecipients(members, { audience: 'current', plan: 'flex' }).length === 1, 'plan filter paused')
const laterStart = [
  ...members,
  {
    id: 'm4',
    firstName: 'Martin',
    lastName: 'Later',
    email: 'martin.later@example.com',
    plan: 'first50',
    status: 'active',
    startDate: '2027-01-01',
  },
]
assert(broadcastRecipients(laterStart, { audience: 'active' }).length === 2, 'later start without filter')
assert(
  broadcastRecipients(laterStart, { audience: 'active', billingUntil: '2026-11-01' }).length === 1,
  'billingUntil drops january start',
)

const bad = normalizeBroadcastPayload({ subject: '', body: 'x' })
assert(bad.ok === false && bad.error === 'subject', 'subject required')
const okPayload = normalizeBroadcastPayload({
  subject: 'Info',
  body: 'Hallo zusammen',
  audience: 'active',
  confirm: BROADCAST_CONFIRM,
})
assert(okPayload.ok, 'payload ok')

const tmp = mkdtempSync(join(tmpdir(), 'konni-broadcast-'))
const store = createMemberStore({ dataDir: tmp, env: {} })
for (const row of members) await ingestSignup(store, row)

const sent = []
const secret = 'test-admin-secret-key'
const handle = createAdminHandler({
  dataDir: tmp,
  env: { ADMIN_SECRET: secret, BREVO_API_KEY: 'test-key' },
  sendBroadcast: async (_env, mail) => {
    sent.push(mail)
    return 'sent'
  },
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

async function call(req) {
  const { res, captured } = mockRes()
  await handle(req, res)
  return { status: captured.status, data: captured.body ? JSON.parse(captured.body) : {}, headers: captured.headers }
}

const login = await call({
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.0.0.9' },
  body: { action: 'login', password: secret },
})
assert(login.status === 200 && login.data.ok, 'login')
const cookie = String(login.headers['set-cookie'] || '')

const preview = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.9' },
  body: { action: 'broadcastPreview', audience: 'active' },
})
assert(preview.data.ok && preview.data.total === 1, 'preview active')

const proofBlocked = await call({
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.0.0.19' },
  body: {
    action: 'broadcastSend',
    subject: 'Info',
    body: 'Montag fällt aus.',
    audience: 'active',
    confirm: BROADCAST_CONFIRM,
    proof: 'signup-mail-proof-test-ok24',
  },
})
assert(proofBlocked.status === 401, 'broadcast requires admin session even with proof')

const blocked = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.9' },
  body: {
    action: 'broadcastSend',
    subject: 'Info',
    body: 'Montag fällt aus.',
    audience: 'active',
    confirm: 'falsch',
  },
})
assert(blocked.status === 403 && blocked.data.error === 'confirm', 'confirm required')

sent.length = 0
const test = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.9' },
  body: {
    action: 'broadcastSend',
    subject: 'Info',
    body: 'Montag fällt aus.',
    audience: 'active',
    testEmail: 'armin@example.com',
  },
})
assert(test.data.ok && test.data.test === true && test.data.sent === 1, 'test send')
assert(sent[0].to === 'armin@example.com', 'test recipient')
assert(String(sent[0].subject).startsWith('Test:'), 'test subject prefix')

sent.length = 0
const all = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.9' },
  body: {
    action: 'broadcastSend',
    subject: 'Studio-Info',
    body: 'Montag fällt aus.\n\nOpen Mat ab 19.',
    audience: 'current',
    confirm: BROADCAST_CONFIRM,
  },
})
assert(all.data.ok && all.data.sent === 2, `broadcast sent ${all.data.sent}`)
assert(sent.length === 2, 'two mails')
assert(sent.every((row) => row.subject === 'Studio-Info'), 'subjects')

console.log('broadcast-mail ok')
