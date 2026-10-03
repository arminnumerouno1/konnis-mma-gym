/** Erste volle Monatsabbuchung. Muss zum Hinweis in src/brand/plans.ts passen. */
export const BILLING_START = '2026-11-01'
const TRIAL_LEAD_S = 48 * 60 * 60

export const PLAN_CENTS = {
  standard: 9999,
  flex: 10999,
  daypass: 1999,
  first50: 8999,
}

/** Live-Katalog. Banküberweisung hängt am Abo, nicht an der Checkout-Kasse. */
export const PLAN_PRICE_IDS = {
  standard: 'price_1UMNxnD4ksjkwudyGRda0gwd',
  flex: 'price_1UMNxnD4ksjkwudynbGW3FCH',
  first50: 'price_1UMNxoD4ksjkwudyRZGWyB5g',
}

const PLAN_NAMES = {
  standard: 'Standard',
  flex: 'Flex',
  daypass: 'Day Pass',
  first50: 'First 50',
}

function berlinOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - date.getTime()) / 60_000)
}

/** Mitternacht Europe/Berlin des Kalendertags, als Unix-Sekunden. */
export function berlinMidnightUnix(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return null
  const utcMidnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  let unixMs = utcMidnight
  for (let i = 0; i < 3; i += 1) {
    unixMs = utcMidnight - berlinOffsetMinutes(new Date(unixMs)) * 60_000
  }
  return Math.floor(unixMs / 1000)
}

export function berlinIsoDate(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function nextFirstIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return BILLING_START
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (day === 1) return iso
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

/**
 * Vor dem 1. November: Testphase bis Mitternacht, keine Abbuchung.
 * Danach am 1.: sofort der volle Monat. Mitten im Monat: Anteil jetzt, voller Monat ab dem nächsten 1.
 */
export function checkoutSchedule(nowMs, { plan = 'standard', billingStart = BILLING_START } = {}) {
  const anchor = berlinMidnightUnix(billingStart)
  const nowS = Math.floor(nowMs / 1000)
  const today = berlinIsoDate(nowMs)
  if (plan === 'daypass') {
    if (today < billingStart) return { skip: 'before_opening', billingStart, chargeNow: false }
    return { mode: 'payment', delay: 'payment', billingStart: null, chargeNow: true }
  }
  if (anchor == null) return { skip: 'before_opening', billingStart, chargeNow: false }
  if (nowS < anchor) {
    if (anchor - nowS >= TRIAL_LEAD_S) {
      return { mode: 'subscription', delay: 'trial', trialEnd: anchor, billingStart, chargeNow: false }
    }
    return {
      mode: 'subscription',
      delay: 'anchor',
      cycleAnchor: anchor,
      prorate: false,
      billingStart,
      chargeNow: false,
    }
  }
  if (today.endsWith('-01')) {
    return { mode: 'subscription', delay: 'now', billingStart: today, chargeNow: true }
  }
  const next = nextFirstIso(today)
  return {
    mode: 'subscription',
    delay: 'prorate',
    cycleAnchor: berlinMidnightUnix(next),
    prorate: true,
    billingStart: next,
    chargeNow: true,
  }
}

export function siteOrigin(req, env = {}) {
  const configured = String(env.VITE_SITE_URL || env.SITE_URL || '').trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.hostname === 'mma-in-leipzig.de' || url.hostname === 'www.mma-in-leipzig.de') {
        return 'https://www.mma-in-leipzig.de'
      }
      return url.origin
    } catch {
      /* weiter mit Host */
    }
  }
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim()
  if (host && !host.startsWith('localhost') && !host.startsWith('127.')) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https')
      .split(',')[0]
      .trim()
    return `${proto}://${host}`
  }
  return 'https://www.mma-in-leipzig.de'
}

export function buildCheckoutFields({ member, origin, nowMs = Date.now() }) {
  const cents = PLAN_CENTS[member?.plan]
  if (!cents || !member?.id) return { error: 'plan' }
  if (!member.email && !member.stripe?.customerId) return { error: 'email' }
  const schedule = checkoutSchedule(nowMs, { plan: member.plan })
  if (schedule.skip) return { skip: schedule.skip, schedule }
  const name = `KONNI MMA GYM · ${member.planName || PLAN_NAMES[member.plan] || member.plan}`
  const fields = {
    mode: schedule.mode,
    client_reference_id: member.id,
    locale: 'de',
    success_url: `${origin}/mitglied?zahlung=ok`,
    cancel_url: `${origin}/mitglied?zahlung=abgebrochen`,
    'metadata[memberId]': member.id,
    'metadata[plan]': member.plan,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(cents),
    'line_items[0][price_data][product_data][name]': name,
  }
  if (member.stripe?.customerId) fields.customer = member.stripe.customerId
  else fields.customer_email = member.email
  if (schedule.mode === 'subscription') {
    fields['line_items[0][price_data][recurring][interval]'] = 'month'
    fields['subscription_data[metadata][memberId]'] = member.id
    if (schedule.delay === 'trial') fields['subscription_data[trial_end]'] = String(schedule.trialEnd)
    if (schedule.delay === 'anchor' || schedule.delay === 'prorate') {
      fields['subscription_data[billing_cycle_anchor]'] = String(schedule.cycleAnchor)
    }
    if (schedule.delay === 'anchor') fields['subscription_data[proration_behavior]'] = 'none'
  }
  return { fields, schedule }
}

