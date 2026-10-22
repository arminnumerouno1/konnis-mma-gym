import { createHmac, timingSafeEqual } from 'node:crypto'
import { isFormerMember } from './member-model.mjs'
import { isValidEmail, normalizeEmail } from './membership.mjs'

export const PHOTO_TOKEN_TTL_DAYS = 14
export const PHOTO_MAX = 140_000
export const PHOTO_REQUEST_CONFIRM = 'foto-anfordern'

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function secretOf(env) {
  const value = env.INVITE_SECRET?.trim() || env.ADMIN_SECRET?.trim() || ''
  return value.length >= 16 ? value : ''
}

function senderOf(env) {
  return env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
}

function siteOrigin(env) {
  const site = String(env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
  return site.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : site
}

export function needsPortrait(member) {
  if (!member) return false
  if (isFormerMember(member.status)) return false
  if (member.plan === 'daypass') return false
  if (member.photoData) return false
  if (!isValidEmail(normalizeEmail(member.email))) return false
  return true
}

export function membersMissingPortrait(members) {
  return (members ?? [])
    .filter((row) => needsPortrait(row))
    .sort((a, b) =>
      String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de') ||
      String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de'),
    )
}

export function signPhotoToken(secret, { id, email, ttlDays = PHOTO_TOKEN_TTL_DAYS, nowMs = Date.now() } = {}) {
  const key = String(secret ?? '').trim()
  if (key.length < 16) throw new Error('photo_secret')
  const payload = {
    v: 1,
    id: String(id ?? ''),
    e: normalizeEmail(email),
    exp: Math.floor(nowMs / 1000) + Math.max(1, Number(ttlDays) || PHOTO_TOKEN_TTL_DAYS) * 24 * 60 * 60,
  }
  if (!payload.id || !isValidEmail(payload.e)) throw new Error('photo_payload')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyPhotoToken(secret, token) {
  const key = String(secret ?? '').trim()
  if (key.length < 16) return { ok: false, error: 'token' }
  const raw = String(token ?? '')
  const dot = raw.lastIndexOf('.')
  if (dot < 8) return { ok: false, error: 'token' }
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = createHmac('sha256', key).update(body).digest('base64url')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, error: 'token' }
  }
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'token' }
  }
  const id = String(payload?.id ?? '')
  const email = normalizeEmail(payload?.e)
  const exp = Number(payload?.exp)
  if (!id || !isValidEmail(email)) return { ok: false, error: 'token' }
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return { ok: false, error: 'expired' }
  return { ok: true, payload: { id, email, exp } }
}

export function photoRequestMailSubject() {
  return 'Bitte Portraitfoto hochladen · KONNI MMA GYM'
}

export function photoRequestMailHtml({ first = '', url = '' } = {}) {
  const who = escapeMail(String(first ?? '').trim() || 'du')
  const hi = who === 'du' ? 'Hi,' : `Hi ${who},`
  const href = escapeMail(url)
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>${hi}</p>
<p><strong>Bitte lade ein Portraitfoto von dir hoch</strong> – ein Gesichtsbild, auf dem man dich klar erkennt.</p>
<p><strong>Warum brauchen wir das?</strong><br>
Im Studio müssen wir wissen, wer wirklich Mitglied ist. Mit deinem Portraitfoto können wir dich an der Tür zuordnen und verhindern, dass sich jemand anderes mit deinem Namen ausgibt.</p>
<p><strong>So soll das Foto aussehen:</strong></p>
<ul>
<li>dein Gesicht klar und frontal erkennbar</li>
<li>gut beleuchtet, ohne Sonnenbrille und ohne Maske</li>
<li>aktuell, nur du auf dem Bild – kein Gruppenfoto, kein Screenshot von weit weg</li>
</ul>
<p>Der Link gilt <strong>${PHOTO_TOKEN_TTL_DAYS} Tage</strong> und ist nur für dich.</p>
<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#c4121a;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Portraitfoto hochladen</a></p>
<p>Fragen? Schreib an info@mma-in-leipzig.de.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

export function photoUploadUrl(env, token) {
  return `${siteOrigin(env)}/portrait?t=${encodeURIComponent(token)}`
}

async function sendSmtp(env, { to, name, subject, html }, fetchImpl = fetch) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return 'skipped'
  const sender = senderOf(env)
  const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'KONNI MMA GYM', email: sender },
      to: [{ email: to, name: name || to }],
      replyTo: { email: sender, name: 'KONNI MMA GYM' },
      subject,
      htmlContent: html,
    }),
  })
  const detail = await response.text()
  if (!response.ok) throw new Error(`brevo_mail_${response.status}:${detail.slice(0, 240)}`)
  return 'sent'
}

