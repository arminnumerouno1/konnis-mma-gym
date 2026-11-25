import { GYM_BANK, spacedIban } from './gym-bank.mjs'
import {
  buildContractPdf,
  buildGuardianMandatePdf,
  loadWithdrawalPdf,
  membershipPdfAttachments,
} from './membership-pdf.mjs'
import { germanDate, memberBillingStart } from './member-model.mjs'
import { trainingHasStarted } from './opening.mjs'
import { formatTransferEuro, transferDueLabel, transferNextLabel } from './transfer-due.mjs'

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
  if (isFirst50(record)) return 'Willkommen zum Sonderpreis · KONNI MMA GYM'
  if (record.plan === 'daypass') return 'Dein Day Pass · KONNI MMA GYM'
  return `Willkommen im KONNI MMA GYM · ${record.planName || record.plan}`
}

function dueOn(record) {
  return germanDate(memberBillingStart(record))
}

function transferMailLines(record) {
  const t = record.transfer
  if (!t) return null
  const total = formatTransferEuro(t.amount)
  const month = formatTransferEuro(t.monthAmount ?? Math.round(Number(record.price) * 100))
  const share = formatTransferEuro(t.prorateAmount ?? t.amount)
  const fee = Number(t.feeAmount) || 0
  const next = transferNextLabel(t) || dueOn(record)
  const due = transferDueLabel(t) || dueOn(record)
  const purpose = escapeMail(t.purpose || `KONNI Beitrag ${whoOf(record)}`)
  const feeLine =
    fee > 0
      ? `<br>Davon Aufnahmegebühr: <strong>${escapeMail(formatTransferEuro(fee))}€</strong> (einmalig).`
      : ''
  if (t.prorated) {
    return {
      sentence: `Du zahlst jetzt einen <strong>anteiligen Beitrag</strong> für den Rest dieses Monats: <strong>${escapeMail(share)}€</strong>${fee > 0 ? ` zuzüglich Aufnahmegebühr <strong>${escapeMail(formatTransferEuro(fee))}€</strong>` : ''}. Überweise jetzt insgesamt <strong>${escapeMail(total)}€</strong>. Ab dem ${escapeMail(next)} dann den vollen Monatsbeitrag <strong>${escapeMail(month)}€</strong>.`,
      block: `<p><strong>Deine Zahlungsart: Banküberweisung</strong><br>
<strong>Das ist ein anteiliger Beitrag</strong> für den Rest des laufenden Monats — nicht der volle Monatsbeitrag.<br>
Jetzt überweisen: <strong>${escapeMail(total)}€</strong> (anteiliger Beitrag ${escapeMail(share)}€${fee > 0 ? ` + Aufnahmegebühr ${escapeMail(formatTransferEuro(fee))}€` : ''}).${feeLine}<br>
Ab dem ${escapeMail(next)}: monatlich <strong>${escapeMail(month)}€</strong> (voller Beitrag).<br>
Verwendungszweck: <strong>${purpose}</strong><br>
${accountLines()}<br>
SEPA-Lastschrift kommt später.</p>`,
    }
  }
  return {
    sentence: `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung (${escapeMail(total)}€) ist am ${escapeMail(due)} fällig. Danach monatlich ${escapeMail(month)}€.`,
    block: `<p><strong>Deine Zahlungsart: Banküberweisung</strong><br>
Erste Überweisung: <strong>${escapeMail(total)}€</strong>${fee > 0 ? ` (Monatsbeitrag ${escapeMail(month)}€ + Aufnahmegebühr ${escapeMail(formatTransferEuro(fee))}€)` : ''} — fällig am ${escapeMail(due)}.<br>
Danach immer zum 1.: <strong>${escapeMail(month)}€</strong> im Monat.<br>
Verwendungszweck: <strong>${purpose}</strong><br>
${accountLines()}<br>
SEPA-Lastschrift kommt später.</p>`,
  }
}

