import { timingSafeEqual } from 'node:crypto'
import { isValidEmail, normalizeEmail } from './membership.mjs'
import { opsMailAuthorized } from './ops-auth.mjs'

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function openingMailSubject({ test = false } = {}) {
  const subject = 'Wir sind offen · KONNI MMA GYM'
  return test ? `Test: ${subject}` : subject
}

export function openingMailHtml({ first = '' } = {}) {
  const who = escapeMail(String(first ?? '').trim() || 'du')
  const hi = who === 'du' ? 'Hi,' : `Hi ${who},`
  const logo = 'https://www.mma-in-leipzig.de/brand/konni-logo-mail.jpg'
  const join = 'https://www.mma-in-leipzig.de/mitglied'
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<div style="background:#111;color:#ece8e1;padding:28px 24px;text-align:center">
<img src="${logo}" alt="KONNI MMA GYM" width="164" height="178" style="display:block;margin:0 auto 16px;border:0;outline:none;text-decoration:none" />
<p style="margin:0;letter-spacing:.22em;font-size:12px;color:#c4121a">KONNI MMA GYM · LEIPZIG</p>
<p style="margin:10px 0 0;font-size:34px;line-height:0.95;font-weight:bold;letter-spacing:.02em">WIR SIND OFFEN.</p>
<p style="margin:8px 0 0;font-size:18px;color:#c9a227">Training läuft. Komm vorbei.</p>
</div>
<div style="padding:24px 4px 0">
<p>${hi}</p>
<p>kurze Klarstellung, falls bei dir noch eine ältere Mail liegt: <strong>Das KONNI MMA GYM ist geöffnet.</strong> Training läuft. Es gibt keine Warteliste mehr.</p>
<p>Du kannst online Mitglied werden und direkt trainieren. Wittenberger Straße 15, 04129 Leipzig.</p>
<p>Von MMA-Profi Konrad Dyrschka. Endlich ein Top MMA Gym in Leipzig.</p>
<p style="margin:28px 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#666">Die Tarife</p>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="padding:12px 0;border-bottom:1px solid #ddd"><strong>Slow Start Tarif</strong><br><span style="color:#666">12 Monate · 2 Kurse/Einheiten pro Woche</span></td>
<td style="padding:12px 0;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap"><strong>79,99€</strong><br><span style="color:#666">/ Monat</span></td>
</tr>
<tr>
<td style="padding:12px 0;border-bottom:1px solid #ddd"><strong>Standard</strong><br><span style="color:#666">24 Monate · alle Kurse nutzbar</span></td>
<td style="padding:12px 0;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap"><strong>99,99€</strong><br><span style="color:#666">/ Monat</span></td>
</tr>
<tr>
<td style="padding:12px 0;border-bottom:1px solid #ddd"><strong>Flex</strong><br><span style="color:#666">12 Monate · alle Kurse nutzbar</span></td>
<td style="padding:12px 0;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap"><strong>109,99€</strong><br><span style="color:#666">/ Monat</span></td>
</tr>
<tr>
<td style="padding:12px 0"><strong>Anmeldegebühr</strong><br><span style="color:#666">einmalig</span></td>
<td style="padding:12px 0;text-align:right"><strong>19,99€</strong></td>
</tr>
</table>
<p>First-50-Plätze laufen über persönlichen Link. Alle anderen melden sich unter <a href="${join}">mma-in-leipzig.de/mitglied</a> an.</p>
<p>Aktuelles und Kursplan auch auf Instagram: <a href="https://www.instagram.com/konnimmagym/" style="color:#c4121a;font-weight:bold">@konnimmagym</a>.</p>
<p style="margin:28px 0 0"><a href="${join}" style="display:inline-block;background:#c4121a;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Mitglied werden</a></p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>
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

function firstNameOf(name) {
  const parts = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  return parts[0] || ''
}

export function createOpeningMailHandler({ env }) {
  return async function handleOpeningMail(req, res) {
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

      const apiKey = env.BREVO_API_KEY?.trim()
      if (!opsMailAuthorized(body.secret, env) || !apiKey) {
        if (rateLimited(clientIp(req))) {
          json(res, 429, { ok: false, error: 'rate' })
          return
        }
        json(res, 403, { ok: false, error: 'invite' })
        return
      }

      const email = normalizeEmail(body.email)
      const name = String(body.name ?? '').replace(/\s+/g, ' ').trim()
      if (!isValidEmail(email)) {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }

      const test = body.test === true
      const first = firstNameOf(name) || firstNameOf(body.first)
      const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'KONNI MMA GYM', email: sender },
          to: [{ email, name: name || email }],
          replyTo: { email: sender, name: 'KONNI MMA GYM' },
          subject: openingMailSubject({ test }),
          htmlContent: openingMailHtml({ first }),
          tags: test ? ['opening-announce-test'] : ['opening-announce'],
        }),
      })
      const detail = await response.text()
      if (!response.ok) {
        console.error('[opening-mail]', response.status, detail.slice(0, 240))
        json(res, 502, { ok: false, error: 'upstream' })
        return
      }
      json(res, 200, { ok: true, email, test })
    } catch (error) {
      console.error('[opening-mail]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}

