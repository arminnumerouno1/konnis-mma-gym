import { inflateSync } from 'node:zlib'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  ageOn,
  createMembershipHandler,
  first50Taken,
  isSignupOpen,
  isMembershipMailOpen,
  MEMBERSHIP_MAIL,
  SIGNUP_OPEN,
  validateMembership,
} from '../server/membership.mjs'
import { membershipCopyHtml, membershipMailSubject } from '../server/membership-mail.mjs'
import { buildContractPdf, membershipPdfAttachments } from '../server/membership-pdf.mjs'
import { createMemberStore } from '../server/member-store.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

function pdfText(bytes) {
  const raw = Buffer.from(bytes).toString('latin1')
  const parts = []
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match
  while ((match = re.exec(raw))) {
    const chunk = Buffer.from(match[1], 'latin1')
    try {
      parts.push(inflateSync(chunk).toString('latin1'))
    } catch {
      parts.push(match[1])
    }
  }
  return parts
    .join('\n')
    .replace(/<([0-9A-Fa-f\s]+)>/g, (_, hex) => {
      const clean = hex.replace(/\s/g, '')
      if (!clean || clean.length % 2) return ''
      let out = ''
      for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(Number.parseInt(clean.slice(i, i + 2), 16))
      return out
    })
}

assert(SIGNUP_OPEN === true, 'signup open')
assert(isSignupOpen({}) === true, 'open default')
assert(isSignupOpen({ SIGNUP_OPEN: 'true' }) === true, 'env override open')
assert(isSignupOpen({ SIGNUP_OPEN: 'false' }) === false, 'env override closed')
assert(MEMBERSHIP_MAIL === true, 'signup sends the contract mail')
assert(isMembershipMailOpen({}) === true, 'mail on by default')
assert(isMembershipMailOpen({ MEMBERSHIP_MAIL: 'true' }) === true, 'mail env on')
assert(isMembershipMailOpen({ MEMBERSHIP_MAIL: 'false' }) === false, 'mail env off')

assert(ageOn('2000-01-15') !== null, 'age parses')
assert(ageOn('1990-13-01') === null, 'bad month')
assert(ageOn('2099-01-01') === null, 'future')

const base = {
  plan: 'standard',
  firstName: 'Anna',
  lastName: 'Müller',
  birthDate: '1994-04-12',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  city: 'Leipzig',
  email: 'anna@example.com',
  phone: '+49 171 1234567',
  place: 'Leipzig',
  signature: 'Anna Müller',
  consents: {
    agb: true,
    hausordnung: true,
    widerruf: true,
    privacy: true,
    health: true,
    sign: true,
  },
}

const ok = validateMembership(base, {})
assert(ok.ok && ok.record?.plan === 'standard', 'valid standard')

const again = validateMembership(
  { ...base, plan: 'flex', email: 'Anna@example.com' },
  { memberships: [{ email: 'anna@example.com', plan: 'standard', status: 'active' }] },
)
assert(!again.ok && again.error === 'duplicate', 'same email cannot sign up twice')
const afterCancel = validateMembership(base, {
  memberships: [{ email: 'anna@example.com', plan: 'standard', status: 'cancelled' }],
})
assert(afterCancel.ok, 'cancelled member can sign up again')
const other = validateMembership(
  { ...base, email: 'neu@example.com' },
  { memberships: [{ email: 'anna@example.com', plan: 'standard', status: 'active' }] },
)
assert(other.ok, 'different email still signs up')

const earlyBlocked = validateMembership(
  { ...base, consents: { ...base.consents, earlyStart: true } },
  { now: new Date('2026-10-03T12:00:00Z') },
)
assert(earlyBlocked.ok && earlyBlocked.record?.consents.earlyStart === false, 'no early training before 2 november')
const earlyLater = validateMembership(
  { ...base, consents: { ...base.consents, earlyStart: true } },
  { now: new Date('2026-11-03T12:00:00Z') },
)
assert(earlyLater.ok && earlyLater.record?.consents.earlyStart === true, 'early start can be requested after opening')

const honey = validateMembership({ ...base, company: 'bot' }, {})
assert(honey.ok && honey.honey, 'honeypot')

const looseSign = validateMembership({ ...base, signature: 'Anna M' }, {})
assert(looseSign.ok && looseSign.record?.signature === 'Anna M', 'signature need not match the name')
const emptySign = validateMembership({ ...base, signature: ' ' }, {})
assert(!emptySign.ok && emptySign.error === 'signature', 'signature still required')

const gone = validateMembership({ ...base, plan: 'first50' }, {})
assert(!gone.ok && gone.error === 'invite', 'first50 needs invite')

