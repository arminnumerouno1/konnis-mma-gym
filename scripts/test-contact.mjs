import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContactHandler, isTrialOpen, TRIAL_OPEN } from '../server/contact.mjs'
import { trialSlots } from '../server/kursplan.mjs'
import { createAdminHandler } from '../server/admin.mjs'
import { buildTrialGuardianConsentPdf } from '../server/membership-pdf.mjs'
import { performCheckin } from '../server/checkin.mjs'
import {
  patchTrial,
  readTrialRequest,
  trialGuardianMissing,
} from '../server/trial.mjs'

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

const adultBirth = '1994-04-12'

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

const kidNoGuard = readTrialRequest({
  name: 'Leo Hartmann',
  email: 'leo@example.com',
  phone: '+49 171 1112233',
  birthDate: '2012-05-01',
  slotId: slots[0].id,
})
assert(!kidNoGuard.ok && kidNoGuard.error === 'guardian', 'minor needs guardian')

const kidOk = readTrialRequest({
  name: 'Leo Hartmann',
  email: 'leo@example.com',
  phone: '+49 171 1112233',
  birthDate: '2012-05-01',
  slotId: slots[0].id,
  guardianName: 'Kim Hartmann',
  guardianRelation: 'Mutter',
  guardianEmail: 'kim@example.com',
  guardianPhone: '+49 171 7654321',
  guardianConsent: true,
})
assert(kidOk.ok && kidOk.entry.minor && !kidOk.entry.guardian.signedAt, 'minor stored pending consent')
assert(trialGuardianMissing(kidOk.entry), 'guardian missing until signed')

const blockedConfirm = patchTrial(kidOk.entry, { status: 'bestaetigt' })
assert(!blockedConfirm.ok && blockedConfirm.error === 'guardian', 'confirm blocked without consent')

const signed = patchTrial(kidOk.entry, { guardianSigned: true, signedVia: 'desk' })
assert(signed.ok && signed.entry.guardian.signedAt && signed.entry.guardian.signedVia === 'desk', 'desk sign')
const afterSign = patchTrial(signed.entry, { status: 'bestaetigt' })
assert(afterSign.ok && afterSign.entry.status === 'bestaetigt', 'confirm after desk sign')

const pdfBytes = await buildTrialGuardianConsentPdf(kidOk.entry)
assert(Buffer.from(pdfBytes).subarray(0, 5).toString() === '%PDF-', 'trial consent pdf')
assert(!Buffer.from(pdfBytes).toString('latin1').includes('DE77'), 'trial consent has no iban in raw header')

const dataDir = join(tmpdir(), `konni-contact-${process.pid}-${Date.now()}`)
mkdirSync(dataDir, { recursive: true })
const FORM_STARTED = Date.now() - 15_000

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
        formStarted: FORM_STARTED,
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        birthDate: adultBirth,
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
        formStarted: FORM_STARTED,
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        birthDate: adultBirth,
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
        formStarted: FORM_STARTED,
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        birthDate: adultBirth,
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
        formStarted: FORM_STARTED,
        name: 'Anna Müller',
        email: 'anna@example.com',
        phone: '+49 171 1234567',
        birthDate: adultBirth,
        slotId: slots[0].id,
        note: 'Bin Anfängerin',
      },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 200 && parsed.ok === true, 'open trial accepts valid slot')
  assert(!parsed.minor, 'adult is not minor')
  const saved = JSON.parse(readFileSync(join(dataDir, 'trials.json'), 'utf8'))
  assert(saved.entries.length === 1, 'persisted trial')
  assert(saved.entries[0].status === 'neu', 'status neu')
  assert(saved.entries[0].slot.id === slots[0].id, 'slot stored')
  assert(saved.entries[0].note === 'Bin Anfängerin', 'note stored')
  assert(saved.entries[0].birthDate === adultBirth, 'birth stored')
}

