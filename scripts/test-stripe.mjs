import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMembershipHandler } from '../server/membership.mjs'
import { createMemberStore } from '../server/member-store.mjs'
import { GYM_BANK } from '../server/gym-bank.mjs'
import {
  PLAN_CENTS,
  berlinMidnightUnix,
  buildCheckoutFields,
  checkoutSchedule,
  createCheckoutSession,
} from '../server/stripe-checkout.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const nov1 = berlinMidnightUnix('2026-11-01')
assert(nov1 === Math.floor(Date.parse('2026-10-31T23:00:00.000Z') / 1000), '1 Nov 2026 is 23:00 UTC')
assert(berlinMidnightUnix('2026-06-01') === Math.floor(Date.parse('2026-05-31T22:00:00.000Z') / 1000), 'summer offset')
assert(PLAN_CENTS.standard === 9999 && PLAN_CENTS.flex === 10999 && PLAN_CENTS.daypass === 1999, 'cents')

const early = new Date('2026-10-02T12:00:00.000Z').getTime()
const earlyPlan = checkoutSchedule(early, { plan: 'standard' })
assert(earlyPlan.delay === 'trial' && earlyPlan.trialEnd === nov1 && earlyPlan.chargeNow === false, 'october uses trial')
const earlyFields = buildCheckoutFields({
  member: { id: 'mem_1', plan: 'standard', planName: 'Standard', email: 'anna@example.com' },
  origin: 'https://www.mma-in-leipzig.de',
  nowMs: early,
})
assert(earlyFields.fields['subscription_data[trial_end]'] === String(nov1), 'trial_end set')
assert(!earlyFields.fields['subscription_data[billing_cycle_anchor]'], 'no anchor while trial fits')
assert(earlyFields.fields['line_items[0][price_data][unit_amount]'] === '9999', 'standard cents')
assert(earlyFields.fields.mode === 'subscription', 'subscription mode')
assert(earlyFields.fields['metadata[memberId]'] === 'mem_1', 'member metadata')
assert(earlyFields.fields['payment_method_types[0]'] === 'card', 'card enables apple pay')
assert(!earlyFields.fields['payment_method_types[1]'], 'no sepa debit')

const close = nov1 * 1000 - 47 * 60 * 60 * 1000
const closePlan = checkoutSchedule(close, { plan: 'flex' })
assert(closePlan.delay === 'anchor' && closePlan.prorate === false && closePlan.cycleAnchor === nov1, 'inside 48h anchors without proration')
const closeFields = buildCheckoutFields({
  member: { id: 'mem_2', plan: 'flex', email: 'flex@example.com' },
  origin: 'https://www.mma-in-leipzig.de',
  nowMs: close,
})
assert(closeFields.fields['subscription_data[proration_behavior]'] === 'none', 'no charge in the last 48h')
assert(!closeFields.fields['subscription_data[trial_end]'], 'trial skipped inside 48h')
assert(closeFields.fields['line_items[0][price_data][unit_amount]'] === '10999', 'flex cents')

const opened = new Date('2026-11-02T10:00:00.000Z').getTime()
const openedPlan = checkoutSchedule(opened, { plan: 'standard' })
assert(openedPlan.delay === 'prorate' && openedPlan.chargeNow === true, 'after opening prorate the rest of the month')
assert(openedPlan.billingStart === '2026-12-01', 'full months from december')

const firstOfMonth = new Date('2026-11-01T10:00:00.000Z').getTime()
const firstPlan = checkoutSchedule(firstOfMonth, { plan: 'standard' })
assert(firstPlan.delay === 'now' && firstPlan.billingStart === '2026-11-01', 'the 1st charges the full month now')

const dayEarly = buildCheckoutFields({
  member: { id: 'day_1', plan: 'daypass', email: 'day@example.com' },
  origin: 'https://www.mma-in-leipzig.de',
  nowMs: early,
})
assert(dayEarly.skip === 'before_opening', 'day pass waits until november')
const dayLate = buildCheckoutFields({
  member: { id: 'day_2', plan: 'daypass', email: 'day@example.com' },
  origin: 'https://www.mma-in-leipzig.de',
  nowMs: opened,
})
assert(dayLate.fields.mode === 'payment' && !dayLate.fields['line_items[0][price_data][recurring][interval]'], 'day pass is one payment')

const seen = []
const openedSession = await createCheckoutSession({
  secret: 'sk_test_example',
  member: { id: 'mem_1', plan: 'standard', email: 'anna@example.com', stripe: { customerId: 'cus_abc12345' } },
  origin: 'https://www.mma-in-leipzig.de',
  nowMs: early,
  fetchImpl: async (_url, init) => {
    seen.push(String(init.body))
    return {
      ok: true,
      async json() {
        return { id: 'cs_card', url: 'https://checkout.stripe.com/c/pay/cs_card' }
      },
    }
  },
})
assert(openedSession.ok && openedSession.url.includes('checkout.stripe.com'), 'card checkout opens')
assert(seen.length === 1, 'checkout is requested once')
const postedCheckout = new URLSearchParams(seen[0] || '')
assert(postedCheckout.get('payment_method_types[0]') === 'card' && !postedCheckout.get('payment_method_types[1]'), 'card only, no sepa')
assert(![...postedCheckout.values()].includes('sepa_debit'), 'sepa is not requested')
assert(postedCheckout.get('customer') === 'cus_abc12345' && !postedCheckout.get('customer_email'), 'existing customer is reused')

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

