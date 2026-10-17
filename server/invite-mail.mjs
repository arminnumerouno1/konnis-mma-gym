import { timingSafeEqual } from 'node:crypto'
import { tmpdir } from 'node:os'
import { isValidEmail, normalizeEmail } from './membership.mjs'
import { membershipTaken } from './member-model.mjs'
import { createMemberStore } from './member-store.mjs'
import { FIRST50_ID, FIRST50_SLOT_MAX, PLUS_ID, contractStart, contractTerm, makeInvitePayload, normalizePersonName, signInvite } from './invite.mjs'
import { germanDate } from './member-model.mjs'
import { sendMembershipEmails } from './membership-mail.mjs'

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function first50InviteSubject({ test = false, lastChance = false } = {}) {
  const subject = lastChance
    ? 'Letzte Chance: First 50 · KONNI MMA GYM'
    : 'Du gehörst zu den ersten 50 · KONNI MMA GYM'
  return test ? `Test: ${subject}` : subject
}

export function first50InviteHtml({ first, name, email, url, start = '', term = 0, lastChance = false } = {}) {
  const who = escapeMail(first)
  const full = escapeMail(name)
  const mail = escapeMail(email)
  const href = escapeMail(url)
  const deferred = contractStart(start)
  const months = contractTerm(term) || 24
  const when = deferred ? germanDate(deferred) : ''
  const welcome = deferred
    ? `Dein Vertrag beginnt am <strong>${escapeMail(when)}</strong>. Die erste Zahlung ist an dem Tag. Vorher wird nichts berechnet. Über den Link schließt du den Vertrag ab. Name und E-Mail sind fest. Der Link gilt <strong>48 Stunden</strong> und nur für dich.`
    : 'Wir freuen uns, wenn du von Anfang an dabei bist. Am 2. November geht die Tür auf. Über den Link schließt du den Vertrag ab. Name und E-Mail sind fest. Der Link gilt <strong>48 Stunden</strong> und nur für dich.'
  const payment = deferred
    ? `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Zahlung ist am ${escapeMail(when)}. Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung. SEPA-Lastschrift kommt später. Die Aufnahmegebühr beträgt 0 €.`
    : 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Zahlung ist am 1. November 2026. Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung. SEPA-Lastschrift kommt später. Die Aufnahmegebühr von 0 € gilt nur bis zum 2. November 2026. Danach beträgt sie 49 €.'
  const offer = months === 12
    ? `<strong>89,99€ statt 99,99€</strong>, 12 Monate. Das ist ein Sondervertrag über 12 Monate.`
    : `<strong>89,99€ statt 99,99€</strong>, 24 Monate.`
  const chance = lastChance
    ? `<p><strong>Das ist deine letzte einmalige Chance</strong> auf den First-50-Preis. Danach gibt es keinen weiteren Link.</p>`
    : ''
  const expiry = lastChance
    ? 'Weiterleiten bringt den Sonderpreis niemandem sonst. Nach 48 Stunden ist der Link abgelaufen. Nutzt du diese letzte Chance nicht, ist der Platz weg.'
    : 'Weiterleiten bringt den Sonderpreis niemandem sonst. Nach 48 Stunden ist der Link abgelaufen. Nutzt du die 48 Stunden nicht, geht dein Platz automatisch an die nächste Person.'
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;max-width:640px">
<p>Hi ${who},</p>
<p><strong>Du gehörst zu den ersten 50.</strong> Deshalb bekommst du den Preis, den wir dafür gemacht haben: ${offer}</p>
${chance}
<p>${welcome}</p>
<p>${full} · ${mail}</p>
<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Vertrag abschließen</a></p>
<p>${expiry}</p>
<p>${payment}</p>
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

function slotTaken(members, slot) {
  return (members ?? []).some(
    (row) =>
      row?.plan === 'first50' &&
      row?.status !== 'cancelled' &&
      row?.status !== 'withdrawn' &&
      row?.status !== 'expired' &&
      Number(row?.inviteSlot) === slot,
  )
}

async function defaultMembers(env) {
  const store = createMemberStore({ dataDir: tmpdir(), env })
  if (env.VERCEL && store.kind !== 'blob') {
    const error = new Error('no-blob')
    error.code = 'no-blob'
    throw error
  }
  const db = await store.load()
  return db.members ?? []
}

async function postInvite({ fetchImpl, apiKey, sender, email, name, subject, html }) {
  const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'KONNI MMA GYM', email: sender },
      to: [{ email, name }],
      replyTo: { email: sender, name: 'KONNI MMA GYM' },
      subject,
      htmlContent: html,
    }),
  })
  const detail = await response.text()
  if (!response.ok) {
    const error = new Error(`brevo_${response.status}`)
    error.detail = detail.slice(0, 180)
    throw error
  }
}

export function plusInviteSubject() {
  return 'Dein Plus-Vertrag ab Dezember · KONNI MMA GYM'
}

