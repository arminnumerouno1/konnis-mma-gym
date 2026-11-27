import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createMemberStore } from './member-store.mjs'
import { cancelInfo } from './member-model.mjs'
import { clientIp, createKeyedRateLimiter, publicFormTrap } from './public-form-guard.mjs'

const MAX_BODY = 8192
const FILE_NAME = 'cancellations.json'
const rateLimitedIp = createKeyedRateLimiter({ windowMs: 10 * 60 * 1000, max: 6 })
const rateLimitedEmail = createKeyedRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 })

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

function clean(value, max = 200) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const KIND_LABEL = {
  ordentlich: 'Ordentliche Kündigung',
  ausserordentlich: 'Außerordentliche Kündigung',
  widerruf: 'Widerruf (14 Tage)',
  umzug: 'Kündigung wegen Umzug (> 50 km)',
}

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function parseCancelRequest(body) {
  const firstName = clean(body.firstName, 80)
  const lastName = clean(body.lastName, 80)
  const email = clean(body.email, 160).toLowerCase()
  const phone = clean(body.phone, 40)
  const memberId = clean(body.memberId, 40)
  const kind = clean(body.kind, 40)
  const note = clean(body.note, 2000)
  const confirm = body.confirm === true || body.confirm === 'true' || body.confirm === '1'

  if (!firstName || !lastName) return { ok: false, error: 'name' }
  if (!email.includes('@') || email.length < 5) return { ok: false, error: 'email' }
  if (!KIND_LABEL[kind]) return { ok: false, error: 'kind' }
  if (!confirm) return { ok: false, error: 'confirm' }

  return {
    ok: true,
    entry: {
      firstName,
      lastName,
      email,
      phone,
      memberId: memberId || null,
      kind,
      kindLabel: KIND_LABEL[kind],
      note: note || null,
      confirm: true,
    },
  }
}

async function loadCancellations(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.entries)) return parsed
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { version: 1, entries: [] }
    }
    throw error
  }
  return { version: 1, entries: [] }
}

async function saveCancellations(file, store) {
  await mkdir(join(file, '..'), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, JSON.stringify(store, null, 2), 'utf8')
  await rename(tmp, file)
}

function senderOf(env) {
  return env.BREVO_SENDER?.trim() || env.MAIL_FROM?.trim() || 'info@mma-in-leipzig.de'
}

async function sendSmtp(env, { to, name, subject, html, cc = [] }) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return 'skipped'
  const sender = senderOf(env)
  const payload = {
    sender: { name: 'KONNI MMA GYM', email: sender },
    to: [{ email: to, name: name || to }],
    replyTo: { email: sender, name: 'KONNI MMA GYM' },
    subject,
    htmlContent: html,
  }
  if (cc.length) {
    payload.cc = cc
      .filter((row) => row?.email && row.email !== to)
      .map((row) => ({ email: row.email, name: row.name || row.email }))
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const detail = await response.text()
  if (!response.ok) throw new Error(`brevo_mail_${response.status}:${detail.slice(0, 240)}`)
  return 'sent'
}

function consumerConfirmHtml(row) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${escapeMail(row.firstName)},</p>
<p>wir bestätigen den Eingang deiner Erklärung vom ${escapeMail(row.receivedAtDe)}.</p>
<p><strong>Art:</strong> ${escapeMail(row.kindLabel)}<br>
<strong>Referenz:</strong> ${escapeMail(row.id)}<br>
<strong>Mitglied:</strong> ${escapeMail(row.firstName)} ${escapeMail(row.lastName)}<br>
<strong>E-Mail:</strong> ${escapeMail(row.email)}
${row.matchedMemberId ? `<br><strong>Vertrags-ID:</strong> ${escapeMail(row.matchedMemberId)}` : ''}
${row.suggestedEnd ? `<br><strong>Voraussichtliches Vertragsende (Berechnung):</strong> ${escapeMail(row.suggestedEnd)}` : ''}
</p>
${row.note ? `<p><strong>Deine Nachricht:</strong><br>${escapeMail(row.note)}</p>` : ''}
<p>Wir prüfen die Erklärung und setzen sie um. Bei Rückfragen antworte einfach auf diese Mail.</p>
<p>KONNI MMA GYM GbR<br>Wittenberger Straße 15, Aufgang B · 04129 Leipzig<br>info@mma-in-leipzig.de</p>
</div>`
}

function gymNotifyHtml(row) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p><strong>Online-Kündigung / Widerruf eingegangen</strong></p>
<p>Referenz: ${escapeMail(row.id)}<br>
Zeit: ${escapeMail(row.receivedAt)}<br>
Art: ${escapeMail(row.kindLabel)}<br>
Name: ${escapeMail(row.firstName)} ${escapeMail(row.lastName)}<br>
E-Mail: ${escapeMail(row.email)}<br>
Telefon: ${escapeMail(row.phone || '—')}<br>
Angegebene Vertrags-ID: ${escapeMail(row.memberId || '—')}<br>
Match: ${escapeMail(row.matchedMemberId || 'kein automatischer Treffer')}<br>
Vorschlag Ende: ${escapeMail(row.suggestedEnd || '—')}</p>
${row.note ? `<p>Nachricht:<br>${escapeMail(row.note)}</p>` : ''}
<p>Bitte in der Verwaltung prüfen und Status setzen.</p>
</div>`
}

