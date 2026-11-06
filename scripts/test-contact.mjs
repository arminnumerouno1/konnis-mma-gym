import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContactHandler, isTrialOpen, TRIAL_OPEN } from '../server/contact.mjs'
import { trialSlots } from '../server/kursplan.mjs'
import { createAdminHandler } from '../server/admin.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(TRIAL_OPEN === true, 'trial open for launch')
assert(isTrialOpen({}) === true, 'open default')
assert(isTrialOpen({ TRIAL_OPEN: 'true' }) === true, 'env override open')
assert(isTrialOpen({ TRIAL_OPEN: 'false' }) === false, 'env override closed')

const slots = trialSlots()
assert(slots.length >= 10, 'has trial slots from kursplan')
assert(slots.every((row) => row.id && row.label && row.dayId && row.time && row.title), 'slot fields')

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

const dataDir = join(tmpdir(), `konni-contact-${process.pid}-${Date.now()}`)
mkdirSync(dataDir, { recursive: true })

{
  const handle = createContactHandler({ dataDir, env: { TRIAL_OPEN: 'false' } })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: {
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        slotId: slots[0].id,
      },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 403 && parsed.ok === false && parsed.error === 'closed', 'handler rejects closed trial')
}

{
  const handle = createContactHandler({ dataDir, env: { TRIAL_OPEN: 'true' } })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.2' },
      body: {
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
      },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 400 && parsed.error === 'slot', 'slot required')
}

{
  const handle = createContactHandler({ dataDir, env: { TRIAL_OPEN: 'true' } })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.3' },
      body: {
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        slotId: 'mo|99:00|Fake',
      },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 400 && parsed.error === 'slot', 'invalid slot rejected')
}

{
  const handle = createContactHandler({ dataDir, env: { TRIAL_OPEN: 'true' } })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.4' },
      body: {
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        slotId: slots[0].id,
        note: 'Bin Anfängerin',
      },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 200 && parsed.ok === true, 'open trial accepts valid slot')
  const saved = JSON.parse(readFileSync(join(dataDir, 'trials.json'), 'utf8'))
  assert(saved.entries.length === 1, 'persisted trial')
  assert(saved.entries[0].status === 'neu', 'status neu')
  assert(saved.entries[0].slot.id === slots[0].id, 'slot stored')
  assert(saved.entries[0].note === 'Bin Anfängerin', 'note stored')
}

{
  const secret = 'test-admin-secret-16'
  const handle = createAdminHandler({ dataDir, env: { ADMIN_SECRET: secret } })
  const login = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { 'content-type': 'application/json', cookie: '' },
      socket: { remoteAddress: '127.0.0.5' },
      body: { action: 'login', password: secret },
    },
    login.res,
  )
  assert(login.captured.status === 200, `admin login ${login.captured.body}`)
  const setCookie = String(login.captured.headers['set-cookie'] || '')
  const cookie = setCookie.split(';')[0]
  assert(cookie.includes('konni_admin='), 'session cookie')

  const list = mockRes()
  await handle(
    {
      method: 'GET',
      url: '/api/admin?trials=1',
      headers: { cookie },
      socket: { remoteAddress: '127.0.0.5' },
    },
    list.res,
  )
  const listed = JSON.parse(list.captured.body)
  assert(list.captured.status === 200 && listed.ok, 'list trials')
  assert(listed.entries.length === 1 && listed.stats.fresh === 1, 'fresh count')
  const id = listed.entries[0].id

  const update = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie, 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.5' },
      body: { action: 'trialUpdate', id, status: 'gekommen' },
    },
    update.res,
  )
  const updated = JSON.parse(update.captured.body)
  assert(update.captured.status === 200 && updated.entry.status === 'gekommen', 'status gekommen')

  const again = mockRes()
  await handle(
    {
      method: 'GET',
      url: '/api/admin?trials=1',
      headers: { cookie },
      socket: { remoteAddress: '127.0.0.5' },
    },
    again.res,
  )
  const after = JSON.parse(again.captured.body)
  assert(after.stats.gekommen === 1 && after.stats.fresh === 0, 'stats after attendance')

  // Second trial: confirming sends visitor mail when Brevo is configured (skipped without key)
  const handleOpen = createContactHandler({ dataDir, env: { TRIAL_OPEN: 'true' } })
  const second = mockRes()
  await handleOpen(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.6' },
      body: {
        name: 'Ben Beispiel',
        email: 'ben@example.com',
        phone: '+49 171 9998877',
        slotId: slots[1].id,
      },
    },
    second.res,
  )
  assert(second.captured.status === 200, 'second trial saved')
  const listed2 = mockRes()
  await handle(
    {
      method: 'GET',
      url: '/api/admin?trials=1',
      headers: { cookie },
      socket: { remoteAddress: '127.0.0.5' },
    },
    listed2.res,
  )
  const rows = JSON.parse(listed2.captured.body).entries
  const ben = rows.find((row) => row.email === 'ben@example.com')
  assert(ben, 'ben found')
  const confirm = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie, 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.5' },
      body: { action: 'trialUpdate', id: ben.id, status: 'bestaetigt' },
    },
    confirm.res,
  )
  const confirmed = JSON.parse(confirm.captured.body)
  assert(confirm.captured.status === 200 && confirmed.entry.status === 'bestaetigt', 'confirm status')
  assert(confirmed.confirmMail === 'skipped' || confirmed.confirmMail === 'sent', 'confirm mail attempted')
}

console.log('contact tests ok')
