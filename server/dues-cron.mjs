import { DEFAULT_BILLING_START, openDuesOf } from './member-model.mjs'
import { createMemberStore } from './member-store.mjs'
import { sendReminderEmail } from './membership-mail.mjs'
import { berlinIsoDate } from './opening.mjs'

const REMINDER_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000
const BATCH = 40
const STAGES = ['reminder', 'mahnung1', 'mahnung2']

export function nextDunningStage(reminders = []) {
  const last = Array.isArray(reminders) && reminders.length ? reminders[reminders.length - 1] : null
  if (!last?.stage) return 'reminder'
  if (last.stage === 'reminder') return 'mahnung1'
  if (last.stage === 'mahnung1') return 'mahnung2'
  return 'mahnung2'
}

function secretsEqual(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  if (!left || left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

export function cronAuthorized(req, env) {
  const secret = env.CRON_SECRET?.trim() || env.SIGNUP_MAIL_PROOF?.trim() || ''
  if (!secret) return false
  const auth = String(req.headers?.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ') && secretsEqual(auth.slice(7).trim(), secret)) return true
  const header = String(req.headers?.['x-cron-secret'] || '').trim()
  if (secretsEqual(header, secret)) return true
  return false
}

/**
 * Sendet Mahnungen an Mitglieder mit offenen Beiträgen.
 * Stufe steigt automatisch: Erinnerung → 1. Mahnung → 2. Mahnung.
 * Ab erstem Abbuchungstag, max. BATCH, Cooldown 5 Tage.
 */
export async function runDueReminders({
  store,
  env,
  today = berlinIsoDate(),
  sendReminder = sendReminderEmail,
  limit = BATCH,
  stage = 'auto',
  payMethod = 'transfer',
} = {}) {
  if (today < DEFAULT_BILLING_START) {
    return { ok: true, skipped: 'before_billing', sent: 0, candidates: 0 }
  }
  const db = await store.load()
  const candidates = []
  for (const member of db.members ?? []) {
    if (payMethod && member.payMethod !== payMethod) continue
    if (member.status === 'paused' || member.status === 'withdrawn' || member.status === 'expired' || member.status === 'cancelled') {
      continue
    }
    const dues = openDuesOf(member, today)
    if (!dues.openCount) continue
    if (dues.lastReminderAt) {
      const age = Date.now() - Date.parse(dues.lastReminderAt)
      if (Number.isFinite(age) && age < REMINDER_COOLDOWN_MS) continue
    }
    const nextStage = STAGES.includes(stage) ? stage : nextDunningStage(member.reminders)
    candidates.push({ member, dues, stage: nextStage })
  }
  candidates.sort((a, b) => b.dues.openAmount - a.dues.openAmount)

  let sent = 0
  const byStage = { reminder: 0, mahnung1: 0, mahnung2: 0 }
  const errors = []
  for (const row of candidates.slice(0, limit)) {
    let mailed = 'skipped'
    try {
      mailed = await sendReminder(env, row.member, {
        stage: row.stage,
        periods: row.dues.openPeriods,
        amount: row.dues.openAmount,
      })
    } catch (error) {
      errors.push({ id: row.member.id, error: String(error?.message || error) })
      continue
    }
    if (!mailed || mailed === 'skipped') continue
    const at = new Date().toISOString()
    const entry = {
      at,
      stage: row.stage,
      periods: row.dues.openPeriods,
      amount: row.dues.openAmount,
      email: row.member.email,
      mail: mailed,
      source: 'cron',
    }
    await store.update((fresh) => {
      const index = fresh.members.findIndex((item) => item.id === row.member.id)
      if (index < 0) return fresh
      const current = fresh.members[index]
      fresh.members[index] = {
        ...current,
        reminders: [...(current.reminders ?? []), entry].slice(-40),
        updatedAt: at,
      }
      return fresh
    })
    sent += 1
    if (byStage[row.stage] != null) byStage[row.stage] += 1
  }

  return {
    ok: true,
    today,
    candidates: candidates.length,
    sent,
    byStage,
    errors: errors.slice(0, 10),
  }
}

export function createDuesCronHandler({ dataDir, env, sendReminder = sendReminderEmail } = {}) {
  const store = createMemberStore({ dataDir, env })
  return async function handleDuesCron(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'method' }))
      return
    }
    if (!cronAuthorized(req, env)) {
      res.statusCode = 401
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'auth' }))
      return
    }
    const result = await runDueReminders({ store, env, sendReminder })
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(result))
  }
}
