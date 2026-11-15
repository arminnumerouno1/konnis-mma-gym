import {
  addTrial,
  createTrialStore,
  readTrialRequest,
  sendTrialGuardianConsentEmail,
  sendTrialGymMail,
} from './trial.mjs'
import { clientIp, createKeyedRateLimiter, publicFormTrap } from './public-form-guard.mjs'

const MAX_BODY = 8192
const rateLimitedIp = createKeyedRateLimiter({ windowMs: 10 * 60 * 1000, max: 8 })
const rateLimitedEmail = createKeyedRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 })

/** Muss mit src/brand/plans.ts TRIAL_OPEN zusammenpassen, außer TRIAL_OPEN=true/false in der Umgebung. */
export const TRIAL_OPEN = true

export function isTrialOpen(env = {}) {
  const raw = String(env.TRIAL_OPEN ?? '').trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return TRIAL_OPEN
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
      if (rateLimitedIp(clientIp(req))) {
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

      const trap = publicFormTrap(body, { minMs: 2500 })
      if (trap) {
        json(res, 200, { ok: true })
        return
      }

      const parsed = readTrialRequest(body)
      if (!parsed.ok) {
        json(res, 400, { ok: false, error: parsed.error })
        return
      }
      if (rateLimitedEmail(String(parsed.entry.email || '').toLowerCase())) {
        json(res, 429, { ok: false, error: 'rate' })
        return
      }

      const added = await addTrial(trials, parsed.entry)
      if (!added.ok) {
        json(res, 409, { ok: false, error: added.error || 'duplicate' })
        return
      }
      const entry = added.entry

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

      if (entry.minor) {
        try {
          const mailed = await sendTrialGuardianConsentEmail(env, entry)
          if (mailed !== 'skipped') {
            await trials.update((db) => {
              const index = db.entries.findIndex((row) => row.id === entry.id)
              if (index < 0) return db
              db.entries[index] = {
                ...db.entries[index],
                guardianConsentMailAt: new Date().toISOString(),
              }
              return db
            })
          }
        } catch (error) {
          console.error('[kontakt] trial guardian consent mail failed', error)
        }
      }

      json(res, 200, { ok: true, minor: Boolean(entry.minor) })
    } catch (error) {
      console.error('[kontakt]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