function formBody(fields) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== '') body.append(key, String(value))
  }
  return body
}

async function postSession(fetchImpl, secret, fields) {
  const response = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: formBody(fields),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error?.message || `stripe_${response.status}`)
    error.stripeCode = data?.error?.code || ''
    error.stripeParam = data?.error?.param || ''
    throw error
  }
  return data
}

async function stripeForm(fetchImpl, secret, path, fields, method = 'POST') {
  const response = await fetchImpl(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${secret}`,
      ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? formBody(fields) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error?.message || `stripe_${response.status}`)
    error.stripeCode = data?.error?.code || ''
    throw error
  }
  return data
}

/**
 * Monatsabo per Überweisung. Stripe Checkout kann das im Abo nicht.
 * Stattdessen: Kunde, virtuelle IBAN, Abo mit Rechnung. Vor dem 1. November nur Testphase, Betrag 0, Entwurf, keine Mail.
 */
export async function createBankTransferSubscription({ secret, member, nowMs = Date.now(), fetchImpl = fetch }) {
  const price = PLAN_PRICE_IDS[member?.plan]
  if (!price || !member?.id || !member?.email) return { ok: false, error: 'plan' }
  const schedule = checkoutSchedule(nowMs, { plan: member.plan })
  if (schedule.mode !== 'subscription') return { ok: false, error: 'plan' }

  let customerId = ''
  try {
    const customer = await stripeForm(fetchImpl, secret, '/customers', {
      email: member.email,
      name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
      phone: member.phone || '',
      'address[line1]': member.street || '',
      'address[postal_code]': member.zip || '',
      'address[city]': member.city || '',
      'address[country]': 'DE',
      'metadata[memberId]': member.id,
      'metadata[plan]': member.plan,
    })
    customerId = customer.id
    const funding = await stripeForm(fetchImpl, secret, `/customers/${customer.id}/funding_instructions`, {
      funding_type: 'bank_transfer',
      currency: 'eur',
      'bank_transfer[type]': 'eu_bank_transfer',
      'bank_transfer[eu_bank_transfer][country]': 'DE',
    })
    const iban = funding?.bank_transfer?.financial_addresses?.find((row) => row.type === 'iban')?.iban
    if (!iban?.iban) throw new Error('no_iban')

    const fields = {
      customer: customer.id,
      'items[0][price]': price,
      collection_method: 'send_invoice',
      days_until_due: '14',
      proration_behavior: schedule.prorate ? 'create_prorations' : 'none',
      'payment_settings[payment_method_types][0]': 'customer_balance',
      'payment_settings[payment_method_options][customer_balance][funding_type]': 'bank_transfer',
      'payment_settings[payment_method_options][customer_balance][bank_transfer][type]': 'eu_bank_transfer',
      'payment_settings[payment_method_options][customer_balance][bank_transfer][eu_bank_transfer][country]': 'DE',
      'metadata[memberId]': member.id,
      'metadata[plan]': member.plan,
    }
    if (schedule.delay === 'trial') fields.trial_end = String(schedule.trialEnd)
    if (schedule.delay === 'anchor' || schedule.delay === 'prorate') {
      fields.billing_cycle_anchor = String(schedule.cycleAnchor)
    }
    const subscription = await stripeForm(fetchImpl, secret, '/subscriptions', fields)
    if (!subscription?.id) return { ok: false, error: 'stripe', detail: 'no_subscription' }
    return {
      ok: true,
      customerId: customer.id,
      subscriptionId: subscription.id,
      billingStart: schedule.billingStart,
      chargeNow: Boolean(schedule.chargeNow),
      delay: schedule.delay,
      transfer: {
        iban: String(iban.iban).replace(/\s/g, ''),
        bic: String(iban.bic || ''),
        holder: String(iban.account_holder_name || ''),
        amount: PLAN_CENTS[member.plan],
      },
    }
  } catch (error) {
    if (customerId) {
      try {
        await stripeForm(fetchImpl, secret, `/customers/${customerId}`, {}, 'DELETE')
      } catch {
        /* Kunde bleibt, die Anmeldung zeigt den Fehler */
      }
    }
    return { ok: false, error: 'stripe', detail: error instanceof Error ? error.message : 'stripe' }
  }
}

export async function createCheckoutSession({ secret, member, origin, nowMs = Date.now(), fetchImpl = fetch }) {
  const built = buildCheckoutFields({ member, origin, nowMs })
  if (built.error) return { ok: false, error: built.error }
  if (built.skip) return { ok: true, skipped: built.skip, billingStart: built.schedule.billingStart, chargeNow: false }
  try {
    const data = await postSession(fetchImpl, secret, built.fields)
    if (!data?.url || !data?.id) return { ok: false, error: 'stripe', detail: 'no_url' }
    return {
      ok: true,
      id: data.id,
      url: data.url,
      billingStart: built.schedule.billingStart,
      chargeNow: Boolean(built.schedule.chargeNow),
      delay: built.schedule.delay,
    }
  } catch (error) {
    return { ok: false, error: 'stripe', detail: error instanceof Error ? error.message : 'stripe' }
  }
}