const kid = validateMembership(
  {
    ...base,
    birthDate: '2014-01-01',
    guardianName: 'Tim Müller',
    guardianEmail: 'tim@example.com',
    guardianPhone: '03411234567',
    guardianConsent: true,
  },
  {},
)
assert(kid.ok && kid.record?.minor, 'minor with guardian')

const kidNoGuard = validateMembership({ ...base, birthDate: '2014-01-01' }, {})
assert(!kidNoGuard.ok && kidNoGuard.error === 'guardian', 'minor needs guardian')

const day = validateMembership({ ...base, plan: 'daypass', visitDay: '2026-10-02' }, {})
assert(!day.ok && day.error === 'plan', 'day pass is not offered online')

const transfer = validateMembership({ ...base, payMethod: 'transfer' }, {})
assert(transfer.ok && transfer.record?.payMethod === 'transfer', 'monthly bank transfer')
const transferDay = validateMembership({ ...base, plan: 'daypass', visitDay: '2026-11-02', payMethod: 'transfer' }, {})
assert(!transferDay.ok && transferDay.error === 'plan', 'day pass stays closed online')

assert(first50Taken([{ plan: 'first50' }, { plan: 'standard' }, { plan: 'first50', status: 'cancelled' }]) === 1, 'count')

const mailRecord = {
  firstName: 'Anna',
  lastName: 'Müller',
  birthDate: '1994-04-12',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  city: 'Leipzig',
  email: 'anna@example.com',
  phone: '+49 171 1234567',
  plan: 'first50',
  planName: 'First 50',
  price: 89.99,
  termMonths: 24,
  place: 'Leipzig',
  signature: 'Anna Müller',
  createdAt: '2026-09-28T19:00:00.000Z',
  consents: { earlyStart: true },
}
const mail = membershipCopyHtml(mailRecord)
assert(mail.includes('First 50') && mail.includes('89,99') && mail.includes('Anna Müller'), 'mail copy')
assert(mail.includes('einer der Ersten') && mail.includes('freuen') && mail.includes('Konrad und Mehmet'), 'first50 welcome')
assert(mail.includes('jeweils zum 1. des Monats fällig'), 'fee due on the first')
assert(mail.includes('Vorher gibt es kein Training'), 'mail says training starts at opening')
assert(!mail.includes('Vorzeitiger Leistungsbeginn ausdrücklich verlangt'), 'pre-opening mail drops the early-start demand')
const transferMail = membershipCopyHtml({ ...mailRecord, plan: 'standard', planName: 'Standard', payMethod: 'transfer' })
assert(transferMail.includes('DE77 8605 5592 1090 4292 70'), 'transfer mail has the gym iban')
assert(transferMail.includes('WELADE8LXXX') && transferMail.includes('Stadt- und Kreissparkasse Leipzig'), 'transfer mail names the bank')
assert(transferMail.includes('erste Überweisung ist am 1. November 2026'), 'first transfer date')
assert(!mail.includes('<script') && mail.includes('Wittenberger'), 'mail escaped')
assert(membershipMailSubject(mailRecord).includes('Ersten'), 'first50 subject')
assert(!membershipMailSubject({ ...mailRecord, plan: 'standard', planName: 'Standard' }).includes('Ersten'), 'standard subject')

const attachedMail = membershipCopyHtml(
  {
    firstName: 'Anna',
    lastName: 'Müller',
    plan: 'first50',
    planName: 'First 50',
    price: 89.99,
    termMonths: 24,
  },
  { attached: true },
)
assert(attachedMail.includes('Mitgliedsvertrag.pdf') && attachedMail.includes('Widerrufsbelehrung.pdf'), 'mail names pdfs')
assert(attachedMail.includes('einer der Ersten') && attachedMail.includes('PDF bei'), 'first50 attached welcome')

const standardMail = membershipCopyHtml({ ...mailRecord, plan: 'standard', planName: 'Standard', price: 99.99, payMethod: 'card' })
assert(standardMail.includes('Willkommen') && !standardMail.includes('einer der Ersten'), 'standard welcome')
assert(standardMail.includes('DE77 8605 5592 1090 4292 70'), 'card mail names the transfer account')
assert(standardMail.includes('SEPA-Lastschrift kommt später'), 'card mail says sepa comes later')
assert(standardMail.includes('nur bis zum 2. November 2026') && standardMail.includes('Danach beträgt sie 49 €'), 'mail states the later signup fee')
assert(standardMail.includes('Mitgliedsvertrag') || standardMail.includes('Vertrag'), 'card mail mentions the contract')

const dayMail = membershipCopyHtml({
  ...mailRecord,
  plan: 'daypass',
  planName: 'Day Pass',
  price: 19.99,
  termMonths: null,
  visitDay: '2026-11-02',
  payMethod: 'card',
})
assert(!dayMail.includes('Aufnahmegebühr') && !dayMail.includes('49 €'), 'day pass mail has no signup fee')
assert(dayMail.includes('Day Pass wird mit Karte oder Apple Pay bezahlt'), 'day pass mail names card payment')

