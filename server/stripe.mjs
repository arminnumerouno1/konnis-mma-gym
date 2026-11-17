import { createHmac, timingSafeEqual } from 'node:crypto'
import { checkoutComplete, sendContractMailOnce } from './contract-mail.mjs'
import { isoDate, setPayment } from './member-model.mjs'
import { createMemberStore } from './member-store.mjs'
import { sendPaymentFailedEmail } from './membership-mail.mjs'
import {
  checkoutConfirmSecret,
  createPaymentRetryUrl,
  siteOrigin,
  verifyCheckoutConfirm,
} from './stripe-checkout.mjs'

const TOLERANCE_S = 300
const MAX_BODY = 1_000_000
const INVOICE_STATUS = {
  'invoice.paid': 'paid',
  'invoice.payment_succeeded': 'paid',
  'invoice.payment_failed': 'failed',
  'invoice.marked_uncollectible': 'failed',
  'invoice.payment_action_required': 'open',
  'invoice.finalized': 'open',
  'invoice.voided': 'waived',
}

export function verifyStripeSignature(rawBody, header, secret, nowS = Math.floor(Date.now() / 1000)) {
  if (!secret || !header) return false
  const parts = String(header)
    .split(',')
    .map((part) => part.trim().split('='))
  const t = Number(parts.find(([key]) => key === 't')?.[1])
  const sigs = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowS - t) > TOLERANCE_S) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'))
  return sigs.some((sig) => {
    const given = Buffer.from(String(sig))
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

function berlinYm(unixS) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(unixS * 1000))
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}`
}

function invoiceMemberId(invoice) {
  return (
    invoice.parent?.subscription_details?.metadata?.memberId ||
    invoice.subscription_details?.metadata?.memberId ||
    invoice.metadata?.memberId ||
    invoice.client_reference_id ||
    invoice.lines?.data?.[0]?.metadata?.memberId ||
    ''
  )
}

function invoicePeriod(invoice) {
  const start = invoice.lines?.data?.[0]?.period?.start || invoice.period_end || invoice.created
  return Number.isFinite(start) ? berlinYm(start) : null
}

export function findMemberIndex(members, invoice) {
  const memberId = invoiceMemberId(invoice)
  if (memberId) {
    const byId = members.findIndex((row) => row.id === memberId)
    if (byId >= 0) return byId
  }
  const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (customer) {
    const byCustomer = members.findIndex((row) => row.stripe?.customerId === customer)
    if (byCustomer >= 0) return byCustomer
  }
  const email = String(invoice.customer_email || invoice.customer_details?.email || '').trim().toLowerCase()
  if (email) {
    const hits = members.filter((row) => row.email === email && row.plan !== 'daypass')
    if (hits.length === 1) return members.indexOf(hits[0])
  }
  return -1
}

function stripeId(value) {
  if (typeof value === 'string') return value
  if (value && typeof value.id === 'string') return value.id
  return ''
}

function lineLooksLikeSignupFee(line) {
  const bits = [
    line?.description,
    line?.price?.product?.name,
    typeof line?.price?.product === 'string' ? line.price.product : '',
    line?.plan?.nickname,
  ]
  return bits.some((bit) => /aufnahmegebühr/i.test(String(bit || '')))
}

/** Cents of Aufnahmegebühr on a Stripe invoice, or 0 if not present. */
export function invoiceSignupFeeCents(invoice, feeEuro = 0) {
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : []
  const named = lines.find((line) => lineLooksLikeSignupFee(line))
  if (named && Number.isFinite(named.amount)) return Math.max(0, Math.round(named.amount))
  const expected = Math.round((Number(feeEuro) || 0) * 100)
  if (expected > 0) {
    const byAmount = lines.find((line) => Math.round(Number(line?.amount) || 0) === expected)
    if (byAmount) return expected
  }
  return 0
}

function feeStillOpen(member) {
  if ((Number(member?.fee) || 0) <= 0) return false
  return !(member.payments || []).some((row) => row.kind === 'fee' && row.status === 'paid')
}

function markSignupFeePaid(member, { note, ref, amount, today }) {
  return setPayment(
    member,
    {
      period: 'fee',
      kind: 'fee',
      status: 'paid',
      note,
      source: 'stripe',
      ref,
      amount: typeof amount === 'number' ? amount : Number(member.fee) || null,
    },
    today,
  )
}

function applyCheckoutCompleted(db, event, today) {
  const session = event?.data?.object
  if (session?.object !== 'checkout.session') return { handled: false, reason: 'ignored' }
  const index = findMemberIndex(db.members, session)
  if (index < 0) return { handled: false, reason: 'unmatched' }
  const member = db.members[index]
  const customer = stripeId(session.customer)
  const subscription = stripeId(session.subscription)
  const linked = {
    ...member,
    stripe: {
      ...(member.stripe ?? {}),
      ...(customer ? { customerId: customer } : {}),
      ...(subscription ? { subscriptionId: subscription } : {}),
      checkoutSessionId: session.id,
      linkedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  }
  const paidDay =
    session.mode === 'payment' && session.payment_status === 'paid' && member.plan === 'daypass'
  let next = linked
  if (paidDay) {
    const amount = Number.isFinite(session.amount_total) ? Math.round(session.amount_total) / 100 : null
    next = setPayment(
      next,
      {
        period: member.visitDay || member.startDate || today,
        kind: 'day',
        status: 'paid',
        note: `Stripe ${session.id}`,
        source: 'stripe',
        ref: session.id,
        amount,
      },
      today,
    )
  }
  // Card checkout settles immediately as "paid". Subscription first invoices can also
  // land as "no_payment_required" when only a later cycle charges — still mark fee if
  // the session total clearly includes the Aufnahmegebühr (one-time line at checkout).
  const feeDue = Number(member.fee) || 0
  const sessionTotal = Number.isFinite(session.amount_total) ? Math.round(session.amount_total) : null
  const feeLikelyPaid =
    feeDue > 0 &&
    (session.payment_status === 'paid' ||
      (session.payment_status === 'no_payment_required' && sessionTotal != null && sessionTotal >= Math.round(feeDue * 100)))
  if (feeLikelyPaid && feeStillOpen(member)) {
    next = markSignupFeePaid(next, {
      note: `Aufnahmegebühr Stripe ${session.id}`,
      ref: `${session.id}:fee`,
      amount: feeDue,
      today,
    })
  }
  db.members[index] = next
  return { handled: true, memberId: member.id, linked: true, charged: Boolean(paidDay) }
}

function invoiceEventStatus(eventType, invoice) {
  const mapped = INVOICE_STATUS[eventType]
  if (!mapped) return null
  // Checkout often finalizes an invoice that is already paid in the same second.
  // Never treat that as "open" — otherwise a late/racy finalized webhook undoes paid.
  if (mapped === 'open' && (invoice?.status === 'paid' || invoice?.paid === true)) return 'paid'
  return mapped
}

export function applyStripeEvent(db, event, today = isoDate()) {
  if (event?.type === 'checkout.session.completed') return applyCheckoutCompleted(db, event, today)
  const invoice = event?.data?.object
  const status = invoiceEventStatus(event?.type, invoice)
  if (!status || invoice?.object !== 'invoice') return { handled: false, reason: 'ignored' }
  const index = findMemberIndex(db.members, invoice)
  if (index < 0) return { handled: false, reason: 'unmatched' }
  const period = invoicePeriod(invoice)
  if (!period) return { handled: false, reason: 'period' }
  const member = db.members[index]
  const current = (member.payments ?? []).find((row) => row.kind === 'month' && row.period === period)
  // Never downgrade a paid Stripe row back to open for the same invoice.
  if (current?.status === 'paid' && status === 'open' && (!current.ref || current.ref === invoice.id)) {
    return { handled: true, memberId: member.id, period, status: 'paid' }
  }
  const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  const withStripe = customer
    ? { ...member, stripe: { ...(member.stripe ?? {}), customerId: customer } }
    : member
  const feeCents = status === 'paid' ? invoiceSignupFeeCents(invoice, member.fee) : 0
  const totalDue = Number.isFinite(invoice.amount_due) ? Math.round(invoice.amount_due) : null
  const amount =
    totalDue == null ? null : Math.round(totalDue - (feeCents > 0 && feeStillOpen(member) ? feeCents : 0)) / 100
  let next = setPayment(
    withStripe,
    {
      period,
      kind: 'month',
      status,
      note: `Stripe ${invoice.number || invoice.id}`,
      source: 'stripe',
      ref: invoice.id,
      amount,
    },
    today,
  )
  if (status === 'paid' && feeCents > 0 && feeStillOpen(member)) {
    next = markSignupFeePaid(next, {
      note: `Aufnahmegebühr Stripe ${invoice.number || invoice.id}`,
      ref: `${invoice.id}:fee`,
      amount: feeCents / 100,
      today,
    })
  }
  db.members[index] = next
  return { handled: true, memberId: member.id, period, status, feePaid: feeCents > 0 }
}

async function readRaw(req) {
  if (typeof req.rawBody === 'string') return req.rawBody
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8')
  return await new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too_large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function reply(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function deliverContractMail(store, env, result, session) {
  // Vertragsmail schon bei abgeschlossenem Checkout (auch SEPA unpaid): Mandat/Karte ist da.
  // Beitrag/Aufnahmegebühr bleibt über payment_status paid / async_payment_succeeded / invoice.paid.
  if (!result?.handled || !checkoutComplete(session)) return result
  const mail = await sendContractMailOnce(store, env, result.memberId)
  return { ...result, mail: mail.sent ? 'sent' : mail.reason }
}

function isCheckoutSessionEvent(type) {
  return (
    type === 'checkout.session.completed' ||
    type === 'checkout.session.async_payment_succeeded' ||
    type === 'checkout.session.async_payment_failed'
  )
}

const FAIL_MAIL_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

/**
 * @param {{
 *   dataDir?: string
 *   env?: Record<string, string | undefined>
 *   fetchImpl?: typeof fetch
 *   sendFailMail?: typeof sendPaymentFailedEmail
 * }} [opts]
 */
export function createStripeHandler({
  dataDir,
  env,
  fetchImpl = fetch,
  sendFailMail = sendPaymentFailedEmail,
} = {}) {
  const store = createMemberStore({ dataDir, env })

  async function notifyPaymentFailed(result) {
    if (!result?.handled || result.status !== 'failed' || !result.memberId) return result
    const db = await store.load()
    const member = db.members.find((row) => row.id === result.memberId)
    if (!member?.email) return result
    if (member.stripeFailMailAt) {
      const age = Date.now() - Date.parse(member.stripeFailMailAt)
      if (Number.isFinite(age) && age < FAIL_MAIL_COOLDOWN_MS) return { ...result, failMail: 'cooldown' }
    }
    let retryUrl = ''
    let retryKind = ''
    const secret = env.STRIPE_SECRET_KEY?.trim() || ''
    if (secret) {
      try {
        const retry = await createPaymentRetryUrl({
          secret,
          member,
          origin: siteOrigin({ headers: {} }, env),
          fetchImpl,
          confirmSecret: checkoutConfirmSecret(env) || secret,
        })
        if (retry.ok) {
          retryUrl = retry.url
          retryKind = retry.kind
        }
      } catch (error) {
        console.error('[stripe] retry url', error)
      }
    }
    let mailed = 'skipped'
    try {
      mailed = await sendFailMail(env, member, {
        period: result.period,
        amount: member.price,
        retryUrl,
        retryKind,
      })
    } catch (error) {
      console.error('[stripe] fail mail', error)
      return { ...result, failMail: 'error' }
    }
    if (mailed && mailed !== 'skipped') {
      const at = new Date().toISOString()
      await store.update((fresh) => {
        const index = fresh.members.findIndex((row) => row.id === member.id)
        if (index < 0) return fresh
        fresh.members[index] = { ...fresh.members[index], stripeFailMailAt: at, updatedAt: at }
        return fresh
      })
    }
    return { ...result, failMail: mailed }
  }

  async function confirmSession(raw, res) {
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      reply(res, 400, { ok: false, error: 'invalid' })
      return
    }
    const sessionId = String(body?.sessionId || '')
    const confirm = String(body?.confirm || '')
    if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) {
      reply(res, 400, { ok: false, error: 'invalid' })
      return
    }
    const key = env.STRIPE_SECRET_KEY?.trim() || ''
    if (!key) {
      reply(res, 503, { ok: false, error: 'not_configured' })
      return
    }
    let session = null
    try {
      const response = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { authorization: `Bearer ${key}` },
      })
      const data = await response.json().catch(() => null)
      if (response.ok && data && typeof data === 'object') session = data
    } catch (error) {
      console.error('[stripe] session lookup failed', error)
      reply(res, 502, { ok: false, error: 'stripe' })
      return
    }
    const memberId = String(session?.metadata?.memberId || session?.client_reference_id || '')
    const confirmKey = checkoutConfirmSecret(env) || key
    if (!verifyCheckoutConfirm(confirmKey, confirm, memberId)) {
      reply(res, 403, { ok: false, error: 'confirm' })
      return
    }
    if (!checkoutComplete(session)) {
      reply(res, 200, { ok: true, mailed: false })
      return
    }
    let result = null
    await store.update((db) => {
      result = applyStripeEvent(db, { type: 'checkout.session.completed', data: { object: session } })
      return db
    })
    if (!result?.handled) {
      reply(res, 200, { ok: true, mailed: false, reason: result?.reason || 'unmatched' })
      return
    }
    try {
      const mailed = await deliverContractMail(store, env, result, session)
      reply(res, 200, { ok: true, mailed: mailed.mail === 'sent' })
    } catch (error) {
      console.error('[stripe] contract mail failed', error)
      reply(res, 500, { ok: false, error: 'mail' })
    }
  }

  return async function handleStripe(req, res) {
    if (req.method !== 'POST') {
      reply(res, 405, { ok: false, error: 'method' })
      return
    }
    const raw = await readRaw(req)
    const signature = req.headers['stripe-signature']
    if (!signature) {
      await confirmSession(raw, res)
      return
    }
    const secret = env.STRIPE_WEBHOOK_SECRET?.trim() || ''
    if (!secret) {
      reply(res, 503, { ok: false, error: 'not_configured' })
      return
    }
    if (!verifyStripeSignature(raw, signature, secret)) {
      reply(res, 400, { ok: false, error: 'signature' })
      return
    }
    let event
    try {
      event = JSON.parse(raw)
    } catch {
      reply(res, 400, { ok: false, error: 'invalid' })
      return
    }
    if (!INVOICE_STATUS[event?.type] && !isCheckoutSessionEvent(event?.type)) {
      reply(res, 200, { ok: true, handled: false, reason: 'ignored' })
      return
    }
    let result = null
    await store.update((db) => {
      // async_payment_* carries the same Checkout Session object; reuse completed linking + fee logic.
      const normalized =
        event?.type === 'checkout.session.async_payment_succeeded' ||
        event?.type === 'checkout.session.async_payment_failed'
          ? { ...event, type: 'checkout.session.completed' }
          : event
      result = applyStripeEvent(db, normalized)
      return db
    })
    if (result && !result.handled && result.reason === 'unmatched') {
      console.warn('[stripe] no member for', event.type, event.data?.object?.id, event.data?.object?.customer_email)
    }
    if (
      (event?.type === 'checkout.session.completed' ||
        event?.type === 'checkout.session.async_payment_succeeded') &&
      checkoutComplete(event.data?.object)
    ) {
      try {
        result = await deliverContractMail(store, env, result, event.data.object)
      } catch (error) {
        console.error('[stripe] contract mail failed', error)
        reply(res, 500, { ok: false, error: 'mail' })
        return
      }
    }
    if (result?.status === 'failed') {
      try {
        result = await notifyPaymentFailed(result)
      } catch (error) {
        console.error('[stripe] fail mail hook', error)
      }
    }
    reply(res, 200, { ok: true, ...result })
  }
}
