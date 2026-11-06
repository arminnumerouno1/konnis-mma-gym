import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { findTrialSlot, trialSlotLabel } from './kursplan.mjs'
import { isValidEmail, isValidPhone, normalizeEmail } from './membership.mjs'

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

export function readTrialRequest(body) {
  const name = text(body.name, 80)
  if (name.length < 2) return { ok: false, error: 'invalid' }
  const email = normalizeEmail(body.email)
  if (!isValidEmail(email)) return { ok: false, error: 'invalid' }
  const phone = text(body.phone, 40)
  if (phone.length < 6 || !isValidPhone(phone)) return { ok: false, error: 'invalid' }
  const slot = findTrialSlot(body.slotId ?? body.slot?.id)
  if (!slot) return { ok: false, error: 'slot' }
  const note = longText(body.note, 500)
  return {
    ok: true,
    entry: {
      name,
      email,
      phone,
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
  await store.update((db) => {
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
  return { entry: saved }
}

export function patchTrial(row, patch, now = new Date()) {
  const next = { ...row }
  if (patch.status !== undefined) {
    if (!TRIAL_STATUS.includes(String(patch.status))) return { ok: false, error: 'invalid' }
    next.status = String(patch.status)
  }
  if (patch.adminNote !== undefined) next.adminNote = longText(patch.adminNote, 1500)
  if (patch.note !== undefined && patch.adminNote === undefined) {
    // Accept "note" from admin UI as internal note alias.
    next.adminNote = longText(patch.note, 1500)
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
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Neue Probetraining-Anfrage.</p>
<p><strong>${escapeMail(entry.name)}</strong><br>
<a href="mailto:${escapeMail(entry.email)}">${escapeMail(entry.email)}</a><br>
<a href="tel:${escapeMail(String(entry.phone || '').replace(/[^+0-9]/g, ''))}">${escapeMail(entry.phone)}</a></p>
<p><strong>Slot</strong><br>${slot}</p>
${entry.note ? `<p><strong>Nachricht</strong><br>${escapeMail(entry.note)}</p>` : ''}
<p>Status in der Verwaltung setzen: Neu → Bestätigt → Gekommen / Nicht gekommen.</p>
</div>`
}

async function sendBrevo(env, { to, name, subject, html, replyTo }) {
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
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const detail = await response.text()
  if (!response.ok) throw new Error(`brevo_mail_${response.status}:${detail.slice(0, 240)}`)
  return 'sent'
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
  return sendBrevo(env, {
    to: entry.email,
    name: entry.name,
    subject: trialConfirmMailSubject(entry),
    html: trialConfirmMailHtml(entry),
  })
}
