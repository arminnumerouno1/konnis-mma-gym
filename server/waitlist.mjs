import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_BODY = 4096
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 8

/** @type {Map<string, number[]>} */
const hits = new Map()

/**
 * @param {string} raw
 */
export function normalizeEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * @param {string} email
 */
export function isValidEmail(email) {
  return email.length >= 6 && email.length <= 254 && EMAIL_RE.test(email)
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

/**
 * @param {string} ip
 */
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

/**
 * @param {import('node:http').IncomingMessage} req
 */
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

/**
 * @param {import('node:http').IncomingMessage} req
 */
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

/**
 * @param {string} file
 */
async function loadSignups(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.signups) ? parsed.signups : []
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * @param {string} file
 * @param {object[]} signups
 */
async function saveSignups(file, signups) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify({ signups }, null, 2)}\n`, 'utf8')
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ email: string, name: string, source: string }} signup
 */
async function pushBrevo(env, signup) {
  const apiKey = env.BREVO_API_KEY?.trim()
  const listId = Number(env.BREVO_LIST_ID)
  if (!apiKey || !Number.isFinite(listId) || listId <= 0) return 'skipped'

  const templateId = Number(env.BREVO_DOI_TEMPLATE_ID)
  const site = (env.VITE_SITE_URL ?? '').replace(/\/$/, '')
  const redirect = env.BREVO_DOI_REDIRECT_URL?.trim() || `${site || 'http://127.0.0.1:43177'}/?liste=bestaetigt`
  const attributes = { SOURCE: signup.source }
  if (signup.name) attributes.VORNAME = signup.name

  if (Number.isFinite(templateId) && templateId > 0) {
    const response = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        email: signup.email,
        includeListIds: [listId],
        templateId,
        redirectionUrl: redirect,
        attributes,
      }),
    })
    if (response.status === 201 || response.status === 204 || response.ok) return 'doi'
    const detail = await response.text()
    if (response.status === 400 && /already|duplicate/i.test(detail)) return 'listed'
    throw new Error(`brevo_doi_${response.status}:${detail.slice(0, 240)}`)
  }

  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      email: signup.email,
      listIds: [listId],
      updateEnabled: true,
      attributes,
    }),
  })
  if (response.status === 201 || response.status === 204 || response.ok) return 'listed'
  const detail = await response.text()
  if (response.status === 400 && /already|duplicate/i.test(detail)) return 'listed'
  throw new Error(`brevo_${response.status}:${detail.slice(0, 240)}`)
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {object} payload
 */
async function pushWebhook(env, payload) {
  const url = env.WAITLIST_WEBHOOK_URL?.trim()
  if (!url) return
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`webhook_${response.status}`)
  }
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

/**
 * @param {{ dataDir: string, env: Record<string, string | undefined> }} options
 */
export function createWaitlistHandler({ dataDir, env }) {
  const file = join(dataDir, 'waitlist.json')

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  return async function handleWaitlist(req, res) {
    try {
      await runWaitlist(req, res)
    } catch (error) {
      console.error('[waitlist]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function runWaitlist(req, res) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('allow', 'GET, POST, OPTIONS')
      res.end()
      return
    }

    if (req.method === 'GET') {
      const apiKey = env.BREVO_API_KEY?.trim()
      const listId = Number(env.BREVO_LIST_ID)
      const doi = Number(env.BREVO_DOI_TEMPLATE_ID)
      const mail =
        apiKey && Number.isFinite(listId) && listId > 0
          ? Number.isFinite(doi) && doi > 0
            ? 'brevo-doi'
            : 'brevo'
          : 'off'
      json(res, 200, { ok: true, mail })
      return
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }

    const ip = clientIp(req)
    if (rateLimited(ip)) {
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
      json(res, 200, { ok: true, confirmation: 'saved' })
      return
    }

    if (body.consent !== true) {
      json(res, 400, { ok: false, error: 'consent' })
      return
    }

    const email = normalizeEmail(body.email)
    const name = String(body.name ?? '')
      .trim()
      .slice(0, 80)
    if (!isValidEmail(email)) {
      json(res, 400, { ok: false, error: 'email' })
      return
    }

    const signup = {
      email,
      name,
      source: 'finale',
      createdAt: new Date().toISOString(),
    }

    const signups = await loadSignups(file)
    const existing = signups.some((entry) => entry.email === email)
    if (!existing) {
      signups.push(signup)
      try {
        await saveSignups(file, signups)
      } catch (error) {
        console.error('[waitlist] local save skipped', error)
      }
    }

    try {
      await pushWebhook(env, signup)
    } catch (error) {
      console.error('[waitlist] webhook failed', error)
      json(res, 502, { ok: false, error: 'upstream' })
      return
    }

    let confirmation = existing ? 'duplicate' : 'saved'
    try {
      const brevo = await pushBrevo(env, signup)
      if (brevo === 'doi') confirmation = 'email'
      else if (brevo === 'listed') confirmation = 'listed'
    } catch (error) {
      console.error('[waitlist] brevo failed', error)
      json(res, 502, { ok: false, error: 'upstream' })
      return
    }

    json(res, 200, { ok: true, confirmation })
  }
}
