import { createMemberStore } from '../server/member-store.mjs'
import { cronAuthorized } from '../server/dues-cron.mjs'
import { membersMissingPortrait, sendPhotoRequestEmail } from '../server/photo-upload.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
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

  if (!process.env.BREVO_API_KEY?.trim()) {
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'mail_off' }))
    return
  }

  const store = createMemberStore({ dataDir: process.env.MEMBER_DATA_DIR || '/tmp/konni-data', env: process.env })
  const people = membersMissingPortrait((await store.load()).members ?? [])
  if (!people.length) {
    res.statusCode = 409
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'no_recipients' }))
    return
  }

  let sent = 0
  let failed = 0
  const errors = []
  const at = new Date().toISOString()
  for (const person of people) {
    const mailed = await sendPhotoRequestEmail(process.env, person)
    if (!mailed?.ok) {
      failed += 1
      errors.push({ email: person.email, error: mailed?.error || 'mail' })
      console.error('[photo-request]', person.email, mailed?.error || 'mail')
      continue
    }
    sent += 1
    await store.update((fresh) => {
      const index = fresh.members.findIndex((row) => row.id === person.id)
      if (index < 0) return fresh
      fresh.members[index] = {
        ...fresh.members[index],
        photoRequestedAt: at,
        updatedAt: at,
      }
      return fresh
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  res.statusCode = failed && !sent ? 502 : 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(
    JSON.stringify({
      ok: failed === 0,
      sent,
      failed,
      total: people.length,
      errors: errors.slice(0, 10),
    }),
  )
}