const dataDir = mkdtempSync(join(tmpdir(), 'konni-stripe-'))
let posted = ''
const handle = createMembershipHandler({
  dataDir,
  env: { SIGNUP_OPEN: 'true', STRIPE_SECRET_KEY: 'sk_test_example' },
  fetchImpl: async (_url, init) => {
    posted = String(init.body)
    return {
      ok: true,
      async json() {
        return { id: 'cs_join', url: 'https://checkout.stripe.com/c/pay/cs_join' }
      },
    }
  },
})
const { res, captured } = mockRes()
await handle(
  {
    method: 'POST',
    url: '/api/mitglied',
    headers: {},
    socket: { remoteAddress: '127.0.0.8' },
    body: {
      plan: 'standard',
      firstName: 'Anna',
      lastName: 'Müller',
      birthDate: '1994-04-12',
      street: 'Wittenberger Straße 15',
      zip: '04129',
      city: 'Leipzig',
      email: 'anna-stripe@example.com',
      phone: '+49 171 1234567',
      place: 'Leipzig',
      signature: 'Anna Müller',
      consents: { agb: true, hausordnung: true, widerruf: true, privacy: true, health: true, sign: true },
    },
  },
  res,
)
const joined = JSON.parse(captured.body)
assert(captured.status === 200 && joined.ok && joined.payment === 'checkout', 'signup returns checkout')
assert(joined.checkoutUrl.startsWith('https://checkout.stripe.com/'), 'signup checkout url')
const joinParams = new URLSearchParams(posted)
assert(joinParams.get('subscription_data[trial_end]') === String(nov1), 'signup trial is 1 november')
assert(joinParams.get('metadata[memberId]') === joined.id, 'signup metadata')
const db = await createMemberStore({ dataDir, env: {} }).load()
const stored = db.members.find((row) => row.id === joined.id)
assert(stored.stripe.billingStart === '2026-11-01' && stored.stripe.chargeNow === false, 'member remembers november')
assert(stored.stripe.checkoutSessionId === 'cs_join', 'session id stored')

const bankDir = mkdtempSync(join(tmpdir(), 'konni-bank-'))
const bankCalls = []
const bankHandle = createMembershipHandler({
  dataDir: bankDir,
  env: { SIGNUP_OPEN: 'true', STRIPE_SECRET_KEY: 'sk_test_example', MEMBERSHIP_MAIL: 'false' },
  fetchImpl: async (url, init) => {
    bankCalls.push({ url: String(url), method: init?.method || 'GET', body: String(init?.body || '') })
    return { ok: true, async json() { return { id: 'unused' } } }
  },
})
const bankRes = mockRes()
await bankHandle(
  {
    method: 'POST',
    url: '/api/mitglied',
    headers: {},
    socket: { remoteAddress: '127.0.0.18' },
    body: {
      plan: 'standard',
      payMethod: 'transfer',
      firstName: 'Anna',
      lastName: 'Müller',
      birthDate: '1994-04-12',
      street: 'Wittenberger Straße 15',
      zip: '04129',
      city: 'Leipzig',
      email: 'anna-bank@example.com',
      phone: '+49 171 1234567',
      place: 'Leipzig',
      signature: 'Anna Müller',
      consents: { agb: true, hausordnung: true, widerruf: true, privacy: true, health: true, sign: true },
    },
  },
  bankRes.res,
)
const bankJoined = JSON.parse(bankRes.captured.body)
assert(bankRes.captured.status === 200 && bankJoined.payment === 'transfer', 'signup returns transfer')
assert(bankJoined.transfer.iban === GYM_BANK.iban, 'gym iban returned')
assert(bankJoined.transfer.bic === 'WELADE8LXXX', 'sparkasse bic')
assert(bankJoined.transfer.holder === 'KONNI MMA GYM GbR', 'gym holder')
assert(bankJoined.transfer.bank === GYM_BANK.bank, 'sparkasse name')
assert(bankJoined.transfer.amount === 9999, 'monthly cents')
assert(!bankJoined.checkoutUrl, 'transfer does not open card checkout')
assert(bankCalls.length === 0, 'transfer does not call stripe')
const bankDb = await createMemberStore({ dataDir: bankDir, env: {} }).load()
const bankStored = bankDb.members.find((row) => row.id === bankJoined.id)
assert(bankStored.payMethod === 'transfer', 'member pay method stored')
assert(bankStored.transfer.iban === GYM_BANK.iban, 'gym iban stored')
assert(!bankStored.stripe?.subscriptionId, 'no stripe subscription for transfer')

console.log('stripe tests ok')
