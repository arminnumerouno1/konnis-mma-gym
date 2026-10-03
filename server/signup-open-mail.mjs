import { timingSafeEqual } from 'node:crypto'
import { isValidEmail, normalizeEmail } from './membership.mjs'

/** Nur diese Adresse darf die Testmail bekommen, bis der Versand freigegeben ist. */
export const SIGNUP_OPEN_TEST_TO = 'armin.scholtz@gmail.com'

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function firstNameOf(name) {
  const parts = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  return parts[0] || ''
}

export function signupOpenMailSubject({ test = false } = {}) {
  const subject = 'Jetzt kannst du Mitglied werden · KONNI MMA GYM'
  return test ? `Test: ${subject}` : subject
}

export function signupOpenMailHtml({ first = '' } = {}) {
  const who = escapeMail(String(first ?? '').trim() || 'du')
  const hi = who === 'du' ? 'Hi,' : `Hi ${who},`
  const logo = 'https://www.mma-in-leipzig.de/brand/konni-logo-mail.jpg'
  const join = 'https://www.mma-in-leipzig.de/mitglied'
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<div style="background:#111;color:#ece8e1;padding:28px 24px;text-align:center">
<img src="${logo}" alt="KONNI MMA GYM" width="164" height="178" style="display:block;margin:0 auto 16px;border:0;outline:none;text-decoration:none" />
<p style="margin:0;letter-spacing:.22em;font-size:12px;color:#c4121a">KONNI MMA GYM · LEIPZIG</p>
<p style="margin:10px 0 0;font-size:34px;line-height:0.95;font-weight:bold;letter-spacing:.02em">JETZT MITGLIED WERDEN.</p>
<p style="margin:8px 0 0;font-size:18px;color:#c9a227">Die Anmeldung ist offen.</p>
</div>
<div style="padding:24px 4px 0">
<p>${hi}</p>
<p>du hast dich vorangemeldet. Danke dafür. <strong>Du kannst jetzt online Mitglied werden.</strong></p>
<p>Standard oder Flex. Alle Kurse sind nutzbar.</p>
<p style="margin:28px 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#666">Die Tarife</p>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="padding:12px 0;border-bottom:1px solid #ddd"><strong>Standard</strong><br><span style="color:#666">24 Monate · alle Kurse nutzbar</span></td>
<td style="padding:12px 0;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap"><strong>99,99€</strong><br><span style="color:#666">/ Monat</span></td>
</tr>
<tr>
<td style="padding:12px 0;border-bottom:1px solid #ddd"><strong>Flex</strong><br><span style="color:#666">12 Monate · alle Kurse nutzbar</span></td>
<td style="padding:12px 0;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap"><strong>109,99€</strong><br><span style="color:#666">/ Monat</span></td>
</tr>
<tr>
<td style="padding:12px 0"><strong>Anmeldegebühr</strong><br><span style="color:#666">0€ nur bis 2. November, danach 49€</span></td>
<td style="padding:12px 0;text-align:right"><strong>0€</strong></td>
</tr>
</table>
<p>Training gibt es erst ab dem 2. November. Vorher nicht. Der Beitrag ist jeweils zum 1. des Monats fällig. Die erste Zahlung ist am 1. November 2026. Vorher geht nichts vom Konto.</p>
<p>Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung. SEPA-Lastschrift kommt später.</p>
<p style="margin:28px 0 0"><a href="${join}" style="display:inline-block;background:#c4121a;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Mitglied werden</a></p>
<p>Bist du schon Mitglied, brauchst du nichts weiter zu tun.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>
</div>`
}

export function signupOpenRecipients(entries) {
  const blocked = new Set()
  for (const row of entries ?? []) {
    if (row?.first50 !== true) continue
    for (const raw of [row.email, ...(row.extraEmails ?? [])]) {
      const email = normalizeEmail(raw)
      if (isValidEmail(email)) blocked.add(email)
    }
  }
  const seen = new Set()
  const people = []
  for (const row of entries ?? []) {
    if (row?.first50 === true) continue
    const name = String(row?.name ?? '').replace(/\s+/g, ' ').trim()
    const emails = [row?.email, ...(row?.extraEmails ?? [])]
      .map((raw) => normalizeEmail(raw))
      .filter((email) => isValidEmail(email))
    if (emails.some((email) => blocked.has(email))) {
      for (const email of emails) blocked.add(email)
      continue
    }
    for (const email of emails) {
      if (seen.has(email)) continue
      seen.add(email)
      people.push({ email, name, first: firstNameOf(name) })
    }
  }
  return people
}

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 4
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

export function createSignupOpenMailHandler({ env, fetchImpl = fetch }) {
  return async function handleSignupOpenMail(req, res) {
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

      let body
      try {
        body = await readBody(req)
      } catch {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }

      const proof = env.SIGNUP_MAIL_PROOF?.trim()
      const apiKey = env.BREVO_API_KEY?.trim()
      if (!secretsMatch(body.proof, proof) || !apiKey) {
        if (rateLimited(clientIp(req))) {
          json(res, 429, { ok: false, error: 'rate' })
          return
        }
        json(res, 403, { ok: false, error: 'proof' })
        return
      }

      if (body.test !== true || body.all === true) {
        json(res, 403, { ok: false, error: 'test-only' })
        return
      }

      const email = normalizeEmail(body.email)
      const name = String(body.name ?? '').replace(/\s+/g, ' ').trim()
      if (email !== SIGNUP_OPEN_TEST_TO || !isValidEmail(email)) {
        json(res, 403, { ok: false, error: 'test-only' })
        return
      }

      const first = firstNameOf(name) || firstNameOf(body.first)
      const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
      const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'KONNI MMA GYM', email: sender },
          to: [{ email, name: name || email }],
          replyTo: { email: sender, name: 'KONNI MMA GYM' },
          subject: signupOpenMailSubject({ test: true }),
          htmlContent: signupOpenMailHtml({ first }),
          tags: ['signup-open-test'],
        }),
      })
      const detail = await response.text()
      if (!response.ok) {
        console.error('[signup-open-mail]', response.status, detail.slice(0, 180))
        json(res, 502, { ok: false, error: 'upstream' })
        return
      }
      json(res, 200, { ok: true, email, test: true })
    } catch (error) {
      console.error('[signup-open-mail]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
