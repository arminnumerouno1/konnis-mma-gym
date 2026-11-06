import { collectCheckinCodes, ensureCheckinCode, generateCheckinCode } from '../server/checkin-code.mjs'
import { createMemberStore } from '../server/member-store.mjs'
import { sendCheckinCodeEmail } from '../server/membership-mail.mjs'

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  if (req.body != null && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }
    const secret = process.env.CRON_SECRET?.trim() || ''
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    const header = String(req.headers['x-cron-secret'] || '').trim()
    if (!secret || (auth !== secret && header !== secret)) {
      json(res, 401, { ok: false, error: 'auth' })
      return
    }

    const body = await readBody(req)
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    if (!email || !email.includes('@')) {
      json(res, 400, { ok: false, error: 'email' })
      return
    }

    const store = createMemberStore({
      dataDir: '/tmp/konni-memberships',
      env: process.env,
    })
    const db = await store.load()
    let member = (db.members || []).find((row) => String(row.email || '').toLowerCase() === email)
    let record
    if (member) {
      if (!member.checkinCode) {
        member = ensureCheckinCode(member, collectCheckinCodes(db.members, []))
        await store.update((next) => {
          const index = next.members.findIndex((row) => row.id === member.id)
          if (index >= 0) next.members[index] = { ...member, updatedAt: new Date().toISOString() }
          return next
        })
      }
      record = member
    } else {
      record = {
        firstName: String(body.firstName || 'Armin').trim() || 'Armin',
        lastName: String(body.lastName || 'Scholtz').trim(),
        email,
        checkinCode: generateCheckinCode(),
      }
    }

    const mail = await sendCheckinCodeEmail(process.env, record)
    json(res, 200, {
      ok: true,
      mail,
      memberFound: Boolean(member),
      email: record.email,
      code: record.checkinCode,
    })
  } catch (error) {
    console.error('[checkin-code-mail]', error)
    if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
  }
}
