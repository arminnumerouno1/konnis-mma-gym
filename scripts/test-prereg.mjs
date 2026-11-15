import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAdminHandler } from '../server/admin.mjs'
import { addPrereg, createPreregStore, createPreregHandler, importPreregs, isPreregOpen, PREREG_OPEN, preregCsv, preregStats, readPrereg, sortPreregs } from '../server/prereg.mjs'
import { rowsFromSheet } from './import-prereg-list.mjs'

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
assert(csv.startsWith('\uFEFF"Nr. Google-Liste"'), 'csv header with bom')
assert(csv.includes(`"'=HYPERLINK(""x"")"`), 'csv formula escaped')

const tmp = mkdtempSync(join(tmpdir(), 'konni-prereg-'))
const secret = 'test-admin-secret-key'
assert(PREREG_OPEN === false, 'public prereg closed')
assert(isPreregOpen({}) === false, 'prereg closed by default')
assert(isPreregOpen({ PREREG_OPEN: 'true' }) === true, 'prereg env open')

const publicHandle = createPreregHandler({ dataDir: tmp, env: { PREREG_OPEN: 'true' } })
const closedHandle = createPreregHandler({ dataDir: tmp, env: {} })
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

const closed = await call(closedHandle, { method: 'POST', url: '/api/voranmeldung', body: valid })
assert(closed.status === 403 && closed.data.error === 'closed', 'public prereg rejects new signups')

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

const sheet = [
  { row: 5, cells: { B: 'Name ', D: 'email ', F: 'Preis ' } },
  { row: 6, cells: { A: '1', B: 'Anna  Alt', D: 'Anna@Example.com', F: '89.99', H: '17 Jahre' } },
  { row: 7, cells: { A: '2', B: 'Ohne Mail', D: 'Keine email', F: '89.99' } },
  { row: 8, cells: { A: '51', B: 'Wart Liste', D: 'wart@example.com', G: '99.99', I: 'Zweit@Example.com' } },
  { row: 9, cells: { A: '60', B: 'Anna Alt', D: 'anna@example.com', I: '99.99' } },
  { row: 10, cells: {} },
]
const sheetRows = rowsFromSheet(sheet, { invited: new Set(['anna@example.com']), mailed: new Set(['wart@example.com']) })
assert(sheetRows.length === 4, 'sheet rows without empty lines')
assert(sheetRows[0].name === 'Anna Alt' && sheetRows[0].age === 17 && sheetRows[0].price === 89.99, 'sheet age and price')
assert(sheetRows[1].email === '' && sheetRows[1].remarks[0] === 'Mailfeld: Keine email' && sheetRows[1].first50, 'no mail kept as remark')
assert(sheetRows[2].extraEmails[0] === 'zweit@example.com' && sheetRows[2].openingMail && !sheetRows[2].first50, 'extra mail and waitlist')

const importDir = mkdtempSync(join(tmpdir(), 'konni-prereg-import-'))
const importStore = createPreregStore({ dataDir: importDir, env: {} })
await addPrereg(importStore, { ...parsed.entry, email: 'wart@example.com', name: 'Wart Liste' })
let importResult = null
await importStore.update((db) => {
  importResult = importPreregs(db, sheetRows)
  return db
})
assert(importResult.added === 2 && importResult.updated === 2, 'import adds new, merges website entry and duplicate')
let imported = sortPreregs((await importStore.load()).entries)
assert(imported.length === 3, 'three people')
assert(imported[0].email === 'wart@example.com' && imported[0].createdAt && imported[0].listNo === 51, 'website entry first, gets list number')
assert(imported[0].goal === parsed.entry.goal && imported[0].status === 'neu', 'website answers kept')
const anna = imported.find((row) => row.email === 'anna@example.com')
assert(anna.listNo === 1 && anna.first50 && anna.remarks.includes('Doppelt eingetragen, auch Nr. 60'), 'duplicate merged with note')
assert(anna.status === 'neu' && anna.notify === null && anna.createdAt === null, 'imported defaults')
assert(imported[1].listNo === 2 && imported[2].listNo === 1, 'list entries newest number first, oldest last')
await importStore.update((db) => {
  importResult = importPreregs(db, sheetRows)
  return db
})
assert(importResult.added === 0 && (await importStore.load()).entries.length === 3, 'import is repeatable')
const importStats = preregStats((await importStore.load()).entries)
assert(importStats.fromList === 3 && importStats.fromWebsite === 1 && importStats.first50 === 2, 'import stats')
assert(importStats.minors === 2, 'minors ignore missing age')
await addPrereg(importStore, { ...parsed.entry, email: 'anna@example.com', name: 'Anna Alt' })
const annaWeb = (await importStore.load()).entries.find((row) => row.email === 'anna@example.com')
assert(annaWeb.listNo === 1 && annaWeb.first50 && annaWeb.createdAt && annaWeb.sports.length, 'later website form fills imported entry')

console.log('prereg tests ok')
