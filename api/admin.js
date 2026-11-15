import { createAdminHandler } from '../server/admin.mjs'

const handle = createAdminHandler({
  dataDir: '/tmp/konni-memberships',
  env: process.env,
})

export default async function handler(req, res) {
  try {
    await handle(req, res)
  } catch (error) {
    console.error('[admin]', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(JSON.stringify({ ok: false, error: 'upstream' }))
    }
  }
}
