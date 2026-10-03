import { GYM_BANK, spacedIban } from './gym-bank.mjs'
import { membershipPdfAttachments } from './membership-pdf.mjs'

function escapeMail(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function senderOf(env) {
  return env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
}

function gymInbox(env) {
  return env.MEMBERSHIP_NOTIFY_EMAIL?.trim() || senderOf(env)
}

function money(record) {
  const price = Number(record.price)
  const formatted = Number.isFinite(price) ? price.toFixed(2).replace('.', ',') : String(record.price ?? '')
  const unit = record.termMonths ? '/ Monat' : record.plan === 'daypass' ? '/ Tag' : ''
  const term = record.termMonths ? `${record.termMonths} Monate Laufzeit` : record.visitDay ? `Day Pass ${record.visitDay}` : ''
  return { formatted, unit, term }
}

function whoOf(record) {
  return `${record.firstName ?? ''} ${record.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
}

function isFirst50(record) {
  return record.plan === 'first50'
}

export function membershipMailSubject(record, { forGym = false } = {}) {
  const who = whoOf(record)
  if (forGym) return `Neue Mitgliedschaft: ${who} · ${record.planName || record.plan}`
  if (isFirst50(record)) return 'Schön, dass du einer der Ersten bist · KONNI MMA GYM'
  if (record.plan === 'daypass') return 'Dein Day Pass · KONNI MMA GYM'
  return `Willkommen im KONNI MMA GYM · ${record.planName || record.plan}`
}

function dueSentence(record) {
  if (record.payMethod === 'transfer') {
    return 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am 1. November 2026 fällig.'
  }
  if (record.plan === 'daypass') return ''
  return 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Abbuchung ist am 1. November 2026, danach immer zum 1.'
}

function accountLines() {
  return `Kontoinhaber: ${escapeMail(GYM_BANK.holder)}<br>
IBAN: ${escapeMail(spacedIban(GYM_BANK.iban))}<br>
BIC: ${escapeMail(GYM_BANK.bic)}<br>
Bank: ${escapeMail(GYM_BANK.bank)}`
}

function bankBlock(record) {
  if (record.plan === 'daypass') return ''
  if (record.payMethod === 'transfer') {
    return `<p><strong>Deine Zahlungsart: Banküberweisung</strong><br>
Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am 1. November 2026 fällig.<br>
${accountLines()}<br>
SEPA-Lastschrift kommt später.</p>`
  }
  return `<p><strong>Deine Zahlungsart: Karte oder Apple Pay</strong><br>
Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Abbuchung ist am 1. November 2026.<br>
Banküberweisung ist ebenfalls möglich:<br>
${accountLines()}<br>
SEPA-Lastschrift kommt später.</p>`
}

function memberLead(record, { attached = false } = {}) {
  const first = escapeMail(record.firstName || whoOf(record))
  const files = attached
    ? 'Dein Vertrag und die Widerrufsbelehrung liegen als PDF bei.'
    : 'Unten steht die Kopie deines Vertrags.'
  const due = dueSentence(record)

  if (isFirst50(record)) {
    return `<p>Hi ${first},</p>
<p><strong>Schön, dass du einer der Ersten bist.</strong> Die ersten 50 bekommen den Preis, den wir dafür gemacht haben: 89,99€ statt 99,99€, 24 Monate.</p>
<p>Wir freuen uns, dass du von Anfang an dabei bist. Am 2. November geht die Tür auf. Dann sehen wir uns in der Wittenberger Straße.</p>
<p>${files} Unten die Kurzfassung. Widerruf: 14 Tage. ${due}</p>`
  }

  if (record.plan === 'daypass') {
    return `<p>Hi ${first},</p>
<p>dein Day Pass ist da. Wir freuen uns, dass du vorbeikommst.</p>
<p>${files} Widerruf: 14 Tage.</p>`
  }

  return `<p>Hi ${first},</p>
<p>dein Vertrag ist da. Willkommen im KONNI MMA GYM. Wir freuen uns, dass du dabei bist.</p>
<p>${files} Unten die Kurzfassung. Widerruf: 14 Tage. ${due}</p>`
}

function memberSignoff() {
  return `<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>`
}

export function membershipCopyHtml(record, { forGym = false, attached = false } = {}) {
  const who = whoOf(record)
  const { formatted, unit, term } = money(record)
  const when = record.createdAt ? new Date(record.createdAt).toLocaleString('de-DE') : ''
  const early = record.consents?.earlyStart
    ? 'Vorzeitiger Leistungsbeginn ausdrücklich verlangt. Widerruf bleibt. Schon genutzte Tage können berechnet werden.'
    : 'Kein vorzeitiger Leistungsbeginn. 14 Tage Widerruf.'
  const guardian = record.guardian
    ? `<p><strong>Gesetzliche Vertretung</strong><br>${escapeMail(record.guardian.name)} · ${escapeMail(record.guardian.email)} · ${escapeMail(record.guardian.phone)}</p>`
    : ''
  const visit = record.visitDay ? `<p><strong>Day Pass</strong><br>${escapeMail(record.visitDay)}</p>` : ''
  const files = attached
    ? '<p>Angehängt: <strong>Mitgliedsvertrag.pdf</strong> und <strong>Widerrufsbelehrung.pdf</strong>.</p>'
    : '<p><a href="https://www.mma-in-leipzig.de/legal/widerrufsbelehrung.pdf">Widerrufsbelehrung als PDF</a></p>'
  const lead = forGym
    ? `<p>Neue Mitgliedschaft über die Website.${attached ? ' Vertrag und Widerrufsbelehrung liegen als PDF bei.' : ''}${isFirst50(record) ? ' First 50, Sonderpreis 89,99€.' : ''}</p>`
    : `${memberLead(record, { attached })}${memberSignoff()}`

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;max-width:640px">
${lead}
${forGym ? files : ''}
<p style="margin:28px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666">${forGym ? 'Daten' : 'Kurzfassung'}</p>
<h2 style="margin:0 0 8px">Mitgliedsvertrag · ${escapeMail(record.planName || record.plan)}</h2>
<p>KONNI MMA GYM GbR, vertreten durch Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig</p>
<p><strong>Mitglied</strong><br>${escapeMail(who)}, geboren ${escapeMail(record.birthDate)}</p>
<p><strong>Anschrift</strong><br>${escapeMail(record.street)}, ${escapeMail(record.zip)} ${escapeMail(record.city)}</p>
<p><strong>Kontakt</strong><br>${[record.email, record.phone].filter(Boolean).map(escapeMail).join(' · ')}</p>
<p><strong>Tarif</strong><br>${escapeMail(record.planName || record.plan)} · ${escapeMail(formatted)}€ ${escapeMail(unit)} · ${escapeMail(term)}</p>
<p><strong>Aufnahmegebühr</strong><br>0,00 €, nur bis zum 2. November 2026. Danach gilt sie nicht mehr.</p>
<p><strong>Vertragsschluss</strong><br>${escapeMail(when)}</p>
${visit}
${guardian}
<p><strong>Unterschrift</strong><br>${escapeMail(record.signature)}, ${escapeMail(record.place)}</p>
<p><strong>Leistungsbeginn in der Widerrufsfrist</strong><br>${escapeMail(early)}</p>
${bankBlock(record)}
<p>${record.plan === 'daypass' ? 'Der Day Pass wird mit Karte oder Apple Pay bezahlt.' : record.payMethod === 'transfer' ? 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du überweist ihn selbst auf das Konto oben.' : 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du zahlst mit Karte oder Apple Pay über Stripe. Banküberweisung ist ebenfalls möglich. SEPA-Lastschrift kommt später. Zahlungspflicht erst ab echter Eröffnung.'}</p>
<p>AGB Stand 27. September 2026 und Hausordnung wurden vor Abschluss zur Verfügung gestellt. Widerruf: 14 Tage.</p>
${forGym ? '' : files}
<p>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

async function sendSmtp(env, { to, name, subject, html, attachments = [] }) {
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

export async function sendMembershipEmails(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return { member: 'skipped', gym: 'skipped' }

  const who = whoOf(record)
  const gymTo = gymInbox(env)

  let attachments = []
  try {
    attachments = await membershipPdfAttachments(record)
  } catch (error) {
    console.error('[mitglied] pdf failed', error)
  }

  const gym = await sendSmtp(env, {
    to: gymTo,
    name: 'KONNI MMA GYM',
    subject: membershipMailSubject(record, { forGym: true }),
    html: membershipCopyHtml(record, { forGym: true, attached: attachments.length > 0 }),
    attachments,
  })

  const member = await sendSmtp(env, {
    to: record.email,
    name: who,
    subject: membershipMailSubject(record),
    html: membershipCopyHtml(record, { forGym: false, attached: attachments.length > 0 }),
    attachments,
  })

  return { member, gym, pdfs: attachments.map((file) => file.name) }
}