export function plusInviteHtml({ first, name, email, url, start = '' } = {}) {
  const who = escapeMail(first)
  const full = escapeMail(name)
  const mail = escapeMail(email)
  const href = escapeMail(url)
  const deferred = contractStart(start)
  const when = deferred ? germanDate(deferred) : germanDate('2026-12-01')
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;max-width:640px">
<p>Hi ${who},</p>
<p>hier ist dein persönlicher Link für den Tarif <strong>Plus</strong>: <strong>119€</strong> im Monat, <strong>6 Monate</strong>.</p>
<p>Dein Vertrag beginnt am <strong>${escapeMail(when)}</strong>. Die erste Zahlung ist an dem Tag. Vorher wird nichts berechnet.</p>
<p>Über den Link schließt du den Vertrag online ab. Name und E-Mail sind fest. Der Link gilt <strong>48 Stunden</strong> und nur für dich.</p>
<p>${full} · ${mail}</p>
<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Vertrag abschließen</a></p>
<p>Alle Kurse inklusive: MMA, Boxen, BJJ und mehr. So oft du willst – nicht nur 2× die Woche.</p>
<p>Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung. SEPA-Lastschrift kommt später. Die Aufnahmegebühr von 0 € gilt nur bis zum 2. November 2026. Danach beträgt sie 49 €.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

export async function deliverFirst50Invite({
  env,
  fetchImpl = fetch,
  email,
  name,
  slot,
  plan = FIRST50_ID,
  start = '',
  term = 0,
  lastChance = false,
}) {
  const secret = env.INVITE_SECRET
  const apiKey = env.BREVO_API_KEY?.trim()
  const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
  if (!apiKey || !secret) return { ok: false, error: 'mail_off' }
  const site = String(env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
  const origin = site.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : site
  const planId = plan === PLUS_ID ? PLUS_ID : FIRST50_ID
  const token = signInvite(secret, makeInvitePayload({ email, name, slot, plan: planId, start, term }))
  const url = `${origin}/mitglied?invite=${encodeURIComponent(token)}`
  const first = name.split(' ')[0] || name
  const subject = planId === PLUS_ID ? plusInviteSubject() : first50InviteSubject({ test: false, lastChance })
  const html =
    planId === PLUS_ID
      ? plusInviteHtml({ first, name, email, url, start })
      : first50InviteHtml({ first, name, email, url, start, term, lastChance })
  try {
    await postInvite({
      fetchImpl,
      apiKey,
      sender,
      email,
      name,
      first,
      subject,
      html,
    })
  } catch (error) {
    console.error('[invite-mail]', String(error?.detail || error?.message || error).slice(0, 180))
    return { ok: false, error: 'mail' }
  }
  return { ok: true, email, slot, plan: planId }
}

export function createInviteMailHandler({ env, fetchImpl = fetch, loadMembers = null }) {
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
      const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'

      if (body.one === true) {
        if (!secretsMatch(body.proof, env.SIGNUP_MAIL_PROOF?.trim()) || !apiKey || !secret) {
          json(res, 403, { ok: false, error: 'invite' })
          return
        }
        const email = normalizeEmail(body.email)
        const name = normalizePersonName(body.name)
        const slot = Number(body.slot)
        const start = body.start ? contractStart(body.start) : ''
        const term = body.term ? contractTerm(body.term) : 0
        const lastChance = body.lastChance === true
        if (!isValidEmail(email) || name.length < 3 || !Number.isInteger(slot) || slot < 1 || slot > FIRST50_SLOT_MAX || (body.start && !start) || (body.term && !term)) {
          json(res, 400, { ok: false, error: 'invalid' })
          return
        }
        const members = await (loadMembers ? loadMembers() : defaultMembers(env))
        if (membershipTaken(members, email)) {
          json(res, 409, { ok: false, error: 'duplicate' })
          return
        }
        if (slotTaken(members, slot)) {
          json(res, 409, { ok: false, error: 'slot' })
          return
        }
        if (term === 12) {
          try {
            const store = createMemberStore({ dataDir: tmpdir(), env })
            await store.update((db) => {
              const issued = Array.isArray(db.issuedFirst50) ? [...db.issuedFirst50] : []
              const index = issued.findIndex((row) => normalizeEmail(row?.email) === email && Number(row?.slot) === slot)
              const next = {
                ...(index >= 0 ? issued[index] : {}),
                slot,
                email,
                name,
                at: new Date().toISOString(),
                term: 12,
                ...(start ? { start } : {}),
              }
              if (index >= 0) issued[index] = next
              else issued.push(next)
              db.issuedFirst50 = issued
              return db
            })
          } catch (error) {
            console.error('[invite-mail] term', String(error?.message || error).slice(0, 180))
          }
        }
        const site = String(env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
        const origin = site.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : site
        const token = signInvite(secret, makeInvitePayload({ email, name, slot, start, term }))
        const url = `${origin}/mitglied?invite=${encodeURIComponent(token)}`
        const first = name.split(' ')[0] || name
        try {
          await postInvite({
            fetchImpl,
            apiKey,
            sender,
            email,
            name,
            first,
            subject: first50InviteSubject({ test: false, lastChance }),
            html: first50InviteHtml({ first, name, email, url, start, term, lastChance }),
          })
        } catch (error) {
          console.error('[invite-mail]', String(error?.detail || error?.message || error).slice(0, 180))
          json(res, 502, { ok: false, error: 'upstream' })
          return
        }
        json(res, 200, { ok: true, email, slot })
        return
      }

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
      if (!isValidEmail(email) || name.length < 3 || !Number.isInteger(slot) || slot < 1 || slot > FIRST50_SLOT_MAX) {
        json(res, 400, { ok: false, error: 'invalid' })
        return
      }

      const site = String(env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
      const origin = site.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : site
      const token = signInvite(secret, makeInvitePayload({ email, name, slot }))
      const url = `${origin}/mitglied?invite=${encodeURIComponent(token)}`
      const first = name.split(' ')[0] || name
      const test = body.test === true

      try {
        await postInvite({
          fetchImpl,
          apiKey,
          sender,
          email,
          name,
          first,
          subject: first50InviteSubject({ test }),
          html: first50InviteHtml({ first, name, email, url }),
        })
      } catch (error) {
        console.error('[invite-mail]', String(error?.detail || error?.message || error).slice(0, 180))
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
