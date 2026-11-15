import { createMemberStore } from '../server/member-store.mjs'
import { createPhotoUploadHandler } from '../server/photo-upload.mjs'

const store = createMemberStore({ dataDir: '/tmp/konni-memberships', env: process.env })
const handle = createPhotoUploadHandler({ env: process.env, store })

export default async function handler(req, res) {
  try {
    await handle(req, res)
  } catch (error) {
    console.error('[portrait]', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(JSON.stringify({ ok: false, error: 'upstream' }))
    }
  }
}
