import { createMemberStore } from '../server/member-store.mjs'
import { cronAuthorized } from '../server/dues-cron.mjs'
import { createPaymentRetryUrl, siteOrigin } from '../server/stripe-checkout.mjs'
import { sendCardUpdateEmail } from '../server/membership-mail.mjs'

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'method' }))
    return
  }
  if (!cronAuthorized(req, process.env)) {
    res.statusCode = 401
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'auth' }))
    return
  }

  const body = await readJson(req)
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) {
    res.statusCode = 400
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'email' }))
    return
  }

  const store = createMemberStore({ dataDir: process.env.MEMBER_DATA_DIR || '/tmp/konni-data', env: process.env })
  const db = await store.load()
  const members = (db.members || []).filter((row) => {
    if (row.status === 'cancelled' || row.status === 'withdrawn' || row.status === 'expired') return false
    return String(row.email || '').trim().toLowerCase() === email
  })
  if (members.length === 0) {
    res.statusCode = 404
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'missing' }))
    return
  }
  if (members.length > 1) {
    res.statusCode = 409
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'duplicate' }))
    return
  }

  const member = members[0]
  if (member.payMethod === 'transfer' || member.plan === 'daypass') {
    res.statusCode = 400
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'pay' }))
    return
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim() || ''
  if (!secret) {
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'stripe_off' }))
    return
  }

  // Keep subscriptionId in sync so admin/tools see the live Stripe sub.
  if (member.stripe?.customerId && !member.stripe?.subscriptionId) {
    try {
      const list = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${member.stripe.customerId}&status=all&limit=5`,
        { headers: { authorization: `Bearer ${secret}` } },
      )
      const data = await list.json()
      const active = (data.data || []).find((s) => s.status === 'active' || s.status === 'past_due' || s.status === 'trialing')
      if (active?.id) {
        await store.update((fresh) => {
          const index = fresh.members.findIndex((row) => row.id === member.id)
          if (index < 0) return fresh
          fresh.members[index] = {
            ...fresh.members[index],
            stripe: { ...(fresh.members[index].stripe ?? {}), subscriptionId: active.id },
            updatedAt: new Date().toISOString(),
          }
          return fresh
        })
        member.stripe = { ...(member.stripe ?? {}), subscriptionId: active.id }
      }
    } catch {
      // non-fatal
    }
  }

  const origin = siteOrigin(req, process.env)
  const retry = await createPaymentRetryUrl({ secret, member, origin })
  if (!retry.ok || !retry.url) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'stripe_fail', detail: retry.detail || retry.error }))
    return
  }

  let mailed
  try {
    mailed = await sendCardUpdateEmail(process.env, member, retry.url)
  } catch (error) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'mail', detail: String(error.message || error) }))
    return
  }
  if (!mailed || mailed === 'skipped') {
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'mail_off' }))
    return
  }

  const at = new Date().toISOString()
  await store.update((fresh) => {
    const index = fresh.members.findIndex((row) => row.id === member.id)
    if (index < 0) return fresh
    fresh.members[index] = { ...fresh.members[index], payLinkAt: at, updatedAt: at }
    return fresh
  })

  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(
    JSON.stringify({
      ok: true,
      mailed,
      kind: retry.kind,
      email: member.email,
      name: `${member.firstName} ${member.lastName}`,
    }),
  )
}
