import { timingSafeEqual } from 'node:crypto'
import { isValidEmail, normalizeEmail } from './membership.mjs'
import { makeInvitePayload, normalizePersonName, signInvite } from './invite.mjs'
import { sendMembershipEmails } from './membership-mail.mjs'

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function first50InviteSubject({ test = false } = {}) {
  const subject = 'Du gehörst zu den ersten 50 · KONNI MMA GYM'
  return test ? `Test: ${subject}` : subject
}

export function first50InviteHtml({ first, name, email, url }) {
  const who = escapeMail(first)
  const full = escapeMail(name)
  const mail = escapeMail(email)
  const href = escapeMail(url)
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;max-width:640px">
<p>Hi ${who},</p>
<p><strong>Du gehörst zu den ersten 50.</strong> Deshalb bekommst du den Preis, den wir dafür gemacht haben: <strong>89,99€ statt 99,99€</strong>, 24 Monate.</p>
<p>Wir freuen uns, wenn du von Anfang an dabei bist. Am 2. November geht die Tür auf. Über den Link schließt du den Vertrag ab. Name und E-Mail sind fest. Der Link gilt <strong>48 Stunden</strong> und nur für dich.</p>
<p>${full} · ${mail}</p>
<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Vertrag abschließen</a></p>
<p>Weiterleiten bringt den Sonderpreis niemandem sonst. Nach 48 Stunden ist der Link abgelaufen. Nutzt du die 48 Stunden nicht, geht dein Platz automatisch an die nächste Person.</p>
<p>Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Zahlung ist am 1. November 2026. Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung. SEPA-Lastschrift kommt später. Die Aufnahmegebühr von 0 € gilt nur bis zum 2. November 2026. Danach beträgt sie 49 €.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 8
const hits = new Map()

function secretsMatch(left, right) {
  const a = Buffer.from(String(left ?? ''))
  const b = Buffer.from(String(right ?? ''))
  if (a.length < 16 || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
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

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

async function readBody(req) {
  if (req.body != null && !Buffer.isBuffer(req.body)) {
    if (typeof req.body === 'object') return req.body
    if (typeof req.body === 'string') return req.body.trim() ? JSON.parse(req.body) : {}
  }
  return await new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 4096) {
        reject(new Error('too_large'))
        req.destroy()
      } else chunks.push(chunk)
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

export function createInviteMailHandler({ env }) {
  return async function handleInviteMail(req, res) {
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
      } catch {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }

      const secret = env.INVITE_SECRET
      const apiKey = env.BREVO_API_KEY?.trim()
      if (!secretsMatch(body.secret, secret) || !apiKey) {
        json(res, 403, { ok: false, error: 'invite' })
        return
      }

      if (body.copyRecord && typeof body.copyRecord === 'object') {
        const record = body.copyRecord
        const email = normalizeEmail(record.email)
        const name = normalizePersonName(`${record.firstName ?? ''} ${record.lastName ?? ''}`)
        if (!isValidEmail(email) || name.length < 3) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        await sendMembershipEmails(env, { ...record, email, firstName: record.firstName, lastName: record.lastName })
        json(res, 200, { ok: true, copied: email })
        return
      }

      const email = normalizeEmail(body.email)
      const name = normalizePersonName(body.name)
      const slot = Number(body.slot ?? 19)
      if (!isValidEmail(email) || name.length < 3 || !Number.isInteger(slot) || slot < 1 || slot > 50) {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }

      const site = String(env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
      const origin = site.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : site
      const token = signInvite(secret, makeInvitePayload({ email, name, slot }))
      const url = `${origin}/mitglied?invite=${encodeURIComponent(token)}`
      const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
      const first = name.split(' ')[0] || name
      const test = body.test === true

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'KONNI MMA GYM', email: sender },
          to: [{ email, name }],
          replyTo: { email: sender, name: 'KONNI MMA GYM' },
          subject: first50InviteSubject({ test }),
          htmlContent: first50InviteHtml({ first, name, email, url }),
        }),
      })
      const detail = await response.text()
      if (!response.ok) {
        console.error('[invite-mail]', response.status, detail.slice(0, 240))
        json(res, 502, { ok: false, error: 'upstream' })
        return
      }
      json(res, 200, { ok: true, email, slot })
    } catch (error) {
      console.error('[invite-mail]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
