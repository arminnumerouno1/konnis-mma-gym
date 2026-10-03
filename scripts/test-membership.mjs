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
import { membershipPdfAttachments } from '../server/membership-pdf.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(SIGNUP_OPEN === true, 'signup open')
assert(isSignupOpen({}) === true, 'open default')
assert(isSignupOpen({ SIGNUP_OPEN: 'true' }) === true, 'env override open')
assert(isSignupOpen({ SIGNUP_OPEN: 'false' }) === false, 'env override closed')
assert(MEMBERSHIP_MAIL === false, 'membership mail stays off')
assert(isMembershipMailOpen({}) === false, 'no mail by default')
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

const honey = validateMembership({ ...base, company: 'bot' }, {})
assert(honey.ok && honey.honey, 'honeypot')

const badSign = validateMembership({ ...base, signature: 'Anna M' }, {})
assert(!badSign.ok && badSign.error === 'signature', 'signature must match')

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
assert(day.ok && day.record?.visitDay === '2026-10-02', 'day pass date')

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

const standardMail = membershipCopyHtml({ ...mailRecord, plan: 'standard', planName: 'Standard', price: 99.99 })
assert(standardMail.includes('Willkommen') && !standardMail.includes('einer der Ersten'), 'standard welcome')

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
  globalThis.fetch = async (url) => {
    calls.push(String(url))
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
    assert(captured.status === 200 && parsed.ok === true && parsed.confirmation === 'saved', 'signup saves without mail')
    assert(!calls.some((url) => url.includes('brevo.com')), 'signup does not call brevo')
  } finally {
    globalThis.fetch = previous
  }
}

console.log('membership tests ok')
