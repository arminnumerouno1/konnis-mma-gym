import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_BODY = 8192
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 8

/** @type {Map<string, number[]>} */
const hits = new Map()

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

async function readBody(req) {
  if (req.body != null && !Buffer.isBuffer(req.body)) {
    if (typeof req.body === 'object') return req.body
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return {}
      return JSON.parse(req.body)
    }
  }
  return readJsonBody(req)
}

async function loadRows(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.requests) ? parsed.requests : []
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

async function saveRows(file, requests) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify({ requests }, null, 2)}\n`, 'utf8')
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export function createContactHandler({ dataDir, env }) {
  const file = join(dataDir, 'contacts.json')

  return async function handleContact(req, res) {
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.setHeader('allow', 'POST, OPTIONS')
        res.end()
        return
      }
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method' })
        return
      }
      if (rateLimited(clientIp(req))) {
        json(res, 429, { ok: false, error: 'rate' })
        return
      }

      let body
      try {
        body = await readBody(req)
      } catch (error) {
        json(res, error instanceof Error && error.message === 'too_large' ? 413 : 400, {
          ok: false,
          error: 'invalid',
        })
        return
      }

      if (typeof body.company === 'string' && body.company.trim()) {
        json(res, 200, { ok: true })
        return
      }

      const name = String(body.name ?? '').trim().slice(0, 80)
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase()
      const phone = String(body.phone ?? '').trim().slice(0, 40)
      const interest = String(body.interest ?? '').trim().slice(0, 40)
      const note = String(body.note ?? '').trim().slice(0, 500)
      if (name.length < 2 || !EMAIL_RE.test(email) || phone.length < 6) {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }

      const row = {
        type: 'trial',
        name,
        email,
        phone,
        interest,
        note,
        createdAt: new Date().toISOString(),
      }

      const rows = await loadRows(file)
      rows.push(row)
      try {
        await saveRows(file, rows)
      } catch (error) {
        console.error('[kontakt] save skipped', error)
      }

      const hook = env.CONTACT_WEBHOOK_URL?.trim() || env.WAITLIST_WEBHOOK_URL?.trim()
      if (hook) {
        const response = await fetch(hook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(row),
        })
        if (!response.ok) {
          json(res, 502, { ok: false, error: 'upstream' })
          return
        }
      }

      json(res, 200, { ok: true })
    } catch (error) {
      console.error('[kontakt]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
