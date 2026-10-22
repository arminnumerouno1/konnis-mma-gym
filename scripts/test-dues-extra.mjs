import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseBankCsv, matchBankTransactions } from '../server/bank-import.mjs'
import { signupFeeFor, FEE_AFTER_OPENING } from '../server/signup-fee.mjs'
import {
  ensurePayments,
  memberFromSignup,
  openDuesOf,
  setPayment,
  waiveFuturePayments,
} from '../server/member-model.mjs'
import { createMemberStore } from '../server/member-store.mjs'
import { createAdminHandler } from '../server/admin.mjs'
import { applyStripeEvent } from '../server/stripe.mjs'
import { buildCheckoutFields } from '../server/stripe-checkout.mjs'
import { nextDunningStage, runDueReminders } from '../server/dues-cron.mjs'
import { paymentFailedMailHtml } from '../server/membership-mail.mjs'
import { allocateInvoiceNumber, buildReceiptPdf } from '../server/receipt-pdf.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(signupFeeFor('2026-11-02', 'standard') === 0, 'fee free on opening day')
assert(signupFeeFor('2026-11-03', 'standard') === FEE_AFTER_OPENING, 'fee after opening')
assert(signupFeeFor('2026-11-03', 'first50') === 0, 'first50 never fee')
assert(signupFeeFor('2026-11-03', 'daypass') === 0, 'daypass never fee')

const withFee = memberFromSignup(
  {
    id: 'fee1',
    status: 'active',
    plan: 'standard',
    planName: 'Standard',
    price: 99.99,
    termMonths: 24,
    fee: 49,
    firstName: 'Fee',
    lastName: 'Test',
    birthDate: '1990-01-01',
    email: 'fee@example.com',
    phone: '+49 171 1111111',
    startDate: '2026-11-03',
    payMethod: 'transfer',
    createdAt: '2026-11-03T10:00:00.000Z',
    source: 'online',
  },
  '2026-11-03',
)
const ready = ensurePayments(withFee, '2026-11-03')
assert(ready.payments.some((row) => row.kind === 'fee' && row.amount === 49 && row.status === 'open'), 'fee row open')
assert(openDuesOf(ready, '2026-11-03').openRows.some((row) => row.kind === 'fee'), 'fee in open dues')

const checkout = buildCheckoutFields({
  member: { ...withFee, fee: 49, stripe: null },
  origin: 'https://www.mma-in-leipzig.de',
  nowMs: Date.parse('2026-11-03T12:00:00+01:00'),
})
assert(checkout.fields['line_items[1][price_data][unit_amount]'] === '4900', 'stripe checkout adds fee line')

const csv = `Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Betrag;Waehrung
01.11.2026;Mitglied Fee Test fee@example.com;Fee Test;99,99;EUR
01.11.2026;Unbekannt;Jemand Anders;50,00;EUR
`
const parsed = parseBankCsv(csv)
assert(parsed.ok && parsed.rows.length === 2, 'csv parses credits')
const monthOpen = setPayment(ready, { period: '2026-11', kind: 'month', status: 'open' }, '2026-11-03')
const matched = matchBankTransactions([monthOpen], parsed.rows, '2026-11-03')
assert(matched.matches.length === 1 && matched.matches[0].email === 'fee@example.com', 'csv matches member by name/mail')
assert(matched.unmatched.length === 1, 'unknown credit unmatched')

assert(paymentFailedMailHtml({ firstName: 'Fee' }, { period: '2026-11', amount: 99.99 }).includes('fehlgeschlagen'), 'fail mail')
assert(
  paymentFailedMailHtml(
    { firstName: 'Fee' },
    { period: '2026-11', amount: 99.99, retryUrl: 'https://billing.stripe.com/p/session/test', retryKind: 'portal' },
  ).includes('billing.stripe.com'),
  'fail mail includes retry link',
)

assert(nextDunningStage([]) === 'reminder', 'first stage reminder')
assert(nextDunningStage([{ stage: 'reminder' }]) === 'mahnung1', 'escalate to mahnung1')
assert(nextDunningStage([{ stage: 'reminder' }, { stage: 'mahnung1' }]) === 'mahnung2', 'escalate to mahnung2')
assert(nextDunningStage([{ stage: 'mahnung2' }]) === 'mahnung2', 'stay on mahnung2')

const pauseBase = memberFromSignup(
  {
    id: 'pause1',
    status: 'active',
    plan: 'standard',
    planName: 'Standard',
    price: 99.99,
    termMonths: 24,
    fee: 0,
    firstName: 'Pause',
    lastName: 'Person',
    birthDate: '1990-01-01',
    email: 'pause@example.com',
    phone: '+49 171 0001111',
    startDate: '2026-09-01',
    payMethod: 'transfer',
    createdAt: '2026-08-01T10:00:00.000Z',
    source: 'admin',
  },
  '2026-11-05',
)
const paused = waiveFuturePayments({ ...pauseBase, status: 'paused' }, '2026-11-05')
assert(
  paused.payments.some((row) => row.period === '2026-12' && row.status === 'waived'),
  'future month waived on pause',
)
assert(
  paused.payments.find((row) => row.period === '2026-11')?.status !== 'waived' ||
    paused.payments.find((row) => row.period === '2026-11')?.status === 'open' ||
    paused.payments.find((row) => row.period === '2026-11')?.status === 'paid',
  'current month not force-waived as future',
)