function dueSentence(record) {
  if (record.payMethod === 'transfer') {
    const lines = transferMailLines(record)
    if (lines) return lines.sentence.replace(/<[^>]+>/g, '')
    const when = dueOn(record)
    return `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am ${when} fällig.`
  }
  const when = dueOn(record)
  if (record.plan === 'daypass') return ''
  return `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Abbuchung ist am ${when}, danach immer zum 1.`
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
    const lines = transferMailLines(record)
    if (lines) return lines.block
    return `<p><strong>Deine Zahlungsart: Banküberweisung</strong><br>
Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am ${dueOn(record)} fällig.<br>
${accountLines()}<br>
SEPA-Lastschrift kommt später.</p>`
  }
  return `<p><strong>Deine Zahlungsart: Karte, Apple Pay oder SEPA-Lastschrift</strong><br>
Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Abbuchung ist am ${dueOn(record)}.<br>
Die Zahlung läuft über Stripe. Bei SEPA-Lastschrift erteilst du das Mandat im Checkout.</p>`
}

function memberLead(record, { attached = false } = {}) {
  const first = escapeMail(record.firstName || whoOf(record))
  const files = attached
    ? 'Dein Vertrag und die Widerrufsbelehrung liegen als PDF bei.'
    : 'Unten steht die Kopie deines Vertrags.'
  const due = dueSentence(record)

  if (isFirst50(record)) {
    const later = memberBillingStart(record) > '2026-11-01'
    const welcome = later
      ? `Dein Vertrag beginnt am ${dueOn(record)}. Vorher wird nichts berechnet.`
      : 'Willkommen im KONNI MMA GYM. Das Studio ist offen – wir freuen uns auf dich auf der Matte.'
    return `<p>Hi ${first},</p>
<p><strong>Schön, dass du dabei bist.</strong> Mit deinem Sonderpreis zahlst du 89,99€ statt 99,99€, ${record.termMonths || 24} Monate.</p>
<p>${welcome}</p>
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

const ESN_CODE = 'KONNI'
const ESN_SHOP_URL = 'https://www.esn.com/instagram/KONNI/aktion'
const DEFAULT_SITE = 'https://www.mma-in-leipzig.de'

function siteOf(site) {
  const raw = String(site || DEFAULT_SITE).trim() || DEFAULT_SITE
  return raw.replace(/\/+$/, '')
}

/** Check-in-Code in der Vertragsmail — jedes neue Mitglied soll den Code hier bekommen. */
export function checkinCodeMailBlock(record, { site = DEFAULT_SITE, forGym = false } = {}) {
  const code = String(record?.checkinCode || '')
    .trim()
    .toUpperCase()
  if (!code) return ''
  if (forGym) return `<p><strong>Check-in-Code</strong><br>${escapeMail(code)}</p>`
  const checkinUrl = escapeMail(`${siteOf(site)}/checkin`)
  return `<p><strong>Dein Check-in-Code</strong><br>
An der Tür hängt ein QR-Code. Den scannst du mit dem Handy und landest auf unserer Check-in-Seite. Dort gibst du deinen persönlichen Code ein:<br>
<span style="font-size:24px;letter-spacing:0.18em;font-weight:bold">${escapeMail(code)}</span><br>
Link: <a href="${checkinUrl}">${checkinUrl}</a><br>
Dein Code ist nur für dich. Beim ersten Check-in kannst du ihn im Passwortmanager speichern.</p>`
}

function esnPartnerBlock() {
  return `<p><strong>Werbung</strong><br>
<strong>Kleine Extra-Info von Konrad</strong><br>
Konrad wird von ESN gesponsert. Mit seinem Code <strong>${ESN_CODE}</strong> sparst du dauerhaft 10% auf jede Bestellung im ESN Shop. Das ist Werbung für ein Partnerangebot.<br>
Code: <strong>${ESN_CODE}</strong><br>
Shop: <a href="${ESN_SHOP_URL}">${ESN_SHOP_URL}</a><br>
Einfach im Checkout einlösen. Fertig.</p>`
}

export function membershipCopyHtml(record, { forGym = false, attached = false, site = DEFAULT_SITE } = {}) {
  const who = whoOf(record)
  const { formatted, unit, term } = money(record)
  const when = record.createdAt ? new Date(record.createdAt).toLocaleString('de-DE') : ''
  const beforeOpening = !trainingHasStarted(record.createdAt ? new Date(record.createdAt) : new Date())
  const laterStart = memberBillingStart(record) > '2026-11-01'
  const early = laterStart
    ? `Der Vertrag beginnt am ${dueOn(record)}. Vorher fällt kein Mitgliedsbeitrag an.`
    : beforeOpening
    ? 'Training beginnt mit dem vertraglichen Start. Vorher gibt es kein Training.'
    : record.consents?.earlyStart
      ? 'Vorzeitiger Leistungsbeginn ausdrücklich verlangt. Widerruf bleibt. Schon genutzte Tage können berechnet werden.'
      : 'Kein vorzeitiger Leistungsbeginn. 14 Tage Widerruf.'
  const earlyLabel = beforeOpening ? 'Training' : 'Leistungsbeginn in der Widerrufsfrist'
  const guardian = record.guardian
    ? `<p><strong>Gesetzliche Vertretung</strong><br>${escapeMail(record.guardian.name)} · ${escapeMail(record.guardian.email)} · ${escapeMail(record.guardian.phone)}</p>`
    : ''
  const visit = record.visitDay ? `<p><strong>Day Pass</strong><br>${escapeMail(record.visitDay)}</p>` : ''
  const checkin = checkinCodeMailBlock(record, { site, forGym })
  const files = attached
    ? '<p>Angehängt: <strong>Mitgliedsvertrag.pdf</strong> und <strong>Widerrufsbelehrung.pdf</strong>.</p>'
    : '<p><a href="https://www.mma-in-leipzig.de/legal/widerrufsbelehrung.pdf">Widerrufsbelehrung als PDF</a></p>'
  const lead = forGym
    ? `<p>Neue Mitgliedschaft über die Website.${attached ? ' Vertrag und Widerrufsbelehrung liegen als PDF bei.' : ''}${isFirst50(record) ? ' Family & Friends Tarif, Sonderpreis 89,99€.' : ''}</p>`
    : `${memberLead(record, { attached })}${checkin}${esnPartnerBlock()}${memberSignoff()}`

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;max-width:640px">
${lead}
${forGym ? files : ''}
<p style="margin:28px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666">${forGym ? 'Daten' : 'Kurzfassung'}</p>
<h2 style="margin:0 0 8px">Mitgliedsvertrag · ${escapeMail(record.planName || record.plan)}</h2>
<p>KONNI MMA GYM GbR, vertreten durch Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig</p>
<p><strong>Mitglied</strong><br>${escapeMail(who)}, geboren ${escapeMail(record.birthDate)}</p>
<p><strong>Anschrift</strong><br>${escapeMail(record.street)}, ${escapeMail(record.zip)} ${escapeMail(record.city)}</p>
<p><strong>Kontakt</strong><br>${[record.email, record.phone].filter(Boolean).map(escapeMail).join(' · ')}</p>
${forGym ? checkin : ''}
<p><strong>Tarif</strong><br>${escapeMail(record.planName || record.plan)} · ${escapeMail(formatted)}€ ${escapeMail(unit)} · ${escapeMail(term)}</p>
${
  record.plan === 'slowstart'
    ? '<p><strong>Leistung</strong><br>2 Kurse / Einheiten pro Woche. MMA, Boxen, BJJ und mehr.</p>'
    : record.plan === 'daypass'
      ? ''
      : '<p><strong>Leistung</strong><br>Alle Kurse inklusive. So oft du willst – nicht nur 2× die Woche.</p>'
}
${
  record.plan === 'daypass'
    ? ''
    : `<p><strong>Aufnahmegebühr</strong><br>${Number(record.fee ?? 0).toFixed(2).replace('.', ',')} €</p>`
}
<p><strong>Vertragsschluss</strong><br>${escapeMail(when)}</p>
${visit}
${guardian}
<p><strong>Unterschrift</strong><br>${escapeMail(record.signature)}, ${escapeMail(record.place)}</p>
<p><strong>${earlyLabel}</strong><br>${escapeMail(early)}</p>
${bankBlock(record)}
<p>${
  record.plan === 'daypass'
    ? 'Der Day Pass wird mit Karte, Apple Pay oder SEPA-Lastschrift über Stripe bezahlt.'
    : record.payMethod === 'transfer'
      ? record.transfer?.prorated
        ? 'Bitte überweise den oben genannten <strong>anteiligen Beitrag</strong> selbst auf das Konto. Ab dem nächsten 1. dann den vollen Monatsbeitrag.'
        : 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du überweist ihn selbst auf das Konto oben.'
      : 'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du zahlst mit Karte, Apple Pay oder SEPA-Lastschrift über Stripe.'
}</p>
<p>AGB Stand 22. Oktober 2026 und Hausordnung wurden vor Abschluss zur Verfügung gestellt. Widerruf: 14 Tage.</p>
${forGym ? '' : files}
${record.signedUploadName ? '<p>Zusätzlich liegt der hochgeladene unterschriebene Vertrag bei.</p>' : ''}
<p>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

async function sendSmtp(env, { to, name, subject, html, attachments = [], cc = [] } = {}) {
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

export function priceChangeMailSubject(record) {
  const price = Number(record?.price).toFixed(2).replace('.', ',')
  return `Dein Beitrag ist jetzt ${price}€ · KONNI MMA GYM`
}

export function priceChangeMailHtml(record) {
  const first = escapeMail(record.firstName || whoOf(record))
  const price = escapeMail(Number(record.price).toFixed(2).replace('.', ','))
  const when = escapeMail(dueOn(record))
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>dein monatlicher Mitgliedsbeitrag beträgt ab jetzt <strong>${price}€</strong>.</p>
<p>Du zahlst per Banküberweisung. Die erste Überweisung ist am ${when} fällig. Danach immer zum 1. des Monats. Vorher wird nichts berechnet.</p>
<p><strong>Konto</strong><br>
${accountLines()}</p>
<p>Laufzeit und Vertrag bleiben sonst wie vereinbart.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendPriceChangeEmail(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email || record.payMethod !== 'transfer') return 'skipped'
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: priceChangeMailSubject(record),
    html: priceChangeMailHtml(record),
  })
}

export function transferSwitchMailSubject() {
  return 'Zahlungsart auf Überweisung umgestellt · KONNI MMA GYM'
}

export function transferSwitchMailHtml(record) {
  const first = escapeMail(record.firstName || whoOf(record))
  const price = escapeMail(Number(record.price).toFixed(2).replace('.', ','))
  const t = record.transfer
  const purpose = escapeMail(t?.purpose || `KONNI Beitrag ${whoOf(record)}`)
  const next = escapeMail(transferNextLabel(t) || '1. des Monats')
  const openNow = (record.payments ?? []).find(
    (row) => row.kind === 'month' && (row.status === 'open' || row.status === 'failed'),
  )
  const dueNow =
    openNow != null
      ? escapeMail(Number(openNow.amount ?? record.price).toFixed(2).replace('.', ','))
      : t?.amount != null
        ? escapeMail(formatTransferEuro(t.amount))
        : price
  const monthLine = openNow
    ? `<p>Bitte überweise jetzt den offenen Beitrag für diesen Monat: <strong>${dueNow}€</strong>. Ab dem ${next} dann monatlich <strong>${price}€</strong>.</p>`
    : `<p>Den laufenden Monat haben wir als bezahlt verbucht. Ab dem ${next} bitte den Monatsbeitrag <strong>${price}€</strong> selbst überweisen.</p>`
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>kurze Info zu deiner Mitgliedschaft: Wir stellen dich <strong>vollständig auf Banküberweisung</strong> um. Die Kartenzahlung / das Stripe-Abo ist beendet — es wird nichts mehr von der Karte abgebucht.</p>
${monthLine}
<p><strong>Konto</strong><br>
${accountLines()}<br>
Verwendungszweck: <strong>${purpose}</strong></p>
<p>Wenn etwas unklar ist, einfach kurz an info@mma-in-leipzig.de schreiben.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendTransferSwitchEmail(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email || record.payMethod !== 'transfer') return 'skipped'
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: transferSwitchMailSubject(),
    html: transferSwitchMailHtml(record),
  })
}

export function checkinCodeMailSubject() {
  return 'Dein Check-in-Code · KONNI MMA GYM'
}

export function checkinCodeMailHtml(record, site = 'https://www.mma-in-leipzig.de') {
  const first = escapeMail(record.firstName || whoOf(record))
  const code = escapeMail(record.checkinCode || '')
  const checkinUrl = escapeMail(`${String(site).replace(/\/$/, '')}/checkin`)
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>ab jetzt checkst du dich vor dem Training selbst ein.</p>
<p>An der Tür hängt ein QR-Code. Den scannst du mit dem Handy und landest auf unserer Check-in-Seite. Dort gibst du deinen persönlichen Code ein:</p>
<p style="font-size:28px;letter-spacing:0.2em;font-weight:bold">${code}</p>
<p>Link: <a href="${checkinUrl}">${checkinUrl}</a></p>
<p>Warum machen wir das?<br>Damit wir klar sehen, wer wirklich im Training war – und die Anwesenheit sauber zuordnen können.</p>
<p>Dein Code ist nur für dich. Beim ersten Check-in kannst du ihn im Passwortmanager deines Handys speichern – dann musst du ihn nicht merken.</p>
<p>Kein Handy dabei oder Code weg? Melde dich einfach persönlich bei uns, dann checken wir dich manuell ein.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendCheckinCodeEmail(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email || !record?.checkinCode) return 'skipped'
  const site = env.SITE_URL?.trim() || env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de'
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: checkinCodeMailSubject(),
    html: checkinCodeMailHtml(record, site),
  })
}

export function paperReturnMailSubject() {
  return 'Dein Vertrag zum Unterschreiben · KONNI MMA GYM'
}

export function paperReturnMailHtml(record) {
  const first = escapeMail(record.firstName || whoOf(record))
  const price = escapeMail(Number(record.price).toFixed(2).replace('.', ','))
  const months = escapeMail(String(record.termMonths || 24))
  const when = escapeMail(dueOn(record))
  const plan = escapeMail(record.planName || 'Family & Friends Tarif')
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>der Anmeldelink hat bei dir nicht funktioniert. Deshalb liegt dein Vertrag als PDF bei.</p>
<p>Bitte füll die freien Felder aus, unterschreib den Vertrag und schick ihn unterschrieben zurück an <strong>info@mma-in-leipzig.de</strong>.</p>
<p>Deine Zahlungsart ist <strong>Banküberweisung</strong>. ${plan}: <strong>${price}€</strong> im Monat, ${months} Monate. Die erste Überweisung ist am ${when} fällig. Danach immer zum 1. des Monats.</p>
<p><strong>Konto</strong><br>
${accountLines()}</p>
<p>Angehängt: <strong>Mitgliedsvertrag.pdf</strong> und <strong>Widerrufsbelehrung.pdf</strong>.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendPaperReturnEmail(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email || record.payMethod !== 'transfer') return 'skipped'
  const [contract, withdrawal] = await Promise.all([
    buildContractPdf(record, { paper: true, returnCopy: true }),
    loadWithdrawalPdf(),
  ])
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: paperReturnMailSubject(),
    html: paperReturnMailHtml(record),
    attachments: [
      { name: 'Mitgliedsvertrag.pdf', content: Buffer.from(contract).toString('base64') },
      { name: 'Widerrufsbelehrung.pdf', content: Buffer.from(withdrawal).toString('base64') },
    ],
  })
}

export function guardianMandateMailSubject(record) {
  const who = whoOf(record)
  return `Elternvollmacht für ${who} · KONNI MMA GYM`
}

export function guardianMandateMailHtml(record) {
  const child = escapeMail(whoOf(record))
  const guardian = escapeMail(record.guardian?.name || 'Eltern / gesetzliche Vertretung')
  const plan = escapeMail(record.planName || record.plan || 'Mitgliedschaft')
  const price = escapeMail(Number(record.price).toFixed(2).replace('.', ','))
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hallo ${guardian},</p>
<p><strong>${child}</strong> hat sich online für eine Mitgliedschaft im KONNI MMA GYM angemeldet (${plan}, ${price}€ / Monat).</p>
<p>Unter 18 brauchen wir eine <strong>vollständig ausgefüllte und unterschriebene Elternvollmacht</strong> von Mutter, Vater oder Vormund. Ein Häkchen online reicht dafür nicht.</p>
<p><strong>Wichtig:</strong> Solange die unterschriebene Vollmacht nicht bei uns liegt, wird <strong>nichts abgebucht</strong> und es gibt noch kein Training.</p>
<p>Bitte:</p>
<ol>
<li>PDF <strong>Elternvollmacht.pdf</strong> vollständig ausfüllen und unterschreiben (bei gemeinsamem Sorgerecht beide, oder Zustimmung der anderen Person bestätigen).</li>
<li>Unterschrieben zurück an <strong>info@mma-in-leipzig.de</strong> (Scan oder klares Foto) — oder persönlich / per Post ins Studio.</li>
</ol>
<p>Angehängt: <strong>Elternvollmacht.pdf</strong>, <strong>Mitgliedsvertrag.pdf</strong> und <strong>Widerrufsbelehrung.pdf</strong>.</p>
<p>Sobald die Vollmacht da ist, schalten wir die Mitgliedschaft frei und die Zahlung startet erst dann.</p>
<p>Fragen? Einfach kurz an info@mma-in-leipzig.de.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export function guardianPendingMemberMailSubject() {
  return 'Anmeldung unter 18 · Elternvollmacht nötig · KONNI MMA GYM'
}

export function guardianPendingMemberMailHtml(record) {
  const first = escapeMail(record.firstName || whoOf(record))
  const guardianMail = escapeMail(record.guardian?.email || 'die Eltern')
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>deine Anmeldung ist bei uns. Weil du unter 18 bist, brauchen wir zuerst die <strong>unterschriebene Elternvollmacht</strong>.</p>
<p>Wir haben das Formular an <strong>${guardianMail}</strong> geschickt. Bitte die Eltern: ausfüllen, unterschreiben und an <strong>info@mma-in-leipzig.de</strong> zurücksenden.</p>
<p><strong>Bis dahin wird nichts abgebucht</strong> und Training startet erst nach Freigabe.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendGuardianMandateEmail(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  const to = record?.guardian?.email
  if (!apiKey || !to) return 'skipped'
  const [mandate, contract, withdrawal] = await Promise.all([
    buildGuardianMandatePdf(record),
    buildContractPdf(record, { paper: true, returnCopy: true }),
    loadWithdrawalPdf(),
  ])
  const attachments = [
    { name: 'Elternvollmacht.pdf', content: Buffer.from(mandate).toString('base64') },
    { name: 'Mitgliedsvertrag.pdf', content: Buffer.from(contract).toString('base64') },
    { name: 'Widerrufsbelehrung.pdf', content: Buffer.from(withdrawal).toString('base64') },
  ]
  const mailed = await sendSmtp(env, {
    to,
    name: record.guardian?.name || to,
    subject: guardianMandateMailSubject(record),
    html: guardianMandateMailHtml(record),
    attachments,
    cc: record.email && record.email !== to ? [{ email: record.email, name: whoOf(record) }] : [],
  })
  if (mailed === 'skipped') return mailed
  // Kurze Bestätigung an das Mitglied, falls andere Mail als die der Eltern.
  if (record.email && record.email !== to) {
    try {
      await sendSmtp(env, {
        to: record.email,
        name: whoOf(record),
        subject: guardianPendingMemberMailSubject(),
        html: guardianPendingMemberMailHtml(record),
      })
    } catch (error) {
      console.error('[mitglied] guardian member notice failed', error)
    }
  }
  return mailed
}

export function payLinkMailSubject() {
  return 'Dein Zahlungslink · KONNI MMA GYM'
}

export function payLinkMailHtml({ first = '', url = '', when = '', canTrainBefore = true } = {}) {
  const who = escapeMail(String(first ?? '').trim() || 'du')
  const hi = who === 'du' ? 'Hi,' : `Hi ${who},`
  const link = escapeMail(url)
  const due = escapeMail(when || '')
  const payLine = due
    ? `Erste Abbuchung am <strong>${due}</strong>. Vorher wird nichts abgebucht.`
    : 'Sobald die Karte hinterlegt ist, läuft die Abbuchung wie im Vertrag.'
  const trainLine = canTrainBefore
    ? '<p>Du kannst schon vorher bei uns mittrainieren – der Link ist nur für die Zahlung.</p>'
    : ''
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>${hi}</p>
<p>hier ist dein persönlicher Link, um Karte, Apple Pay oder SEPA einzurichten.</p>
<p>${payLine}</p>
${trainLine}
<p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Jetzt Zahlung einrichten</a></p>
<p>Der Link gilt 24 Stunden. Wenn er abgelaufen ist, schicken wir dir einen neuen.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

export async function sendPayLinkEmail(env, record, url, { billingStart = '' } = {}) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email || !url) return 'skipped'
  const dueIso = /^\d{4}-\d{2}-\d{2}$/.test(String(billingStart || ''))
    ? String(billingStart)
    : memberBillingStart(record)
  const today = new Date().toISOString().slice(0, 10)
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: payLinkMailSubject(),
    html: payLinkMailHtml({
      first: record.firstName,
      url,
      when: germanDate(dueIso),
      canTrainBefore: Boolean(dueIso && dueIso > today),
    }),
  })
}

const REMINDER_MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function periodMailLabel(period) {
  const month = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''))
  if (month) {
    const name = REMINDER_MONTHS[Number(month[2]) - 1]
    return name ? `${name} ${month[1]}` : period
  }
  return germanDate(period) || String(period ?? '')
}

export function reminderMailSubject(stage = 'reminder') {
  if (stage === 'mahnung2') return 'Zweite Erinnerung: offener Mitgliedsbeitrag · KONNI MMA GYM'
  if (stage === 'mahnung1') return 'Erinnerung an offenen Mitgliedsbeitrag · KONNI MMA GYM'
  return 'Offener Mitgliedsbeitrag · KONNI MMA GYM'
}

export function reminderMailHtml(record, { stage = 'reminder', periods = [], amount = 0 } = {}) {
  const first = escapeMail(record.firstName || whoOf(record))
  const total = escapeMail(Number(amount).toFixed(2).replace('.', ','))
  const list = (periods.length ? periods : ['—']).map((p) => escapeMail(periodMailLabel(p))).join(', ')
  const tone =
    stage === 'mahnung2'
      ? 'Trotz unserer Erinnerung ist der Beitrag noch offen. Bitte gleiche den Betrag jetzt aus.'
      : stage === 'mahnung1'
        ? 'Leider ist dein Mitgliedsbeitrag noch offen. Bitte gleiche ihn zeitnah aus.'
        : 'Bei dir ist noch ein Mitgliedsbeitrag offen.'
  const payHint =
    record.payMethod === 'transfer'
      ? `<p>Bitte überweise <strong>${total}€</strong> auf unser Konto:</p><p><strong>Konto</strong><br>${accountLines()}</p>`
      : `<p>Offen sind <strong>${total}€</strong>. Wenn die Karte hinterlegt ist, wird Stripe den Betrag nachziehen. Sonst melde dich kurz bei uns oder überweise:</p><p><strong>Konto</strong><br>${accountLines()}</p>`
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>${tone}</p>
<p><strong>Offen:</strong> ${list}<br><strong>Summe:</strong> ${total}€</p>
${payHint}
<p>Schon gezahlt? Dann ignoriere diese Mail — wir gleichen das ab.</p>
<p>Fragen? Schreib an info@mma-in-leipzig.de.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendReminderEmail(env, record, { stage = 'reminder', periods = [], amount = 0 } = {}) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email) return 'skipped'
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: reminderMailSubject(stage),
    html: reminderMailHtml(record, { stage, periods, amount }),
  })
}

export function paymentFailedMailSubject() {
  return 'Zahlung fehlgeschlagen · KONNI MMA GYM'
}

export function paymentFailedMailHtml(record, { period = '', amount = 0, retryUrl = '', retryKind = '' } = {}) {
  const first = escapeMail(record.firstName || whoOf(record))
  const when = escapeMail(periodMailLabel(period) || period || 'dieser Monat')
  const total = escapeMail(Number(amount || record.price || 0).toFixed(2).replace('.', ','))
  const link = String(retryUrl || '').trim()
  const ctaLabel = retryKind === 'portal' ? 'Karte prüfen / Zahlung nachholen' : 'Zahlung erneut einrichten'
  const cta = link
    ? `<p><a href="${escapeMail(link)}" style="display:inline-block;background:#c4121a;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">${ctaLabel}</a></p>
<p style="color:#666;font-size:13px">Der Link öffnet ${retryKind === 'portal' ? 'dein Stripe-Kundenportal' : 'die Zahlungsseite'}.</p>`
    : `<p>Bitte prüfe Karte oder Apple Pay und sorge für Deckung. Danach versucht Stripe es erneut.</p>`
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>die Abbuchung für <strong>${when}</strong> (<strong>${total}€</strong>) ist bei Stripe fehlgeschlagen.</p>
${cta}
<p>Alternativ kannst du auch überweisen:</p>
<p><strong>Konto</strong><br>${accountLines()}</p>
<p>Fragen? Schreib an info@mma-in-leipzig.de.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendPaymentFailedEmail(env, record, { period = '', amount = 0, retryUrl = '', retryKind = '' } = {}) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email) return 'skipped'
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: paymentFailedMailSubject(),
    html: paymentFailedMailHtml(record, { period, amount, retryUrl, retryKind }),
  })
}

export function cardUpdateMailSubject() {
  return 'Neue Karte hinterlegen · KONNI MMA GYM'
}

export function cardUpdateMailHtml(record, { url = '' } = {}) {
  const first = escapeMail(record.firstName || whoOf(record))
  const link = escapeMail(url)
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>Hi ${first},</p>
<p>du möchtest eine <strong>neue Karte</strong> für die Mitgliedschaft hinterlegen. Über den Link kannst du die Zahlungsart in Stripe aktualisieren. Danach zieht Stripe den offenen Beitrag nach.</p>
<p><a href="${link}" style="display:inline-block;background:#c4121a;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">Karte aktualisieren</a></p>
<p style="color:#666;font-size:13px">Der Link öffnet dein Stripe-Kundenportal. Bitte die neue Karte speichern und offene Zahlung bestätigen.</p>
<p>Fragen? Schreib an info@mma-in-leipzig.de.</p>
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM</p>
</div>`
}

export async function sendCardUpdateEmail(env, record, url) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !record?.email || !url) return 'skipped'
  return sendSmtp(env, {
    to: record.email,
    name: whoOf(record),
    subject: cardUpdateMailSubject(),
    html: cardUpdateMailHtml(record, { url }),
  })
}