const sample = {
  firstName: 'Anna',
  lastName: 'Müller',
  birthDate: '1994-04-12',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  city: 'Leipzig',
  email: 'anna@example.com',
  phone: '+49 171 1234567',
  plan: 'first50',
  planName: 'First 50',
  price: 89.99,
  termMonths: 24,
  place: 'Leipzig',
  signature: 'Anna Müller',
  createdAt: '2026-09-28T19:00:00.000Z',
  consents: { earlyStart: true },
  inviteSlot: 7,
}

const files = await membershipPdfAttachments(sample)
assert(files.length === 2, 'two pdfs')
assert(files[0].name === 'Mitgliedsvertrag.pdf', 'contract name')
assert(files[1].name === 'Widerrufsbelehrung.pdf', 'withdrawal name')

const contractBytes = Buffer.from(files[0].content, 'base64')
assert(contractBytes.subarray(0, 5).toString() === '%PDF-', 'contract header')
const contractPdf = await PDFDocument.load(contractBytes)
assert(contractPdf.getPageCount() >= 1, 'contract pages')
assert(String(contractPdf.getTitle() || '').includes('Mitgliedsvertrag'), 'contract title')
assert(String(contractPdf.getSubject() || '').includes('Anna Müller'), 'contract subject')
const contractText = pdfText(contractBytes)
assert(contractText.includes('DE77') && contractText.includes('8605') && contractText.includes('4292 70'), 'card contract contains the gym iban')
assert(contractText.includes('WELADE8LXXX'), 'card contract contains the bic')
assert(contractText.includes('SEPA-Lastschrift kommt später'), 'card contract says sepa comes later')
assert(contractText.includes('nur bis zum 2. November 2026') && contractText.includes('Danach beträgt sie 49,00 EUR'), 'signup fee is 49 euro after 2 november')
assert(contractText.includes('Vorher gibt es kein Training'), 'contract refuses training before opening')
const transferPdf = Buffer.from(await buildContractPdf({ ...sample, plan: 'standard', planName: 'Standard', payMethod: 'transfer' }))
const transferText = pdfText(transferPdf)
assert(transferText.includes('Banküberweisung') && transferText.includes('DE77 8605') && transferText.includes('4292 70'), 'transfer contract contains the gym account')
const paperPdf = Buffer.from(await buildContractPdf({ ...sample, plan: 'standard', planName: 'Standard', payMethod: 'transfer' }, { paper: true }))
const paperText = pdfText(paperPdf)
assert(paperText.includes('DE77 8605') && paperText.includes('4292 70'), 'paper contract contains the gym account')
assert(paperText.includes('Danach beträgt sie 49,00 EUR'), 'paper membership still states the later signup fee')
assert(!paperText.includes('Gym-Unterschrift-Test'), 'unsigned paper contract leaves the gym line blank')
const signedPaper = Buffer.from(
  await buildContractPdf(
    {
      ...sample,
      plan: 'standard',
      planName: 'Standard',
      payMethod: 'card',
      signature: 'Mitglied-Unterschrift-Test',
      gymSignature: 'Gym-Unterschrift-Test',
      bank: { holder: 'Anna Müller', iban: 'DE89370400440532013000', mandateSignature: 'Konto-Unterschrift-Test' },
    },
    { paper: true },
  ),
)
const signedPaperText = pdfText(signedPaper)
assert(signedPaperText.includes('Mitglied-Unterschrift-Test'), 'paper contract shows the member signature')
assert(signedPaperText.includes('Gym-Unterschrift-Test'), 'paper contract shows the gym signature')
assert(signedPaperText.includes('Konto-Unterschrift-Test'), 'paper contract shows the account-holder signature')

const dayPdf = Buffer.from(
  await buildContractPdf({
    ...sample,
    plan: 'daypass',
    planName: 'Day Pass',
    price: 19.99,
    termMonths: null,
    visitDay: '2026-11-02',
    payMethod: 'card',
    inviteSlot: undefined,
  }),
)
const dayText = pdfText(dayPdf)
assert(dayText.includes('Day Pass') && !dayText.includes('Aufnahmegebühr') && !dayText.includes('49,00 EUR'), 'day pass contract has no signup fee')
const dayPaper = Buffer.from(
  await buildContractPdf(
    {
      ...sample,
      plan: 'daypass',
      planName: 'Day Pass',
      price: 19.99,
      termMonths: null,
      visitDay: '2026-11-02',
      payMethod: 'card',
      inviteSlot: undefined,
    },
    { paper: true },
  ),
)
assert(!pdfText(dayPaper).includes('Aufnahmegebühr'), 'paper day pass has no signup fee')

