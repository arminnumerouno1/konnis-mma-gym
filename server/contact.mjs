import {
  addTrial,
  createTrialStore,
  readTrialRequest,
  sendTrialGymMail,
} from './trial.mjs'

const MAX_BODY = 8192
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 8

/** Muss mit src/brand/plans.ts TRIAL_OPEN zusammenpassen, außer TRIAL_OPEN=true/false in der Umgebung. */
export const TRIAL_OPEN = true

export function isTrialOpen(env = {}) {
  const raw = String(env.TRIAL_OPEN ?? '').trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return TRIAL_OPEN
}

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

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export function createContactHandler({ dataDir, env }) {
  const trials = createTrialStore({ dataDir, env })

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
      if (!isTrialOpen(env)) {
        json(res, 403, { ok: false, error: 'closed' })
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

      const parsed = readTrialRequest(body)
      if (!parsed.ok) {
        json(res, 400, { ok: false, error: parsed.error })
        return
      }

      const { entry } = await addTrial(trials, parsed.entry)

      const hook = env.CONTACT_WEBHOOK_URL?.trim() || env.WAITLIST_WEBHOOK_URL?.trim()
      if (hook) {
        const response = await fetch(hook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'trial', ...entry }),
        })
        if (!response.ok) {
          json(res, 502, { ok: false, error: 'upstream' })
          return
        }
      }

      try {
        await sendTrialGymMail(env, entry)
      } catch (error) {
        console.error('[kontakt] trial mail failed', error)
      }

      json(res, 200, { ok: true })
    } catch (error) {
      console.error('[kontakt]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