export async function sendPhotoRequestEmail(env, member, { fetchImpl = fetch } = {}) {
  const secret = secretOf(env)
  if (!secret || !env.BREVO_API_KEY?.trim() || !member?.id || !member?.email) return { ok: false, error: 'mail_off' }
  const token = signPhotoToken(secret, { id: member.id, email: member.email })
  const url = photoUploadUrl(env, token)
  const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
  try {
    const mailed = await sendSmtp(
      env,
      {
        to: member.email,
        name,
        subject: photoRequestMailSubject(),
        html: photoRequestMailHtml({ first: member.firstName || name.split(' ')[0] || '', url }),
      },
      fetchImpl,
    )
    if (mailed === 'skipped') return { ok: false, error: 'mail_off' }
    return { ok: true, url, token }
  } catch (error) {
    console.error('[photo-upload]', String(error?.message || error).slice(0, 180))
    return { ok: false, error: 'mail' }
  }
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
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
      if (size > 220_000) {
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

function readPhoto(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/') || value.length < 64 || value.length > PHOTO_MAX) {
    return { ok: false, error: 'photo' }
  }
  return { ok: true, photoData: value }
}

export function createPhotoUploadHandler({ env, store }) {
  const secret = () => secretOf(env)

  return async function handlePhotoUpload(req, res) {
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.setHeader('allow', 'GET, POST, OPTIONS')
        res.end()
        return
      }

      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://localhost')
        const checked = verifyPhotoToken(secret(), url.searchParams.get('t'))
        if (!checked.ok) {
          json(res, checked.error === 'expired' ? 410 : 403, { ok: false, error: checked.error })
          return
        }
        const db = await store.load()
        const member = (db.members ?? []).find((row) => row.id === checked.payload.id)
        if (!member || normalizeEmail(member.email) !== checked.payload.email) {
          json(res, 404, { ok: false, error: 'missing' })
          return
        }
        if (isFormerMember(member.status)) {
          json(res, 409, { ok: false, error: 'closed' })
          return
        }
        json(res, 200, {
          ok: true,
          firstName: member.firstName || '',
          hasPhoto: Boolean(member.photoData),
          days: PHOTO_TOKEN_TTL_DAYS,
        })
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

      const checked = verifyPhotoToken(secret(), body.token)
      if (!checked.ok) {
        json(res, checked.error === 'expired' ? 410 : 403, { ok: false, error: checked.error })
        return
      }
      const photo = readPhoto(body.photoData)
      if (!photo.ok) {
        json(res, 400, { ok: false, error: 'photo' })
        return
      }

      const at = new Date().toISOString()
      let saved = null
      await store.update((db) => {
        const index = (db.members ?? []).findIndex((row) => row.id === checked.payload.id)
        if (index < 0) return db
        const row = db.members[index]
        if (normalizeEmail(row.email) !== checked.payload.email) return db
        if (isFormerMember(row.status)) return db
        db.members[index] = {
          ...row,
          photoData: photo.photoData,
          photoUploadedAt: at,
          updatedAt: at,
        }
        saved = db.members[index]
        return db
      })
      if (!saved) {
        json(res, 404, { ok: false, error: 'missing' })
        return
      }
      json(res, 200, { ok: true, firstName: saved.firstName || '' })
    } catch (error) {
      console.error('[portrait]', error)
      if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
    }
  }
}
