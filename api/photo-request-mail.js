import { cronAuthorized, cronRateLimited } from '../server/dues-cron.mjs'
import { createMemberStore } from '../server/member-store.mjs'
import {
  membersMissingPortrait,
  needsPortrait,
  PHOTO_REQUEST_CONFIRM,
  sendPhotoRequestEmail,
} from '../server/photo-upload.mjs'

export const config = {
  maxDuration: 60,
}

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

async function sendOne(store, member) {
  const mailed = await sendPhotoRequestEmail(process.env, member)
  if (!mailed?.ok) return { ok: false, error: mailed?.error || 'mail' }
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
  return { ok: true }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }
    if (!cronAuthorized(req, process.env)) {
      json(res, 401, { ok: false, error: 'auth' })
      return
    }
    if (cronRateLimited(req)) {
      json(res, 429, { ok: false, error: 'rate' })
      return
    }

    const body = await readBody(req)
    const store = createMemberStore({
      dataDir: '/tmp/konni-memberships',
      env: process.env,
    })

    if (body.bulk === true) {
      if (String(body.confirm ?? '').trim() !== PHOTO_REQUEST_CONFIRM) {
        json(res, 403, { ok: false, error: 'confirm' })
        return
      }
      if (!process.env.BREVO_API_KEY?.trim()) {
        json(res, 503, { ok: false, error: 'mail_off' })
        return
      }
      const people = membersMissingPortrait((await store.load()).members ?? [])
      if (!people.length) {
        json(res, 409, { ok: false, error: 'no_recipients' })
        return
      }
      let sent = 0
      let failed = 0
      const errors = []
      for (const person of people) {
        const result = await sendOne(store, person)
        if (!result.ok) {
          failed += 1
          errors.push({ email: person.email, error: result.error })
          console.error('[photo-request-bulk]', person.email, result.error)
        } else {
          sent += 1
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      json(res, failed && !sent ? 502 : 200, {
        ok: failed === 0,
        sent,
        failed,
        total: people.length,
        errors: errors.slice(0, 20),
      })
      return
    }

    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const nameWanted = normalizeName(body.name || '')
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

    const result = await sendOne(store, member)
    if (!result.ok) {
      json(res, result.error === 'mail_off' ? 503 : 502, { ok: false, error: result.error })
      return
    }
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