export function broadcastMailSubject(subject) {
  return String(subject ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function broadcastMailHtml({ first = '', body = '' } = {}) {
  const who = escapeMail(String(first ?? '').trim() || 'du')
  const hi = who === 'du' ? 'Hi,' : `Hi ${who},`
  const text = String(body ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
  const content = text
    ? text
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeMail(block).replaceAll('\n', '<br>\n')}</p>`)
        .join('\n')
    : ''
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.55;max-width:640px">
<p>${hi}</p>
${content}
<p>Bis bald auf der Matte.<br>Konrad und Mehmet<br>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

export async function sendBroadcastEmail(env, { to, name = '', first = '', subject = '', body = '' } = {}) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey || !to) return 'skipped'
  return sendSmtp(env, {
    to,
    name: name || to,
    subject: broadcastMailSubject(subject),
    html: broadcastMailHtml({ first, body }),
  })
}

export async function sendMembershipEmails(env, record, { paper = false, creditorId = '', extra = [] } = {}) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return { member: 'skipped', gym: 'skipped' }

  const who = whoOf(record)
  const gymTo = gymInbox(env)
  const site = env.VITE_SITE_URL?.trim() || env.SITE_URL?.trim() || DEFAULT_SITE

  let attachments = []
  try {
    attachments = await membershipPdfAttachments(record, { paper, creditorId })
  } catch (error) {
    console.error('[mitglied] pdf failed', error)
  }
  if (extra.length) attachments = attachments.concat(extra)

  const gym = await sendSmtp(env, {
    to: gymTo,
    name: 'KONNI MMA GYM',
    subject: membershipMailSubject(record, { forGym: true }),
    html: membershipCopyHtml(record, { forGym: true, attached: attachments.length > 0, site }),
    attachments,
  })

  const member = await sendSmtp(env, {
    to: record.email,
    name: who,
    subject: membershipMailSubject(record),
    html: membershipCopyHtml(record, { forGym: false, attached: attachments.length > 0, site }),
    attachments,
  })

  return {
    member,
    gym,
    pdfs: attachments.map((file) => file.name),
    checkinCodeIncluded: Boolean(String(record?.checkinCode || '').trim()),
  }
}
