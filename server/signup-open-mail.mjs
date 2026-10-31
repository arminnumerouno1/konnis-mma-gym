import { timingSafeEqual } from 'node:crypto'
import { mailProofMatches } from './mail-proof.mjs'
import { isValidEmail, normalizeEmail } from './membership.mjs'

/** Nur diese Adresse darf die Testmail bekommen. */
export const SIGNUP_OPEN_TEST_TO = 'armin.scholtz@gmail.com'
export const SIGNUP_OPEN_CONFIRM = 'an-alle-ausser-first-50'
const PREREG_BLOB = 'konni/voranmeldungen.json'
const SENT_BLOB = 'konni/signup-open-sent.json'

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
<p>Slow Start, Standard oder Flex. Slow Start Tarif: 2 Kurse/Einheiten pro Woche. Standard und Flex: alle Kurse nutzbar.</p>
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
<td style="padding:12px 0"><strong>Anmeldegebühr</strong><br><span style="color:#666">0€ nur bis 2. November, danach 49€</span></td>
<td style="padding:12px 0;text-align:right"><strong>0€</strong></td>
</tr>
</table>
<p>Das Studio eröffnet am 2. November 2026. Vorher gibt es kein Training. Der Beitrag ist jeweils zum 1. des Monats fällig. Die erste Zahlung ist am 1. November 2026. Vorher geht nichts vom Konto.</p>
<p>Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung. SEPA-Lastschrift kommt später.</p>
<p style="margin:28px 0 0"><a href="${join}" style="display:inline-block;background:#c4121a;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Mitglied werden</a></p>
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
const BATCH_MAX = 20

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function blobToken(env) {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() || ''
  if (!token) {
    const error = new Error('no-blob')
    error.code = 'no-blob'
    throw error
  }
  return token
}

export async function readSignupOpenEntries(env) {
  const token = await blobToken(env)
  const { get } = await import('@vercel/blob')
  const res = await get(PREREG_BLOB, { access: 'private', token, useCache: false })
  if (!res || res.statusCode !== 200 || !res.stream) {
    const error = new Error('no-list')
    error.code = 'no-list'
    throw error
  }
  const data = JSON.parse(await new Response(res.stream).text())
  const entries = Array.isArray(data?.entries) ? data.entries : []
  if (!entries.length) {
    const error = new Error('empty-list')
    error.code = 'empty-list'
    throw error
  }
  return entries
}

export async function readSignupOpenSent(env) {
  const token = await blobToken(env)
  const { get } = await import('@vercel/blob')
  const res = await get(SENT_BLOB, { access: 'private', token, useCache: false })
  if (!res || res.statusCode !== 200 || !res.stream) return []
  const data = JSON.parse(await new Response(res.stream).text())
  return Array.isArray(data.emails) ? data.emails : []
}

export async function writeSignupOpenSent(env, emails) {
  const token = await blobToken(env)
  const { put } = await import('@vercel/blob')
  await put(SENT_BLOB, JSON.stringify({ emails, at: new Date().toISOString() }), {
    access: 'private',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

function brevoPayload({ sender, person, test }) {
  return {
    sender: { name: 'KONNI MMA GYM', email: sender },
    to: [{ email: person.email, name: person.name || person.email }],
    replyTo: { email: sender, name: 'KONNI MMA GYM' },
    subject: signupOpenMailSubject({ test }),
    htmlContent: signupOpenMailHtml({ first: person.first }),
    tags: [test ? 'signup-open-test' : 'signup-open'],
  }
}

async function deliverOne({ fetchImpl, apiKey, sender, person, test }) {
  const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(brevoPayload({ sender, person, test })),
  })
  const detail = await response.text()
  if (!response.ok) {
    const error = new Error(`brevo_${response.status}`)
    error.detail = detail.slice(0, 180)
    throw error
  }
}

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

export function createSignupOpenMailHandler({
  env,
  fetchImpl = fetch,
  loadEntries = () => readSignupOpenEntries(env),
  loadSent = () => readSignupOpenSent(env),
  saveSent = (emails) => writeSignupOpenSent(env, emails),
}) {
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

      const apiKey = env.BREVO_API_KEY?.trim()
      if (!mailProofMatches(body.proof, env) || !apiKey) {
        if (rateLimited(clientIp(req))) {
          json(res, 429, { ok: false, error: 'rate' })
          return
        }
        json(res, 403, { ok: false, error: 'proof' })
        return
      }

      const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'

      if (body.count === true) {
        const entries = await loadEntries()
        const people = signupOpenRecipients(entries)
        const sent = new Set((await loadSent()).map((item) => normalizeEmail(item)))
        const pending = people.filter((person) => !sent.has(person.email))
        json(res, 200, { ok: true, outside: people.length, pending: pending.length, already: people.length - pending.length })
        return
      }

      if (body.all === true) {
        if (body.confirm !== SIGNUP_OPEN_CONFIRM || body.test === true) {
          json(res, 403, { ok: false, error: 'confirm' })
          return
        }
        const entries = await loadEntries()
        const people = signupOpenRecipients(entries)
        if (!people.length) {
          json(res, 409, { ok: false, error: 'empty-list' })
          return
        }
        const sent = new Set((await loadSent()).map((item) => normalizeEmail(item)))
        const pending = people.filter((person) => !sent.has(person.email))
        const limit = Math.min(BATCH_MAX, Math.max(1, Number(body.limit) || 12))
        let sentNow = 0
        let failed = 0
        for (const person of pending.slice(0, limit)) {
          try {
            await deliverOne({ fetchImpl, apiKey, sender, person, test: false })
          } catch (error) {
            failed += 1
            console.error('[signup-open-mail]', String(error?.detail || error?.message || error).slice(0, 180))
            break
          }
          sent.add(person.email)
          let stored = false
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              await saveSent([...sent])
              stored = true
              break
            } catch {
              await sleep(200)
            }
          }
          if (!stored) {
            failed += 1
            break
          }
          sentNow += 1
          await sleep(250)
        }
        const remaining = pending.length - sentNow
        json(res, failed ? 502 : 200, {
          ok: failed === 0,
          sent: sentNow,
          failed,
          remaining,
          outside: people.length,
        })
        return
      }

      if (body.test !== true) {
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
      try {
        await deliverOne({
          fetchImpl,
          apiKey,
          sender,
          person: { email, name: name || email, first },
          test: true,
        })
      } catch (error) {
        console.error('[signup-open-mail]', String(error?.detail || error?.message || error).slice(0, 180))
        json(res, 502, { ok: false, error: 'upstream' })
        return
      }
      json(res, 200, { ok: true, email, test: true })
    } catch (error) {
      console.error('[signup-open-mail]', error)
      const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
      if (!res.headersSent && (code === 'no-list' || code === 'empty-list' || code === 'no-blob')) {
        json(res, 409, { ok: false, error: code })
        return
      }
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
