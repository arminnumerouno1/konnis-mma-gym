import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAdminHandler } from '../server/admin.mjs'
import { createPreregHandler, preregCsv, readPrereg } from '../server/prereg.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const valid = {
  name: 'Lena Schmidt',
  age: '17',
  email: 'Lena@Example.com',
  phone: '',
  sports: ['MMA', 'BJJ', 'SONSTIGES', 'Quatsch'],
  sportsOther: 'Judo',
  experience: 'Zwei Jahre Judo',
  times: 'abends ab 18 Uhr',
  offer: 'ja',
  sources: ['Instagram'],
  sourceOther: 'wird ignoriert',
  notify: true,
  goal: 'Fitter werden',
  message: '',
  consent: true,
}

const parsed = readPrereg(valid)
assert(parsed.ok, 'valid prereg')
assert(parsed.entry.email === 'lena@example.com', 'email normalized')
assert(parsed.entry.age === 17, 'age number')
assert(parsed.entry.sports.join() === 'MMA,BJJ,SONSTIGES', 'unknown sport dropped')
assert(parsed.entry.sportsOther === 'Judo', 'other sport kept')
assert(parsed.entry.sourceOther === '', 'other source only with Sonstiges')

const fails = [
  [{ name: 'Lena' }, 'name'],
  [{ age: 'x' }, 'age'],
  [{ age: '140' }, 'age'],
  [{ email: 'nope' }, 'email'],
  [{ phone: 'abc' }, 'phone'],
  [{ sports: [] }, 'sports'],
  [{ experience: ' ' }, 'experience'],
  [{ times: '' }, 'times'],
  [{ offer: 'klar' }, 'offer'],
  [{ sources: ['Fax'] }, 'sources'],
  [{ notify: 'ja' }, 'notify'],
  [{ goal: '' }, 'goal'],
  [{ consent: false }, 'consent'],
]
for (const [patch, error] of fails) {
  const result = readPrereg({ ...valid, ...patch })
  assert(!result.ok && result.error === error, `rejects ${error}`)
}

const csv = preregCsv([{ ...parsed.entry, name: '=HYPERLINK("x")', status: 'neu', note: '', createdAt: '2026-09-29' }])
assert(csv.startsWith('\uFEFF"Eingang"'), 'csv header with bom')
assert(csv.includes(`"'=HYPERLINK(""x"")"`), 'csv formula escaped')

const tmp = mkdtempSync(join(tmpdir(), 'konni-prereg-'))
const secret = 'test-admin-secret-key'
const publicHandle = createPreregHandler({ dataDir: tmp, env: {} })
const adminHandle = createAdminHandler({ dataDir: tmp, env: { ADMIN_SECRET: secret } })

async function call(handle, req) {
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
  await handle({ headers: {}, socket: { remoteAddress: '10.1.0.1' }, ...req }, res)
  const isJson = String(captured.headers['content-type'] ?? '').includes('json')
  return { status: captured.status, data: isJson && captured.body ? JSON.parse(captured.body) : captured.body, headers: captured.headers }
}

const wrongMethod = await call(publicHandle, { method: 'GET', url: '/api/voranmeldung' })
assert(wrongMethod.status === 405, 'public GET refused')

const bad = await call(publicHandle, { method: 'POST', url: '/api/voranmeldung', body: { ...valid, goal: '' } })
assert(bad.status === 400 && bad.data.error === 'goal', 'server validates')

const bot = await call(publicHandle, { method: 'POST', url: '/api/voranmeldung', body: { ...valid, company: 'Spam GmbH' } })
assert(bot.status === 200, 'honeypot answers ok')

const first = await call(publicHandle, { method: 'POST', url: '/api/voranmeldung', body: valid })
assert(first.status === 200 && first.data.ok && !first.data.repeat, 'prereg saved')

const again = await call(publicHandle, {
  method: 'POST',
  url: '/api/voranmeldung',
  body: { ...valid, goal: 'Ersten Kampf machen' },
})
assert(again.data.ok && again.data.repeat, 'same mail updates')

const second = await call(publicHandle, {
  method: 'POST',
  url: '/api/voranmeldung',
  body: { ...valid, name: 'Tom Weber', email: 'tom@example.com', age: '31', offer: 'vielleicht', notify: false },
})
assert(second.data.ok, 'second prereg')

const noAuth = await call(adminHandle, { method: 'GET', url: '/api/admin?prereg=1' })
assert(noAuth.status === 401, 'admin prereg needs login')

const login = await call(adminHandle, {
  method: 'POST',
  url: '/api/admin',
  socket: { remoteAddress: '10.1.0.9' },
  body: { action: 'login', password: secret },
})
const cookie = String(login.headers['set-cookie'] || '')
assert(cookie.includes('konni_admin='), 'admin login')

const listed = await call(adminHandle, { method: 'GET', url: '/api/admin?prereg=1', headers: { cookie } })
assert(listed.data.ok && listed.data.entries.length === 2, 'bot entry not stored, duplicate merged')
const lena = listed.data.entries.find((row) => row.email === 'lena@example.com')
assert(lena.goal === 'Ersten Kampf machen' && lena.submissions === 2, 'resubmit merged')
assert(listed.data.stats.fresh === 2 && listed.data.stats.minors === 1, 'stats fresh and minors')
assert(listed.data.stats.offerYes === 1 && listed.data.stats.offerMaybe === 1, 'stats offer')
assert(listed.data.stats.bySport.MMA === 2 && listed.data.stats.bySource.Instagram === 2, 'stats interest')

const marked = await call(adminHandle, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  body: { action: 'preregUpdate', id: lena.id, status: 'kontaktiert', note: 'Mama ruft an' },
})
assert(marked.data.ok && marked.data.entry.status === 'kontaktiert' && marked.data.entry.note === 'Mama ruft an', 'status and note')

const badStatus = await call(adminHandle, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  body: { action: 'preregUpdate', id: lena.id, status: 'vip' },
})
assert(badStatus.status === 400, 'unknown status refused')

const resubmit = await call(publicHandle, { method: 'POST', url: '/api/voranmeldung', body: valid })
assert(resubmit.data.repeat, 'resubmit after contact')
const afterResubmit = await call(adminHandle, { method: 'GET', url: '/api/admin?prereg=1', headers: { cookie } })
const lenaAgain = afterResubmit.data.entries.find((row) => row.id === lena.id)
assert(lenaAgain.status === 'kontaktiert' && lenaAgain.note === 'Mama ruft an', 'resubmit keeps status and note')

const exported = await call(adminHandle, { method: 'GET', url: '/api/admin?prereg=csv', headers: { cookie } })
assert(String(exported.headers['content-type']).startsWith('text/csv'), 'csv type')
assert(exported.data.includes('tom@example.com') && exported.data.includes('Mama ruft an'), 'csv rows')

const removed = await call(adminHandle, {
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  body: { action: 'preregDelete', id: lena.id },
})
assert(removed.data.ok, 'delete ok')
const afterDelete = await call(adminHandle, { method: 'GET', url: '/api/admin?prereg=1', headers: { cookie } })
assert(afterDelete.data.entries.length === 1 && afterDelete.data.entries[0].email === 'tom@example.com', 'deleted')

const members = await call(adminHandle, { method: 'GET', url: '/api/admin', headers: { cookie } })
assert(members.data.ok && members.data.members.length === 0, 'preregs are not members')

console.log('prereg tests ok')
