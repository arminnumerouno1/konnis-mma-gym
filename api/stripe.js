import { createStripeHandler } from '../server/stripe.mjs'

// Keep the raw body for Stripe HMAC verification (do not JSON-parse first).
export const config = {
  api: {
    bodyParser: false,
  },
}

const handle = createStripeHandler({
  dataDir: '/tmp/konni-memberships',
  env: process.env,
})

export default async function handler(req, res) {
  try {
    await handle(req, res)
  } catch (error) {
    console.error('[stripe]', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'upstream' }))
    }
  }
}