const seqDb = { invoiceYear: null, invoiceSeq: 0 }
assert(allocateInvoiceNumber(seqDb, '2026-11-05') === 'KONNI-2026-00001', 'first receipt number')
assert(allocateInvoiceNumber(seqDb, '2026-11-05') === 'KONNI-2026-00002', 'second receipt number')
const receiptBytes = await buildReceiptPdf(
  { firstName: 'Fee', lastName: 'Test', planName: 'Standard', email: 'fee@example.com' },
  { period: '2026-11', kind: 'month', amount: 99.99, status: 'paid', paidAt: '2026-11-05T10:00:00.000Z' },
  { number: 'KONNI-2026-00001' },
)
assert(receiptBytes.byteLength > 500, 'receipt pdf bytes')

const failMails = []
const db = { members: [{ ...monthOpen, stripe: { customerId: 'cus_fail' } }] }
const failed = applyStripeEvent(
  db,
  {
    type: 'invoice.payment_failed',
    data: {
      object: {
        object: 'invoice',
        id: 'in_fail',
        customer: 'cus_fail',
        amount_due: 9999,
        lines: { data: [{ period: { start: Math.floor(Date.parse('2026-11-01T00:00:00+01:00') / 1000) } }] },
      },
    },
  },
  '2026-11-05',
)
assert(failed.handled && failed.status === 'failed', 'stripe fail applied')

const tmp = mkdtempSync(join(tmpdir(), 'konni-dues-extra-'))
const store = createMemberStore({ dataDir: tmp, env: {} })
await store.update((data) => {
  data.members.push({
    ...monthOpen,
    payMethod: 'transfer',
    reminders: [],
  })
  return data
})
const cron = await runDueReminders({
  store,
  env: { BREVO_API_KEY: 'x' },
  today: '2026-11-05',
  sendReminder: async (_env, record, opts) => {
    failMails.push({ email: record.email, ...opts })
    return 'sent'
  },
})
assert(cron.sent === 1 && failMails.length === 1, 'due reminder cron sends once')

const secret = 'dues-extra-secret'
const handle = createAdminHandler({
  dataDir: tmp,
  env: { ADMIN_SECRET: secret, BREVO_API_KEY: 'x' },
  sendReminder: async () => 'sent',
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
  socket: { remoteAddress: '10.0.0.90' },
  body: { action: 'login', password: secret },
})
const cookie = String(login.headers['set-cookie'] || '')
const preview = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.90' },
  body: { action: 'bankImportPreview', csv },
})
assert(preview.status === 200 && preview.data.matches?.length >= 1, 'admin bank preview')

const receiptIssue = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.90' },
  body: {
    action: 'issueReceipt',
    id: monthOpen.id,
    period: '2026-11',
    kind: 'month',
  },
})
assert(receiptIssue.status === 400, 'receipt needs paid status first')

const paidForReceipt = setPayment(monthOpen, { period: '2026-11', kind: 'month', status: 'paid' }, '2026-11-03')
await store.update((db) => {
  const index = db.members.findIndex((row) => row.id === paidForReceipt.id)
  if (index >= 0) {
    db.members[index] = { ...paidForReceipt, reminders: db.members[index].reminders ?? [] }
  } else db.members.push(paidForReceipt)
  return db
})
const receiptOk = await call({
  method: 'POST',
  url: '/api/admin',
  headers: { cookie },
  socket: { remoteAddress: '10.0.0.90' },
  body: { action: 'issueReceipt', id: paidForReceipt.id, period: '2026-11', kind: 'month' },
})
assert(receiptOk.status === 200 && String(receiptOk.data.number || '').startsWith('KONNI-'), 'issue receipt number')

const cron2 = await runDueReminders({
  store,
  env: { BREVO_API_KEY: 'x' },
  today: '2026-11-05',
  sendReminder: async () => 'sent',
})
assert(cron2.sent === 0, 'cooldown blocks immediate second cron')
await store.update((db) => {
  const index = db.members.findIndex((row) => row.email === 'fee@example.com')
  if (index < 0) return db
  const row = db.members[index]
  db.members[index] = {
    ...row,
    payments: setPayment(row, { period: '2026-10', kind: 'month', status: 'open' }, '2026-11-05').payments,
    reminders: [{ at: '2026-10-01T10:00:00.000Z', stage: 'reminder', periods: ['2026-10'], amount: 99.99 }],
  }
  return db
})
const escalated = await runDueReminders({
  store,
  env: { BREVO_API_KEY: 'x' },
  today: '2026-11-05',
  sendReminder: async (_env, _record, opts) => {
    failMails.push({ stage: opts.stage })
    return 'sent'
  },
})
assert(escalated.sent >= 1 && escalated.byStage?.mahnung1 >= 1, 'cron escalates to mahnung1')

console.log('dues extra tests ok')
