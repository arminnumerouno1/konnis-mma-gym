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

function siteOrigin(env) {
  const raw = String(env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
  return raw.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : raw
}

function money(record) {
  const price = Number(record.price)
  const formatted = Number.isFinite(price) ? price.toFixed(2).replace('.', ',') : String(record.price ?? '')
  const unit = record.termMonths ? '/ Monat' : record.plan === 'daypass' ? '/ Tag' : ''
  const term = record.termMonths ? `${record.termMonths} Monate Laufzeit` : record.visitDay ? `Day Pass ${record.visitDay}` : ''
  return { formatted, unit, term }
}

export function membershipCopyHtml(record, { forGym = false } = {}) {
  const who = `${record.firstName ?? ''} ${record.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
  const { formatted, unit, term } = money(record)
  const when = record.createdAt ? new Date(record.createdAt).toLocaleString('de-DE') : ''
  const early = record.consents?.earlyStart
    ? 'Vorzeitiger Leistungsbeginn ausdrücklich verlangt. Widerruf bleibt. Schon genutzte Tage können berechnet werden.'
    : 'Kein vorzeitiger Leistungsbeginn. 14 Tage Widerruf.'
  const guardian = record.guardian
    ? `<p><strong>Gesetzliche Vertretung</strong><br>${escapeMail(record.guardian.name)} · ${escapeMail(record.guardian.email)} · ${escapeMail(record.guardian.phone)}</p>`
    : ''
  const visit = record.visitDay ? `<p><strong>Day Pass</strong><br>${escapeMail(record.visitDay)}</p>` : ''
  const lead = forGym
    ? `<p>Neue Mitgliedschaft über die Website.</p>`
    : `<p>Hi ${escapeMail(record.firstName || who)},</p><p>dein Vertrag ist da. Unten die Kopie. Widerruf: 14 Tage.</p>`

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.45;max-width:640px">
${lead}
<h2 style="margin:24px 0 8px">Mitgliedsvertrag · ${escapeMail(record.planName || record.plan)}</h2>
<p>KONNI MMA GYM GbR, vertreten durch Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig</p>
<p><strong>Mitglied</strong><br>${escapeMail(who)}, geboren ${escapeMail(record.birthDate)}</p>
<p><strong>Anschrift</strong><br>${escapeMail(record.street)}, ${escapeMail(record.zip)} ${escapeMail(record.city)}</p>
<p><strong>Kontakt</strong><br>${escapeMail(record.email)} · ${escapeMail(record.phone)}</p>
<p><strong>Tarif</strong><br>${escapeMail(record.planName || record.plan)} · ${escapeMail(formatted)}€ ${escapeMail(unit)} · ${escapeMail(term)}</p>
<p><strong>Aufnahmegebühr</strong><br>0,00 €</p>
<p><strong>Vertragsschluss</strong><br>${escapeMail(when)}</p>
${visit}
${guardian}
<p><strong>Unterschrift</strong><br>${escapeMail(record.signature)}, ${escapeMail(record.place)}</p>
<p><strong>Leistungsbeginn in der Widerrufsfrist</strong><br>${escapeMail(early)}</p>
<p>Bei 12- und 24-Monats-Verträgen ziehen wir den Monatsbeitrag per SEPA-Lastschrift ein, in der Regel zum 1. des Monats. Mandat und Kontodaten klären wir vor dem ersten Einzug. Zahlungspflicht erst ab echter Eröffnung.</p>
<p>AGB Stand 27. September 2026 und Hausordnung wurden vor Abschluss zur Verfügung gestellt. Widerruf: 14 Tage.</p>
<p><a href="https://www.mma-in-leipzig.de/legal/widerrufsbelehrung.pdf">Widerrufsbelehrung als PDF</a></p>
<p>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>
</div>`
}

async function sendSmtp(env, { to, name, subject, html }) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return 'skipped'
  const sender = senderOf(env)
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
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

export async function sendMembershipEmails(env, record) {
  const apiKey = env.BREVO_API_KEY?.trim()
  if (!apiKey) return { member: 'skipped', gym: 'skipped' }

  const who = `${record.firstName ?? ''} ${record.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
  const gymTo = gymInbox(env)
  const origin = siteOrigin(env)
  void origin

  const gym = await sendSmtp(env, {
    to: gymTo,
    name: 'KONNI MMA GYM',
    subject: `Neue Mitgliedschaft: ${who} · ${record.planName || record.plan}`,
    html: membershipCopyHtml(record, { forGym: true }),
  })

  const member = await sendSmtp(env, {
    to: record.email,
    name: who,
    subject: `Dein Vertrag KONNI MMA GYM · ${record.planName || record.plan}`,
    html: membershipCopyHtml(record, { forGym: false }),
  })

  return { member, gym }
}