export function createCancelHandler({ dataDir, env }) {
  const store = createMemberStore({ dataDir, env })
  const file = join(dataDir, FILE_NAME)

  return async function handleCancel(req, res) {
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
        json(res, 200, { ok: true, id: 'ok' })
        return
      }

      const parsed = parseCancelRequest(body)
      if (!parsed.ok) {
        json(res, 400, { ok: false, error: parsed.error })
        return
      }
      if (rateLimitedEmail(parsed.entry.email)) {
        json(res, 429, { ok: false, error: 'rate' })
        return
      }

      const today = berlinToday()
      const receivedAt = new Date().toISOString()
      const id = `K-${Date.now().toString(36).toUpperCase()}`
      let matchedMemberId = null
      let suggestedEnd = null

      try {
        const db = await store.load()
        const email = parsed.entry.email
        const full = `${parsed.entry.firstName} ${parsed.entry.lastName}`.toLowerCase()
        const lastName = parsed.entry.lastName.toLowerCase()
        const hit =
          db.members.find((row) => {
            if (!parsed.entry.memberId || row.id !== parsed.entry.memberId) return false
            // memberId alone is not enough — require matching email (IDOR harden).
            return String(row.email || '').toLowerCase() === email
          }) ||
          db.members.find((row) => {
            if (String(row.email || '').toLowerCase() !== email) return false
            if (['cancelled', 'withdrawn', 'expired'].includes(row.status)) return false
            const name = `${row.firstName || ''} ${row.lastName || ''}`.trim().toLowerCase()
            const rowLast = String(row.lastName || '')
              .trim()
              .toLowerCase()
            return !name || name === full || (rowLast && rowLast === lastName)
          })

        if (hit) {
          matchedMemberId = hit.id
          if (parsed.entry.kind === 'widerruf') {
            suggestedEnd = today
          } else {
            const info = cancelInfo({ ...hit, status: hit.status === 'received' ? 'active' : hit.status }, today)
            suggestedEnd = info.nextEnd || today
          }
          await store.update((next) => {
            const index = next.members.findIndex((row) => row.id === hit.id)
            if (index < 0) return next
            next.members[index] = {
              ...next.members[index],
              onlineCancelAt: receivedAt,
              onlineCancelId: id,
              onlineCancelKind: parsed.entry.kind,
              onlineCancelNote: parsed.entry.note,
              onlineCancelSuggestedEnd: suggestedEnd,
            }
            return next
          })
        }
      } catch (error) {
        console.error('[kuendigen] member match failed', error)
      }

      const row = {
        id,
        ...parsed.entry,
        matchedMemberId,
        suggestedEnd,
        receivedAt,
        receivedAtDe: new Date(receivedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
        ip: clientIp(req),
      }

      const bag = await loadCancellations(file)
      bag.entries.unshift(row)
      bag.entries = bag.entries.slice(0, 2000)
      await saveCancellations(file, bag)

      const gymTo = env.GYM_NOTIFY_EMAIL?.trim() || env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
      try {
        await sendSmtp(env, {
          to: row.email,
          name: `${row.firstName} ${row.lastName}`,
          subject: `Eingangsbestätigung: ${row.kindLabel} · ${row.id}`,
          html: consumerConfirmHtml(row),
        })
      } catch (error) {
        console.error('[kuendigen] consumer mail failed', error)
      }
      try {
        await sendSmtp(env, {
          to: gymTo,
          name: 'KONNI MMA GYM',
          subject: `[Kündigung] ${row.kindLabel} · ${row.firstName} ${row.lastName} · ${row.id}`,
          html: gymNotifyHtml(row),
        })
      } catch (error) {
        console.error('[kuendigen] gym mail failed', error)
      }

      json(res, 200, {
        ok: true,
        id: row.id,
        kindLabel: row.kindLabel,
        suggestedEnd: row.suggestedEnd,
        receivedAt: row.receivedAt,
      })
    } catch (error) {
      console.error('[kuendigen]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