{
  const handle = createContactHandler({ dataDir, env: { TRIAL_OPEN: 'true' } })
  const sameEmail = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.41' },
      body: {
        formStarted: FORM_STARTED,
        name: 'Andere Person',
        email: 'anna@example.com',
        phone: '+49 171 5555555',
        birthDate: adultBirth,
        slotId: slots[1].id,
      },
    },
    sameEmail.res,
  )
  assert(JSON.parse(sameEmail.captured.body).error === 'duplicate' && sameEmail.captured.status === 409, 'same email blocked')

  const samePhone = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.42' },
      body: {
        formStarted: FORM_STARTED,
        name: 'Andere Person',
        email: 'andere@example.com',
        phone: '0171 1234567',
        birthDate: adultBirth,
        slotId: slots[1].id,
      },
    },
    samePhone.res,
  )
  assert(JSON.parse(samePhone.captured.body).error === 'duplicate', 'same phone blocked')

  const sameName = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.43' },
      body: {
        formStarted: FORM_STARTED,
        name: 'Anna Müller',
        email: 'anna.neu@example.com',
        phone: '+49 171 4443322',
        birthDate: adultBirth,
        slotId: slots[2].id,
      },
    },
    sameName.res,
  )
  assert(JSON.parse(sameName.captured.body).error === 'duplicate', 'same name blocked')

  const multi = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.44' },
      body: {
        formStarted: FORM_STARTED,
        name: 'Clara Koch',
        email: 'clara.trial@example.com',
        phone: '+49 171 2223344',
        birthDate: adultBirth,
        slotIds: [slots[0].id, slots[1].id],
      },
    },
    multi.res,
  )
  assert(JSON.parse(multi.captured.body).error === 'slot' && multi.captured.status === 400, 'multi slot rejected')

  const after = JSON.parse(readFileSync(join(dataDir, 'trials.json'), 'utf8'))
  assert(after.entries.length === 1, 'duplicates did not persist')
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
        formStarted: FORM_STARTED,
        name: 'Ben Beispiel',
        email: 'ben@example.com',
        phone: '+49 171 9998877',
        birthDate: adultBirth,
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

  // U18 trial: block confirm + check-in until desk sign
  const kidPost = mockRes()
  await handleOpen(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.7' },
      body: {
        formStarted: FORM_STARTED,
        name: 'Mia Kurz',
        email: 'mia.trial@example.com',
        phone: '+49 171 3334455',
        birthDate: '2011-01-01',
        slotId: slots[2].id,
        guardianName: 'Sabine Kurz',
        guardianRelation: 'Mutter',
        guardianEmail: 'sabine.trial@example.com',
        guardianPhone: '+49 171 3334456',
        guardianConsent: true,
      },
    },
    kidPost.res,
  )
  const kidParsed = JSON.parse(kidPost.captured.body)
  assert(kidPost.captured.status === 200 && kidParsed.minor === true, 'minor trial saved')
  const listed3 = mockRes()
  await handle(
    {
      method: 'GET',
      url: '/api/admin?trials=1',
      headers: { cookie },
      socket: { remoteAddress: '127.0.0.5' },
    },
    listed3.res,
  )
  const mia = JSON.parse(listed3.captured.body).entries.find((row) => row.email === 'mia.trial@example.com')
  assert(mia && mia.minor && !mia.guardian?.signedAt, 'mia pending guardian')

  const blockConfirm = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie, 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.5' },
      body: { action: 'trialUpdate', id: mia.id, status: 'bestaetigt' },
    },
    blockConfirm.res,
  )
  assert(
    blockConfirm.captured.status === 400 && JSON.parse(blockConfirm.captured.body).error === 'guardian',
    'admin confirm blocked for unsigned minor',
  )

  const blockedCheckin = await performCheckin(
    { members: [], trials: [mia], checkins: [] },
    { manual: true, trialId: mia.id, slotId: slots[2].id, now: new Date('2026-11-17T18:00:00+01:00') },
  )
  assert(!blockedCheckin.ok && blockedCheckin.error === 'guardian', 'checkin blocked without consent')

  const deskSign = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie, 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.5' },
      body: { action: 'trialUpdate', id: mia.id, guardianSigned: true, signedVia: 'desk' },
    },
    deskSign.res,
  )
  const signedMia = JSON.parse(deskSign.captured.body).entry
  assert(signedMia.guardian?.signedAt && signedMia.guardian.signedVia === 'desk', 'desk signed')

  const okConfirm = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/admin',
      headers: { cookie, 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.5' },
      body: { action: 'trialUpdate', id: mia.id, status: 'bestaetigt' },
    },
    okConfirm.res,
  )
  assert(okConfirm.captured.status === 200 && JSON.parse(okConfirm.captured.body).entry.status === 'bestaetigt', 'confirm after sign')

  const okCheckin = await performCheckin(
    { members: [], trials: [JSON.parse(okConfirm.captured.body).entry], checkins: [] },
    { manual: true, trialId: mia.id, slotId: slots[2].id, now: new Date('2026-11-17T18:00:00+01:00') },
  )
  assert(okCheckin.ok && okCheckin.entry, 'checkin allowed after consent')
}

console.log('contact tests ok')
