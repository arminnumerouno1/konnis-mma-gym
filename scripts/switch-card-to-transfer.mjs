/**
 * Ops: Karte/Apple-Pay → Überweisung, Stripe-Abo beenden, Infomail.
 * Usage: node scripts/switch-card-to-transfer.mjs [--dry]
 */
import { createMemberStore } from '../server/member-store.mjs'
import { setPayment, isoDate } from '../server/member-model.mjs'
import { buildTransferPayload, transferPurpose } from '../server/transfer-due.mjs'
import { GYM_BANK } from '../server/gym-bank.mjs'
import { sendTransferSwitchEmail } from '../server/membership-mail.mjs'

const DRY = process.argv.includes('--dry')
const TODAY = isoDate()
const NEXT_FULL = '2026-12-01'

/** Stable IDs for this ops run (names as given by desk). */
const TARGET_IDS = [
  '3c94fc87-6003-469d-81a9-8d78b96f26df', // Niklas Kruse
  'ab437b50-ba25-4a8a-a519-264bbe6e153f', // Adrian Dettloff
  '1c9b7b08-9510-4262-bf6e-e5dc60e752ed', // Paul Schneider
  '9c7eff30-d333-46f4-87ab-eb4385ea316a', // Martin Rudek
  'aca95975-d357-47da-b011-4d559189bb11', // Onur Cakar
  '4ed0dbb2-6427-4a57-9c6d-90a7c34e9840', // Domenic Koch
  '4448e302-e234-43a3-9517-86cc3677d5ff', // Abdul-Kerim Asaev
  '1da440e7-801d-49e8-b444-dddf49d8887b', // John-Pierre Frenzel
  'ba086961-d42d-48b9-8ca0-4172c7c2af8b', // David Rotter
  'b9fb5e9d-8c34-45ab-8ee3-2ec5338bb6f3', // Müslüm Ince
  'fa15d48d-8619-4f8f-a225-b94ad3e7250b', // Colin Ropella
  '477dd5ff-ad1d-4d58-a58b-35bf5313022d', // Hugo Nowak (nine.nowak / Mutter-Karte Apple Pay)
  '88797dbd-fc62-4694-b267-4b3ddae1989d', // Hugo Nowak (h_n_n_2008)
]

async function stripeRequest(method, path, fields = null) {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('missing STRIPE_SECRET_KEY')
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data?.error?.message || `stripe_${res.status}`)
    err.data = data
    throw err
  }
  return data
}

async function stripeGet(path) {
  return stripeRequest('GET', path)
}

async function cancelOneSub(subId, via = 'stored') {
  // Immediate cancel: DELETE /v1/subscriptions/:id
  const canceled = await stripeRequest('DELETE', `subscriptions/${subId}`, {
    invoice_now: 'false',
    prorate: 'false',
  })
  return { sub: subId, status: canceled.status || 'canceled', via }
}

async function cancelStripeFor(member) {
  const results = []
  const seen = new Set()
  const subId = member.stripe?.subscriptionId
  if (subId) {
    try {
      results.push(await cancelOneSub(subId, 'stored'))
      seen.add(subId)
    } catch (error) {
      results.push({ sub: subId, error: String(error.message || error), via: 'stored' })
      seen.add(subId)
    }
  }
  const customerId = member.stripe?.customerId
  if (customerId) {
    const list = await stripeGet(`subscriptions?customer=${customerId}&status=all&limit=20`)
    for (const sub of list.data || []) {
      if (seen.has(sub.id)) continue
      if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue
      try {
        results.push(await cancelOneSub(sub.id, 'customer'))
      } catch (error) {
        results.push({ sub: sub.id, error: String(error.message || error), via: 'customer' })
      }
    }
  }
  return results
}