const withdrawalBytes = Buffer.from(files[1].content, 'base64')
assert(withdrawalBytes.subarray(0, 5).toString() === '%PDF-', 'withdrawal header')
const withdrawalPdf = await PDFDocument.load(withdrawalBytes)
assert(withdrawalPdf.getPageCount() >= 1, 'withdrawal pages')
const officialWithdrawal = readFileSync(new URL('../public/legal/widerrufsbelehrung.pdf', import.meta.url))
const bundledWithdrawal = readFileSync(new URL('../server/assets/widerrufsbelehrung.pdf', import.meta.url))
assert(officialWithdrawal.equals(bundledWithdrawal), 'bundled withdrawal matches public pdf')
assert(withdrawalBytes.equals(officialWithdrawal), 'mail attaches official withdrawal')

const minorFiles = await membershipPdfAttachments({
  ...sample,
  firstName: 'Leo',
  lastName: 'Hartmann',
  signature: 'Leo Hartmann',
  birthDate: '2012-05-01',
  minor: true,
  guardian: { name: 'Kim Hartmann', email: 'kim@example.com', phone: '03411234567' },
})
const minorPdf = await PDFDocument.load(Buffer.from(minorFiles[0].content, 'base64'))
assert(String(minorPdf.getSubject() || '').includes('Leo Hartmann'), 'minor subject')

function mockRes() {
  const captured = { status: 0, body: '' }
  const res = {
    get headersSent() {
      return captured.status !== 0
    },
    statusCode: 0,
    setHeader() {},
    end(payload) {
      captured.status = this.statusCode
      captured.body = String(payload ?? '')
    },
  }
  return { res, captured }
}

const dataDir = join(tmpdir(), `konni-mem-${process.pid}`)
mkdirSync(dataDir, { recursive: true })
{
  const handle = createMembershipHandler({ dataDir, env: { SIGNUP_OPEN: 'false' } })
  const { res, captured } = mockRes()
  await handle({ method: 'POST', url: '/api/mitglied', headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res)
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 403 && parsed.ok === false && parsed.error === 'closed', 'handler rejects closed signup')
}

{
  const calls = []
  const previous = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: String(init?.body || '') })
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
  }
  try {
    const handle = createMembershipHandler({
      dataDir,
      env: { BREVO_API_KEY: 'xkeysib-test', BREVO_LIST_ID: '9' },
    })
    const { res, captured } = mockRes()
    await handle(
      {
        method: 'POST',
        url: '/api/mitglied',
        headers: { 'content-type': 'application/json' },
        body: { ...base, email: 'offen@example.com' },
        socket: { remoteAddress: '127.0.0.8' },
      },
      res,
    )
    const parsed = JSON.parse(captured.body)
    assert(captured.status === 200 && parsed.ok === true && parsed.confirmation === 'listed', 'signup lists the member')
    const mails = calls.filter((call) => call.url.includes('/smtp/email'))
    assert(mails.length === 0, 'card signup does not mail the contract before stripe')
    const filed = (await createMemberStore({ dataDir, env: {} }).load()).members.find((row) => row.email === 'offen@example.com')
    assert(filed?.docs?.contract?.name === 'Mitgliedsvertrag.pdf', 'stripe signup files the contract in admin')
    assert(filed?.payMethod === 'card', 'stripe signup keeps card')
    assert(filed?.contractMail === 'after_payment', 'card contract mail waits for stripe')
  } finally {
    globalThis.fetch = previous
  }
}

{
  const handle = createMembershipHandler({ dataDir, env: { MEMBERSHIP_MAIL: 'false' } })
  const first = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/mitglied',
      headers: { 'content-type': 'application/json' },
      body: { ...base, email: 'doppelt@example.com', payMethod: 'transfer' },
      socket: { remoteAddress: '127.0.0.21' },
    },
    first.res,
  )
  const firstBody = JSON.parse(first.captured.body)
  assert(first.captured.status === 200 && firstBody.ok === true, 'first signup stored')
  const second = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/mitglied',
      headers: { 'content-type': 'application/json' },
      body: { ...base, plan: 'flex', email: 'Doppelt@example.com', payMethod: 'transfer' },
      socket: { remoteAddress: '127.0.0.22' },
    },
    second.res,
  )
  const secondBody = JSON.parse(second.captured.body)
  assert(second.captured.status === 409 && secondBody.error === 'duplicate', 'second signup refused')
  const rows = (await createMemberStore({ dataDir, env: {} }).load()).members.filter((row) => row.email === 'doppelt@example.com')
  assert(rows.length === 1 && rows[0].plan === 'standard', 'first contract stays')
}

console.log('membership tests ok')
