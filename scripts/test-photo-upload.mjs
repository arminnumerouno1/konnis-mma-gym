import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemberStore, ingestSignup } from '../server/member-store.mjs'
import { memberFromSignup } from '../server/member-model.mjs'
import { createAdminHandler } from '../server/admin.mjs'
import {
  PHOTO_REQUEST_CONFIRM,
  createPhotoUploadHandler,
  membersMissingPortrait,
  needsPortrait,
  photoRequestMailHtml,
  signPhotoToken,
  verifyPhotoToken,
} from '../server/photo-upload.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const secret = 'test-invite-secret-key'
const token = signPhotoToken(secret, { id: 'm1', email: 'anna@example.com', nowMs: Date.now() })
const ok = verifyPhotoToken(secret, token)
assert(ok.ok && ok.payload.id === 'm1' && ok.payload.email === 'anna@example.com', 'token roundtrip')

const expired = signPhotoToken(secret, {
  id: 'm1',
  email: 'anna@example.com',
  ttlDays: 1,
  nowMs: Date.now() - 3 * 24 * 60 * 60 * 1000,
})
assert(verifyPhotoToken(secret, expired).error === 'expired', 'expired token')

const html = photoRequestMailHtml({ first: 'Anna', url: 'https://www.mma-in-leipzig.de/portrait?t=x' })
assert(html.includes('Gesichtsbild') && html.includes('Warum brauchen wir das'), 'mail explains why')
assert(html.includes('Portraitfoto hochladen'), 'mail has cta')

const withPhoto = memberFromSignup({
  id: 'p1',
  status: 'active',
  plan: 'standard',
  planName: 'Standard',
  price: 99.99,
  termMonths: 24,
  firstName: 'Mit',
  lastName: 'Foto',
  email: 'mit@example.com',
  phone: '+49 171 1111111',
  startDate: '2026-11-02',
  createdAt: '2026-09-29T10:00:00.000Z',
  photoData: 'data:image/jpeg;base64,abc',
})
const without = memberFromSignup({
  id: 'p2',
  status: 'active',
  plan: 'flex',
  planName: 'Flex',
  price: 109.99,
  termMonths: 12,
  firstName: 'Ohne',
  lastName: 'Foto',
  email: 'ohne@example.com',
  phone: '+49 171 2222222',
  startDate: '2026-11-02',
  createdAt: '2026-09-29T10:00:00.000Z',
})
const day = memberFromSignup({
  id: 'd1',
  status: 'active',
  plan: 'daypass',
  planName: 'Day Pass',
  price: 19.99,
  termMonths: null,
  firstName: 'Day',
  lastName: 'Pass',
  email: 'day@example.com',
  phone: '+49 171 3333333',
  visitDay: '2026-11-03',
  createdAt: '2026-09-29T10:00:00.000Z',
})
assert(needsPortrait(without) === true, 'needs photo')
assert(needsPortrait(withPhoto) === false, 'has photo')
assert(needsPortrait(day) === false, 'daypass skipped')
assert(membersMissingPortrait([withPhoto, without, day]).length === 1, 'missing list')

const tmp = mkdtempSync(join(tmpdir(), 'konni-photo-'))
const store = createMemberStore({ dataDir: tmp, env: {} })
await ingestSignup(store, without)

const photoHandle = createPhotoUploadHandler({
  env: { INVITE_SECRET: secret },
  store,
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
  return {
    status: captured.status,
    data: captured.body ? JSON.parse(captured.body) : {},
    headers: captured.headers,
  }
}

const uploadToken = signPhotoToken(secret, { id: without.id, email: without.email })
const lookup = await call(photoHandle, {
  method: 'GET',
  url: `/api/portrait?t=${encodeURIComponent(uploadToken)}`,
  headers: {},
})
assert(lookup.status === 200 && lookup.data.ok && lookup.data.firstName === 'Ohne', 'lookup')

const tiny = `data:image/jpeg;base64,${'A'.repeat(80)}`
const saved = await call(photoHandle, {
  method: 'POST',
  url: '/api/portrait',
  headers: {},
  body: { token: uploadToken, photoData: tiny },
})
assert(saved.status === 200 && saved.data.ok, 'upload')
const after = await store.load()
assert(after.members[0].photoData === tiny, 'stored')

const mailed = []
const adminSecret = 'test-admin-secret-key'
const admin = createAdminHandler({
  dataDir: tmp,
  env: { ADMIN_SECRET: adminSecret, INVITE_SECRET: secret, BREVO_API_KEY: 'xkeysib-test' },
  sendPhotoRequest: async (_env, member) => {
    mailed.push(member.email)
    return { ok: true }
  },
})

const login = await call(admin, {
  method: 'POST',
  url: '/api/admin',
  headers: {},
  socket: { remoteAddress: '10.0.0.8' },
  body: { action: 'login', password: adminSecret },
})
assert(login.data.ok, 'login')
const cookie = String(login.headers?.['set-cookie'] || '')

// member now has photo from upload above — need a fresh without-photo member
const second = memberFromSignup({
  id: 'p3',
  status: 'active',
  plan: 'standard',
  planName: 'Standard',
  price: 99.99,
  termMonths: 24,
  firstName: 'Noch',
  lastName: 'Ohne',
  email: 'noch@example.com',
  phone: '+49 171 4444444',
  startDate: '2026-11-02',
  createdAt: '2026-09-29T10:00:00.000Z',
})
await ingestSignup(store, second)

const one = await call(admin, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.8' },
  body: { action: 'sendPhotoRequest', id: second.id },
})
assert(one.data.ok && mailed.includes('noch@example.com'), `one request ${JSON.stringify(one.data)}`)

const blocked = await call(admin, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.8' },
  body: { action: 'sendPhotoRequestBulk', confirm: 'falsch' },
})
assert(blocked.status === 403 && blocked.data.error === 'confirm', 'confirm required')

console.log('photo-upload ok')
