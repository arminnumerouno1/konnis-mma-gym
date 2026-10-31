import { isValidEmail, normalizeEmail } from './membership.mjs'
import { isFormerMember, memberBillingStart } from './member-model.mjs'
import { sendBroadcastEmail } from './membership-mail.mjs'

export const BROADCAST_CONFIRM = 'an-alle-mitglieder'
const BODY_MAX = 8000
const SUBJECT_MAX = 140

function firstNameOf(member) {
  const first = String(member?.firstName ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (first) return first
  const name = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
  return name.split(' ')[0] || ''
}

function whoOf(member) {
  return `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
}

/**
 * audience:
 * - active: nur Status aktiv (Standard)
 * - current: aktiv + pausiert
 * - all: alle außer gekündigt/widerrufen/abgelaufen
 */
export function broadcastRecipients(
  members,
  { audience = 'active', plan = '', includeDaypass = false, billingUntil = '' } = {},
) {
  const wantPlan = String(plan || '').trim()
  const mode = ['active', 'current', 'all'].includes(audience) ? audience : 'active'
  const until = /^\d{4}-\d{2}-\d{2}$/.test(String(billingUntil || '')) ? String(billingUntil) : ''
  const seen = new Set()
  const people = []

  for (const member of members ?? []) {
    if (!member) continue
    if (isFormerMember(member.status)) continue
    if (member.plan === 'daypass' && !includeDaypass) continue
    if (mode === 'active' && member.status !== 'active') continue
    if (mode === 'current' && member.status !== 'active' && member.status !== 'paused') continue
    if (wantPlan && member.plan !== wantPlan) continue
    if (until && memberBillingStart(member) > until) continue

    const email = normalizeEmail(member.email)
    if (!isValidEmail(email) || seen.has(email)) continue
    seen.add(email)
    people.push({
      id: member.id,
      email,
      name: whoOf(member),
      first: firstNameOf(member),
      plan: member.plan,
      status: member.status,
      billingStart: memberBillingStart(member),
    })
  }

  people.sort((a, b) => a.name.localeCompare(b.name, 'de') || a.email.localeCompare(b.email))
  return people
}

export function normalizeBroadcastPayload(body) {
  const subject = String(body?.subject ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const text = String(body?.body ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
  const audience = String(body?.audience ?? 'active').trim()
  const plan = String(body?.plan ?? '').trim()
  const includeDaypass = body?.includeDaypass === true
  const billingUntil = String(body?.billingUntil ?? '').trim()
  const confirm = String(body?.confirm ?? '').trim()
  const testEmail = normalizeEmail(body?.testEmail)

  if (!subject || subject.length > SUBJECT_MAX) {
    return { ok: false, error: subject ? 'subject' : 'subject' }
  }
  if (!text || text.length > BODY_MAX) {
    return { ok: false, error: text ? 'body' : 'body' }
  }
  if (!['active', 'current', 'all'].includes(audience)) {
    return { ok: false, error: 'audience' }
  }
  if (plan && !['slowstart', 'standard', 'flex', 'plus', 'daypass', 'first50'].includes(plan)) {
    return { ok: false, error: 'plan' }
  }
  if (billingUntil && !/^\d{4}-\d{2}-\d{2}$/.test(billingUntil)) {
    return { ok: false, error: 'billingUntil' }
  }
  if (testEmail && !isValidEmail(testEmail)) {
    return { ok: false, error: 'email' }
  }

  return {
    ok: true,
    subject,
    body: text,
    audience,
    plan,
    includeDaypass,
    billingUntil,
    confirm,
    testEmail: isValidEmail(testEmail) ? testEmail : '',
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runBroadcast({
  env,
  members,
  payload,
  sendOne = sendBroadcastEmail,
}) {
  const people = broadcastRecipients(members, {
    audience: payload.audience,
    plan: payload.plan,
    includeDaypass: payload.includeDaypass,
    billingUntil: payload.billingUntil,
  })

  function bodyFor(person) {
    return String(payload.body || '')
      .replaceAll('{{name}}', person?.name || 'Vorname Nachname')
      .replaceAll('{{first}}', person?.first || 'du')
  }

  if (payload.testEmail) {
    const probe = people[0] || { name: 'Max Mustermann', first: 'Max' }
    const mailed = await sendOne(env, {
      to: payload.testEmail,
      name: probe?.name || payload.testEmail,
      first: probe?.first || '',
      subject: `Test: ${payload.subject}`,
      body: bodyFor(probe),
    })
    return { ok: true, test: true, sent: mailed === 'skipped' ? 0 : 1, skipped: mailed === 'skipped' ? 1 : 0, failed: 0, total: people.length, mail: mailed }
  }

  if (payload.confirm !== BROADCAST_CONFIRM) {
    return { ok: false, error: 'confirm' }
  }
  if (!people.length) {
    return { ok: false, error: 'no_recipients' }
  }

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const person of people) {
    try {
      const mailed = await sendOne(env, {
        to: person.email,
        name: person.name,
        first: person.first,
        subject: payload.subject,
        body: bodyFor(person),
      })
      if (mailed === 'skipped') skipped += 1
      else sent += 1
    } catch (error) {
      failed += 1
      console.error('[broadcast]', person.email, String(error?.message || error).slice(0, 180))
      break
    }
    await sleep(200)
  }

  return {
    ok: failed === 0,
    test: false,
    sent,
    skipped,
    failed,
    total: people.length,
    remaining: Math.max(0, people.length - sent - skipped - failed),
  }
}
