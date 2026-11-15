import { createContactHandler } from '../server/contact.mjs'

const handle = createContactHandler({
  dataDir: '/tmp/konni-contacts',
  env: process.env,
})

export default async function handler(req, res) {
  try {
    await handle(req, res)
  } catch (error) {
    console.error('[kontakt]', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'upstream' }))
    }
  }
}