function transferAfterPaidMonth(member) {
  const base = buildTransferPayload(member, Date.now())
  const monthCents = Math.round(Number(member.price) * 100) || 0
  return {
    ...base,
    amount: monthCents,
    monthAmount: monthCents,
    prorateAmount: monthCents,
    feeAmount: 0,
    prorated: false,
    dueNow: false,
    firstDueDate: NEXT_FULL,
    nextFullDue: NEXT_FULL,
    purpose: transferPurpose(member) || base.purpose,
    holder: GYM_BANK.holder,
    iban: GYM_BANK.iban,
    bic: GYM_BANK.bic,
    bank: GYM_BANK.bank,
  }
}

function withNovPaid(member) {
  const nov = (member.payments || []).find((row) => row.kind === 'month' && row.period === '2026-11')
  if (nov?.status === 'paid') {
    // Keep paid, but note transfer settlement when it was open/failed before ops.
    return member
  }
  return setPayment(
    member,
    {
      period: '2026-11',
      kind: 'month',
      status: 'paid',
      note: 'Überweisung (Umstellung von Karte/Apple Pay)',
      source: 'manual',
      ref: null,
      amount: Number(member.price) || nov?.amount || null,
    },
    TODAY,
  )
}

function switchMember(member) {
  let next = withNovPaid(member)
  const transfer = transferAfterPaidMonth(next)
  next = {
    ...next,
    payMethod: 'transfer',
    transfer,
    stripe: null,
    payLinkAt: null,
    updatedAt: new Date().toISOString(),
    notes: [next.notes, 'Zahlungsart 2026-11-03: Karte/Apple Pay → Überweisung, Stripe beendet']
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000),
  }
  return next
}

const store = createMemberStore({ dataDir: '/tmp/konni-members-local', env: process.env })
const db = await store.load()
const targets = TARGET_IDS.map((id) => db.members.find((m) => m.id === id)).filter(Boolean)
if (targets.length !== TARGET_IDS.length) {
  const missing = TARGET_IDS.filter((id) => !db.members.some((m) => m.id === id))
  console.error('missing members', missing)
  process.exit(1)
}

console.log(
  'targets',
  targets.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
    email: m.email,
    payMethod: m.payMethod,
    sub: m.stripe?.subscriptionId || null,
    cus: m.stripe?.customerId || null,
    nov: (m.payments || []).find((p) => p.period === '2026-11')?.status,
  })),
)

if (DRY) {
  console.log('dry-run only')
  process.exit(0)
}

const stripeResults = []
for (const member of targets) {
  try {
    const canceled = await cancelStripeFor(member)
    stripeResults.push({ id: member.id, name: `${member.firstName} ${member.lastName}`, canceled })
  } catch (error) {
    stripeResults.push({ id: member.id, name: `${member.firstName} ${member.lastName}`, error: String(error.message || error) })
  }
}
console.log('stripe', JSON.stringify(stripeResults, null, 2))

const idSet = new Set(TARGET_IDS)
await store.update((fresh) => {
  for (let i = 0; i < fresh.members.length; i += 1) {
    if (!idSet.has(fresh.members[i].id)) continue
    fresh.members[i] = switchMember(fresh.members[i])
  }
  return fresh
})

const after = await store.load()
const mailed = []
for (const id of TARGET_IDS) {
  const member = after.members.find((m) => m.id === id)
  const row = {
    id,
    name: `${member.firstName} ${member.lastName}`,
    email: member.email,
    payMethod: member.payMethod,
    stripe: member.stripe,
    nov: (member.payments || []).find((p) => p.period === '2026-11'),
    nextDue: member.transfer?.nextFullDue,
  }
  let mail = 'skipped'
  try {
    mail = await sendTransferSwitchEmail(process.env, member)
  } catch (error) {
    mail = `error:${error.message || error}`
  }
  mailed.push({ ...row, mail })
  // gentle rate limit for Brevo
  await new Promise((r) => setTimeout(r, 400))
}

console.log('done', JSON.stringify(mailed, null, 2))
