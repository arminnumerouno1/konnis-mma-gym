import { createMemberStore } from '../server/member-store.mjs'
import { needsPortrait, sendPhotoRequestEmail } from '../server/photo-upload.mjs'

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

function normalizeName(value) {
  return String(value || '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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
    const nameWanted = normalizeName(body.name || '')

    const store = createMemberStore({
      dataDir: '/tmp/konni-memberships',
      env: process.env,
    })
    const db = await store.load()
    let member = null
    if (email) {
      member = (db.members || []).find((row) => String(row.email || '').toLowerCase() === email) || null
    }
    if (!member && nameWanted) {
      const hits = (db.members || []).filter((row) => {
        const full = normalizeName(`${row.firstName || ''} ${row.lastName || ''}`)
        return full === nameWanted || full.includes(nameWanted) || nameWanted.includes(full)
      })
      if (hits.length === 1) member = hits[0]
      else if (hits.length > 1) {
        json(res, 409, {
          ok: false,
          error: 'ambiguous',
          matches: hits.map((row) => ({
            id: row.id,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
          })),
        })
        return
      }
    }
    if (!member) {
      json(res, 404, { ok: false, error: 'missing' })
      return
    }
    if (!needsPortrait(member)) {
      json(res, 409, { ok: false, error: member.photoData ? 'has_photo' : 'closed' })
      return
    }

    const mailed = await sendPhotoRequestEmail(process.env, member)
    if (!mailed?.ok) {
      json(res, mailed?.error === 'mail_off' ? 503 : 502, { ok: false, error: mailed?.error || 'mail' })
      return
    }

    const at = new Date().toISOString()
    await store.update((fresh) => {
      const index = fresh.members.findIndex((row) => row.id === member.id)
      if (index < 0) return fresh
      fresh.members[index] = {
        ...fresh.members[index],
        photoRequestedAt: at,
        updatedAt: at,
      }
      return fresh
    })

    json(res, 200, {
      ok: true,
      email: member.email,
      name: `${member.firstName} ${member.lastName}`.trim(),
      id: member.id,
    })
  } catch (error) {
    console.error('[photo-request-mail]', error)
    if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
  }
}
