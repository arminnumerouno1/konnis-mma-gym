import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { findTrialSlot, trialSlotLabel } from './kursplan.mjs'
import { ageOn, isValidEmail, isValidName, isValidPhone, normalizeEmail } from './membership.mjs'
import { buildTrialGuardianConsentPdf } from './membership-pdf.mjs'

const FILE_NAME = 'trials.json'
const BLOB_PATH = 'konni/trials.json'

export const TRIAL_STATUS = ['neu', 'bestaetigt', 'gekommen', 'nicht_gekommen', 'abgesagt']

export const TRIAL_STATUS_LABEL = {
  neu: 'Neu',
  bestaetigt: 'Bestätigt',
  gekommen: 'Gekommen',
  nicht_gekommen: 'Nicht gekommen',
  abgesagt: 'Abgesagt',
}

function text(value, max) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function longText(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function normalize(raw) {
  const entries = Array.isArray(raw?.entries)
    ? raw.entries
    : Array.isArray(raw?.requests)
      ? raw.requests
      : []
  return { version: 1, entries }
}

export function createTrialStore({ dataDir, env = process.env }) {
  const file = join(dataDir, FILE_NAME)
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() || ''
  let chain = Promise.resolve()

  async function loadUnlocked() {
    if (token) {
      const { get } = await import('@vercel/blob')
      const res = await get(BLOB_PATH, { access: 'private', token, useCache: false })
      if (res && res.statusCode === 200 && res.stream) {
        return normalize(JSON.parse(await new Response(res.stream).text()))
      }
    }
    return normalize(await readJsonFile(file))
  }

  async function saveUnlocked(db) {
    const payload = { version: 1, entries: db.entries }
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
    if (token) {
      const { put } = await import('@vercel/blob')
      await put(BLOB_PATH, JSON.stringify(payload), {
        access: 'private',
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
    }
  }

  function withLock(fn) {
    const run = chain.then(fn, fn)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    load: () => withLock(loadUnlocked),
    update: (mutator) =>
      withLock(async () => {
        const db = await loadUnlocked()
        const next = (await mutator(db)) ?? db
        await saveUnlocked(next)
        return next
      }),
  }
}

/** One bookable unit only — reject multi-slot payloads. */
export function singleTrialSlotId(body) {
  if (Array.isArray(body?.slotId) || Array.isArray(body?.slotIds) || Array.isArray(body?.slots)) {
    return ''
  }
  if (body?.slotIds != null || body?.slots != null) return ''
  const raw = body?.slotId ?? body?.slot?.id
  if (raw == null) return ''
  const id = String(raw).trim()
  return id && !id.includes(',') ? id : ''
}

export function normalizeTrialName(value) {
  return String(value || '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Digits only, drop leading DE country / trunk so +49 171… and 0171… match. */
export function normalizeTrialPhone(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('49')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(-10)
}

/**
 * Same person if email, phone, or full name already exists.
 * Cancelled trials (`abgesagt`) do not block a fresh booking.
 */
export function trialIdentityKey(row) {
  return {
    email: normalizeEmail(row?.email),
    phone: normalizeTrialPhone(row?.phone),
    name: normalizeTrialName(row?.name),
  }
}

export function trialIdentityMatch(existing, candidate) {
  const left = trialIdentityKey(existing)
  const right = trialIdentityKey(candidate)
  if (left.email && right.email && left.email === right.email) return 'email'
  if (left.phone && right.phone && left.phone.length >= 6 && left.phone === right.phone) return 'phone'
  if (left.name && right.name && left.name.length >= 3 && left.name === right.name) return 'name'
  return null
}

export function findBlockingTrial(entries, candidate) {
  return (
    (entries || []).find((row) => {
      if (!row || row.status === 'abgesagt') return false
      return Boolean(trialIdentityMatch(row, candidate))
    }) || null
  )
}

function truthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'on'
}

export function trialGuardianMissing(entry) {
  return Boolean(entry?.minor) && !entry?.guardian?.signedAt
}

export function readTrialRequest(body) {
  const name = text(body.name, 80)
  if (name.length < 2) return { ok: false, error: 'invalid' }
  const email = normalizeEmail(body.email)
  if (!isValidEmail(email)) return { ok: false, error: 'invalid' }
  const phone = text(body.phone, 40)
  if (phone.length < 6 || !isValidPhone(phone)) return { ok: false, error: 'invalid' }
  const age = ageOn(body.birthDate)
  if (age == null || age < 6 || age > 100) return { ok: false, error: 'birth' }
  const minor = age < 18
  const guardianRelation = text(body.guardianRelation, 40)
  const guardian = {
    name: text(body.guardianName, 80),
    relation: guardianRelation || 'Mutter / Vater / Vormund',
    email: normalizeEmail(body.guardianEmail),
    phone: text(body.guardianPhone, 40),
    signedAt: null,
    signedVia: null,
  }
  if (minor) {
    if (!isValidName(guardian.name) || !isValidEmail(guardian.email) || !isValidPhone(guardian.phone)) {
      return { ok: false, error: 'guardian' }
    }
    if (!truthy(body.guardianConsent)) return { ok: false, error: 'guardian' }
  }
  const slotId = singleTrialSlotId(body)
  const slot = findTrialSlot(slotId)
  if (!slot) return { ok: false, error: 'slot' }
  const note = longText(body.note, 500)
  return {
    ok: true,
    entry: {
      name,
      email,
      phone,
      birthDate: String(body.birthDate),
      age,
      minor,
      guardian: minor ? guardian : null,
      note,
      slot: {
        id: slot.id,
        dayId: slot.dayId,
        dayLabel: slot.dayLabel,
        time: slot.time,
        title: slot.title,
        level: slot.level,
        label: slot.label,
      },
    },
  }
}

export async function addTrial(store, entry, now = new Date()) {
  const at = now.toISOString()
  let saved = null
  let duplicate = null
  await store.update((db) => {
    duplicate = findBlockingTrial(db.entries, entry)
    if (duplicate) return db
    saved = {
      id: randomUUID(),
      ...entry,
      status: 'neu',
      adminNote: '',
      createdAt: at,
      updatedAt: at,
    }
    db.entries.push(saved)
    return db
  })
  if (duplicate) return { ok: false, error: 'duplicate', existing: duplicate }
  return { ok: true, entry: saved }
}

export function patchTrial(row, patch, now = new Date()) {
  const next = { ...row }
  if (patch.adminNote !== undefined) next.adminNote = longText(patch.adminNote, 1500)
  if (patch.note !== undefined && patch.adminNote === undefined) {
    // Accept "note" from admin UI as internal note alias.
    next.adminNote = longText(patch.note, 1500)
  }
  if (patch.guardian !== undefined && next.minor) {
    const incoming = patch.guardian && typeof patch.guardian === 'object' ? patch.guardian : {}
    const name = text(incoming.name ?? next.guardian?.name, 80)
    const relation = text(incoming.relation ?? next.guardian?.relation, 40)
    const email = normalizeEmail(incoming.email ?? next.guardian?.email)
    const phone = text(incoming.phone ?? next.guardian?.phone, 40)
    if (!isValidName(name) || !isValidPhone(phone)) return { ok: false, error: 'guardian' }
    if (email && !isValidEmail(email)) return { ok: false, error: 'guardian' }
    const signed =
      truthy(incoming.signed) || Boolean(incoming.signedAt) || Boolean(next.guardian?.signedAt)
    const via = text(incoming.signedVia ?? next.guardian?.signedVia, 20) || 'desk'
    next.guardian = {
      name,
      relation: relation || next.guardian?.relation || 'Mutter / Vater / Vormund',
      email: email || next.guardian?.email || '',
      phone,
      signedAt: signed
        ? next.guardian?.signedAt || (incoming.signedAt ? String(incoming.signedAt) : now.toISOString())
        : null,
      signedVia: signed ? via : null,
    }
  }
  if (truthy(patch.guardianSigned) && next.minor) {
    next.guardian = {
      ...(next.guardian || {}),
      signedAt: next.guardian?.signedAt || now.toISOString(),
      signedVia: text(patch.signedVia, 20) || 'desk',
    }
  }
  if (patch.status !== undefined) {
    if (!TRIAL_STATUS.includes(String(patch.status))) return { ok: false, error: 'invalid' }
    const status = String(patch.status)
    if ((status === 'bestaetigt' || status === 'gekommen') && trialGuardianMissing(next)) {
      return { ok: false, error: 'guardian' }
    }
    next.status = status
  }
  next.updatedAt = now.toISOString()
  return { ok: true, entry: next }
}

export function sortTrials(entries) {
  return [...entries].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
}

export function trialStats(entries) {
  const count = (fn) => entries.filter(fn).length
  return {
    total: entries.length,
    fresh: count((row) => row.status === 'neu'),
    open: count((row) => row.status === 'neu' || row.status === 'bestaetigt'),
    gekommen: count((row) => row.status === 'gekommen'),
  }
}

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function trialGymMailSubject(entry) {
  const slot = entry?.slot?.label || trialSlotLabel(entry?.slot || {})
  return `Probetraining: ${entry?.name || 'Anfrage'} · ${slot}`
}

export function trialGymMailHtml(entry) {
  const slot = escapeMail(entry?.slot?.label || '')
  const birth = entry?.birthDate ? `<p><strong>Geburtsdatum</strong><br>${escapeMail(entry.birthDate)}</p>` : ''
  const guardian = entry?.guardian
    ? `<p><strong>Gesetzliche Vertretung</strong><br>${escapeMail(entry.guardian.name)} · ${escapeMail(entry.guardian.relation || '')}<br>
<a href="mailto:${escapeMail(entry.guardian.email)}">${escapeMail(entry.guardian.email)}</a><br>
${escapeMail(entry.guardian.phone)}<br>
Einverständnis: ${entry.guardian.signedAt ? 'liegt vor' : 'fehlt noch'}</p>`
    : ''
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Neue Probetraining-Anfrage.</p>
<p><strong>${escapeMail(entry.name)}</strong><br>
<a href="mailto:${escapeMail(entry.email)}">${escapeMail(entry.email)}</a><br>
<a href="tel:${escapeMail(String(entry.phone || '').replace(/[^+0-9]/g, ''))}">${escapeMail(entry.phone)}</a></p>
${birth}
${guardian}
<p><strong>Slot</strong><br>${slot}</p>
${entry.note ? `<p><strong>Nachricht</strong><br>${escapeMail(entry.note)}</p>` : ''}
<p>Status in der Verwaltung setzen: Neu → Bestätigt → Gekommen / Nicht gekommen.${entry.minor ? ' Unter 18: erst nach Eltern-Einverständnis bestätigen.' : ''}</p>
</div>`
}

async function sendBrevo(env, { to, name, subject, html, replyTo, attachments = [], cc = [] } = {}) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return 'skipped'
  const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
  const payload = {
    sender: { name: 'KONNI MMA GYM', email: sender },
    to: [{ email: to, name: name || to }],
    replyTo: replyTo || { email: sender, name: 'KONNI MMA GYM' },
    subject,
    htmlContent: html,
  }
  if (cc.length) {
    payload.cc = cc
      .filter((row) => row?.email && row.email !== to)
      .map((row) => ({ email: row.email, name: row.name || row.email }))
  }
  if (attachments.length) payload.attachment = attachments
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const detail = await response.text()
  if (!response.ok) throw new Error(`brevo_mail_${response.status}:${detail.slice(0, 240)}`)
  return attachments.length ? 'sent_with_pdf' : 'sent'
}

export async function sendTrialGymMail(env, entry) {
  if (!entry) return 'skipped'
  const sender = env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
  const to = env.TRIAL_NOTIFY_EMAIL?.trim() || sender
  return sendBrevo(env, {
    to,
    name: 'KONNI MMA GYM',
    subject: trialGymMailSubject(entry),
    html: trialGymMailHtml(entry),
    replyTo: { email: entry.email, name: entry.name },
  })
}

export function trialConfirmMailSubject(entry) {
  const slot = entry?.slot?.label || trialSlotLabel(entry?.slot || {})
  return `Dein Probetraining ist bestätigt · ${slot}`
}

export function trialConfirmMailHtml(entry) {
  const first = escapeMail(String(entry?.name || '').trim().split(/\s+/)[0] || 'du')
  const slot = escapeMail(entry?.slot?.label || '')
  const code = entry?.checkinCode
    ? `<p>An der Tür scannst du den QR und gibst deinen Code ein: <strong style="letter-spacing:0.15em">${escapeMail(entry.checkinCode)}</strong></p>`
    : ''
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>dein Probetraining ist bestätigt.</p>
<p><strong>${slot}</strong></p>
${code}
<p>Komm einfach rechtzeitig vorbei – T-Shirt, kurze Hose, Handtuch und Flipflops reichen. Wenn du Fragen hast, antworte einfach auf diese Mail.</p>
<p>Wir freuen uns auf dich.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

/** Bestätigungsmail an den Interessenten, wenn der Desk den Slot freigibt. */
export async function sendTrialConfirmMail(env, entry) {
  if (!entry?.email) return 'skipped'
  if (trialGuardianMissing(entry)) return 'guardian'
  return sendBrevo(env, {
    to: entry.email,
    name: entry.name,
    subject: trialConfirmMailSubject(entry),
    html: trialConfirmMailHtml(entry),
  })
}

export function trialGuardianConsentMailSubject(entry) {
  return `Einverständnis Probetraining für ${entry?.name || 'dein Kind'} · KONNI MMA GYM`
}

export function trialGuardianConsentMailHtml(entry) {
  const guardian = escapeMail(entry?.guardian?.name || 'Eltern / gesetzliche Vertretung')
  const child = escapeMail(entry?.name || 'dein Kind')
  const slot = escapeMail(entry?.slot?.label || '')
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hallo ${guardian},</p>
<p><strong>${child}</strong> hat online ein Probetraining im KONNI MMA GYM angefragt${slot ? ` (${slot})` : ''}.</p>
<p>Unter 18 brauchen wir dein / euer <strong>unterschriebenes Einverständnis</strong>. Ein Häkchen online reicht nicht.</p>
<p><strong>Zwei Wege:</strong></p>
<ol>
<li>PDF ausfüllen, unterschreiben und an <strong>info@mma-in-leipzig.de</strong> zurücksenden (Scan/Foto), oder</li>
<li>mitkommen und vor Ort im Studio unterschreiben.</li>
</ol>
<p>Ohne Unterschrift findet das Probetraining nicht statt.</p>
<p>Angehängt: <strong>Probetraining-Einverstaendnis.pdf</strong>.</p>
<p>Fragen? Kurz an info@mma-in-leipzig.de.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export function trialGuardianPendingMailSubject() {
  return 'Probetraining unter 18 · Einverständnis nötig · KONNI MMA GYM'
}

export function trialGuardianPendingMailHtml(entry) {
  const first = escapeMail(String(entry?.name || '').trim().split(/\s+/)[0] || 'du')
  const guardianMail = escapeMail(entry?.guardian?.email || 'die Eltern')
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>deine Probetraining-Anfrage ist bei uns. Weil du unter 18 bist, brauchen wir zuerst das <strong>unterschriebene Eltern-Einverständnis</strong>.</p>
<p>Wir haben das Formular an <strong>${guardianMail}</strong> geschickt. Die Eltern können unterschreiben und zurücksenden — oder mitkommen und vor Ort unterschreiben.</p>
<p><strong>Ohne Unterschrift kein Probetraining.</strong></p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendTrialGuardianConsentEmail(env, entry) {
  const to = entry?.guardian?.email
  if (!to || !entry?.minor) return 'skipped'
  const pdf = await buildTrialGuardianConsentPdf(entry)
  const mailed = await sendBrevo(env, {
    to,
    name: entry.guardian?.name || to,
    subject: trialGuardianConsentMailSubject(entry),
    html: trialGuardianConsentMailHtml(entry),
    attachments: [
      {
        name: 'Probetraining-Einverstaendnis.pdf',
        content: Buffer.from(pdf).toString('base64'),
      },
    ],
    cc: entry.email && entry.email !== to ? [{ email: entry.email, name: entry.name }] : [],
  })
  if (mailed === 'skipped') return mailed
  if (entry.email && entry.email !== to) {
    try {
      await sendBrevo(env, {
        to: entry.email,
        name: entry.name,
        subject: trialGuardianPendingMailSubject(),
        html: trialGuardianPendingMailHtml(entry),
      })
    } catch (error) {
      console.error('[trial] guardian member notice failed', error)
    }
  }
  return mailed
}
