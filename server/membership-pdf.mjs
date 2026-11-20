import { readFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { GYM_BANK, spacedIban as spaceGymIban } from './gym-bank.mjs'
import { first50SeatLabel } from './invite.mjs'
import { germanDate, memberBillingStart } from './member-model.mjs'
import { trainingHasStarted } from './opening.mjs'

const A4 = [595.28, 841.89]
const MARGIN = 54
const BOTTOM = 48
const INK = rgb(0.07, 0.07, 0.07)
const MUTED = rgb(0.32, 0.32, 0.32)
const RULE = rgb(0.55, 0.08, 0.08)
const LINE = rgb(0.82, 0.82, 0.82)

function pdfSafe(value) {
  const mapped = String(value ?? '')
    .replaceAll('€', 'EUR')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('−', '-')
    .replaceAll('…', '...')
    .replaceAll('„', '"')
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replaceAll('‚', "'")
    .replaceAll('‘', "'")
    .replaceAll('’', "'")
    .replaceAll('´', "'")
    .replaceAll('•', '-')
    .replaceAll('\u00a0', ' ')
    .replaceAll('\u202f', ' ')
  let cleaned = ''
  for (const ch of mapped) {
    const code = ch.codePointAt(0) ?? 0
    const ok = code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)
    if (ok) cleaned += ch
  }
  return cleaned
}

/** Marker: hält Telefonnummern/IBANs beim Umbruch zusammen (wird wieder zu Leerzeichen). */
const WRAP_GLUE = '\u0001'

/** Telefon, IBAN u.ä. nicht mitten in der Nummer umbrechen. */
function keepTogetherTokens(text) {
  return String(text ?? '')
    .replace(/\+\d[\d\s/-]{5,}\d/g, (match) => match.replace(/ +/g, WRAP_GLUE))
    .replace(/\bDE\d{2}(?:\s*\d{4}){4,5}\b/gi, (match) => match.replace(/ +/g, WRAP_GLUE))
}

function unwrapGlue(value) {
  return String(value ?? '').replaceAll(WRAP_GLUE, ' ')
}

function wrapLines(font, text, size, maxWidth) {
  const blocks = keepTogetherTokens(pdfSafe(text)).split('\n')
  const lines = []
  for (const block of blocks) {
    // Nur normale Leerzeichen trennen — Glue in Telefon/IBAN bleibt im Token.
    const words = block.split(/ +/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of words) {
      const visibleWord = unwrapGlue(word)
      const next = current ? `${current} ${visibleWord}` : visibleWord
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next
        continue
      }
      if (current) lines.push(current)
      if (font.widthOfTextAtSize(visibleWord, size) <= maxWidth) {
        current = visibleWord
        continue
      }
      let chunk = ''
      for (const ch of visibleWord) {
        const trial = chunk + ch
        if (font.widthOfTextAtSize(trial, size) <= maxWidth) chunk = trial
        else {
          if (chunk) lines.push(chunk)
          chunk = ch
        }
      }
      current = chunk
    }
    if (current) lines.push(current)
  }
  return lines
}

function whoOf(record) {
  return `${record.firstName ?? ''} ${record.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
}

function moneyOf(record) {
  const price = Number(record.price)
  const formatted = Number.isFinite(price) ? `${price.toFixed(2).replace('.', ',')} EUR` : String(record.price ?? '')
  const unit = record.termMonths ? 'je Monat' : record.plan === 'daypass' ? 'je Tag' : ''
  const term = record.termMonths
    ? `${record.termMonths} Monate anfängliche Vertragsdauer`
    : record.visitDay
      ? `Day Pass am ${formatIsoDate(record.visitDay)}`
      : ''
  return { formatted, unit, term }
}

function formatIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (match) return `${match[3]}.${match[2]}.${match[1]}`
  return String(value ?? '')
}

function formatWhen(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
}

function chargeLabel(record) {
  return germanDate(memberBillingStart(record))
}

function earlyText(record) {
  const at = record.createdAt ? new Date(record.createdAt) : new Date()
  if (memberBillingStart(record) > '2026-11-01') {
    return `Der Vertrag beginnt am ${chargeLabel(record)}. Vorher fällt kein Mitgliedsbeitrag an. Der Widerruf von 14 Tagen ändert daran nichts.`
  }
  if (!trainingHasStarted(at)) {
    return 'Training beginnt mit dem vertraglichen Start. Vorher gibt es kein Training. Der Widerruf von 14 Tagen ändert daran nichts.'
  }
  return record.consents?.earlyStart
    ? 'Vorzeitiger Leistungsbeginn ausdrücklich verlangt. Das Widerrufsrecht bleibt. Für schon genutzte Tage kann ein angemessener Anteil berechnet werden.'
    : 'Kein vorzeitiger Leistungsbeginn. 14 Tage Widerruf ohne Training in der Frist.'
}

class PdfWriter {
  constructor(title, header = title) {
    this.title = title
    this.header = header
    this.doc = null
    this.page = null
    this.font = null
    this.bold = null
    this.italic = null
    this.y = 0
    this.width = A4[0] - MARGIN * 2
  }

  async init() {
    this.doc = await PDFDocument.create()
    this.font = await this.doc.embedFont(StandardFonts.Helvetica)
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold)
    this.italic = await this.doc.embedFont(StandardFonts.HelveticaOblique)
    this.doc.setTitle(this.title)
    this.doc.setAuthor('KONNI MMA GYM GbR')
    this.doc.setCreator('KONNI MMA GYM')
    this.doc.setLanguage('de-DE')
    this.newPage()
  }

  newPage() {
    const continuation = Boolean(this.page)
    this.page = this.doc.addPage(A4)
    this.page.drawLine({
      start: { x: MARGIN, y: A4[1] - 32 },
      end: { x: A4[0] - MARGIN, y: A4[1] - 32 },
      thickness: 2,
      color: RULE,
    })
    this.y = continuation ? A4[1] - 58 : A4[1] - MARGIN
    if (continuation) {
      this.text(`${this.header} · Fortsetzung`, { size: 8, color: MUTED, leading: 12 })
      this.gap(10)
    }
  }

  ensure(height) {
    if (this.y - height < BOTTOM + 10) this.newPage()
  }

  gap(amount = 8) {
    this.y -= amount
  }

  text(value, { font = this.font, size = 10, color = INK, leading = size * 1.35 } = {}) {
    const lines = wrapLines(font, value, size, this.width)
    for (const line of lines) {
      this.ensure(leading)
      if (line) {
        this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color })
      }
      this.y -= leading
    }
  }

  heading(value) {
    this.gap(12)
    this.ensure(22)
    this.text(value, { font: this.bold, size: 11, leading: 14, color: RULE })
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 2 },
      end: { x: MARGIN + 72, y: this.y + 2 },
      thickness: 0.6,
      color: LINE,
    })
    this.gap(6)
  }

  kv(label, value) {
    if (!value) return
    this.ensure(28)
    this.text(label, { font: this.bold, size: 8, color: MUTED, leading: 11 })
    this.text(value, { size: 10, leading: 13 })
    this.gap(4)
  }

  para(value) {
    this.text(value, { size: 9.5, leading: 13 })
    this.gap(6)
  }

  finish() {
    const pages = this.doc.getPages()
    const mark = pdfSafe('KONNI MMA GYM GbR · Wittenberger Straße 15 · 04129 Leipzig')
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: 38 },
        end: { x: A4[0] - MARGIN, y: 38 },
        thickness: 0.5,
        color: LINE,
      })
      page.drawText(mark, { x: MARGIN, y: 24, size: 7, font: this.font, color: MUTED })
      const label = pdfSafe(`Seite ${index + 1} / ${pages.length}`)
      const width = this.font.widthOfTextAtSize(label, 7)
      page.drawText(label, {
        x: A4[0] - MARGIN - width,
        y: 24,
        size: 7,
        font: this.font,
        color: MUTED,
      })
    })
  }

  async bytes() {
    this.finish()
    return this.doc.save()
  }
}

function contractParagraphs(record) {
  const months = record.termMonths
  const day = record.plan === 'daypass'
  if (day) {
    return [
      'Day Pass: einmaliger Zutritt zu den Trainingsflächen am gebuchten Tag, während der veröffentlichten Zeiten.',
      'Der Kursplan kann sich ändern, der wesentliche Charakter bleibt. Kein Anspruch auf eine bestimmte Einheit oder einen bestimmten Trainer.',
      'Hausordnung gilt. Eigenverantwortliche Gesundheitsprüfung. Haftung nach Gesetz.',
      'AGB Stand 22. Oktober 2026 und Hausordnung sind Teil dieses Vertrags. Widerruf: 14 Tage.',
    ]
  }
  const account = `Kontoinhaber ${GYM_BANK.holder}, IBAN ${spaceGymIban(GYM_BANK.iban)}, BIC ${GYM_BANK.bic}, ${GYM_BANK.bank}`
  const when = chargeLabel(record)
  const termLine =
    memberBillingStart(record) > '2026-11-01'
      ? `Anfängliche Vertragsdauer: ${months} Monate ab ${when}. Ordentliche Kündigung mit einem Monat zum Ende dieser Erstlaufzeit. Ohne Kündigung läuft der Vertrag unbefristet weiter und ist dann jederzeit mit einem Monat kündbar. Online-Kündigung unter https://mma-in-leipzig.de/kuendigen („Verträge hier kündigen“) oder in Textform an info@mma-in-leipzig.de. Außerordentliche Kündigung bleibt. Zusätzlich vorzeitig mit einem Monat zum Monatsende, wenn der Hauptwohnsitz in der Luftlinie mehr als 50 Kilometer vom Studio entfernt liegt. Nachweis durch amtliche Meldebescheinigung. Ein näherer Umzug begründet dieses Recht nicht.`
      : `Anfängliche Vertragsdauer: ${months} Monate ab Vertragsschluss. Beginnt das Training später, bleibt das vertragliche Ende gleich; vorher fallen keine Monatsbeiträge an. Ordentliche Kündigung mit einem Monat zum Ende dieser Erstlaufzeit. Ohne Kündigung läuft der Vertrag unbefristet weiter und ist dann jederzeit mit einem Monat kündbar. Online-Kündigung unter https://mma-in-leipzig.de/kuendigen („Verträge hier kündigen“) oder in Textform an info@mma-in-leipzig.de. Außerordentliche Kündigung bleibt. Zusätzlich vorzeitig mit einem Monat zum Monatsende, wenn der Hauptwohnsitz in der Luftlinie mehr als 50 Kilometer vom Studio entfernt liegt. Nachweis durch amtliche Meldebescheinigung. Ein näherer Umzug begründet dieses Recht nicht.`
  const access =
    record.plan === 'slowstart'
      ? 'Nutzung der Trainings und Flächen ab Beginn des regulären Betriebs zu den veröffentlichten Zeiten. Im Slow Start Tarif sind zwei Kurse beziehungsweise Einheiten pro Woche inklusive, etwa MMA, Boxen und BJJ. Zusätzliche Einheiten in derselben Woche sind nicht Bestandteil dieses Tarifs. Der Kursplan kann sich ändern, der wesentliche Charakter bleibt.'
      : 'Nutzung der Trainings und Flächen ab Beginn des regulären Betriebs zu den veröffentlichten Zeiten. Alle Kurse und Einheiten sind inklusive, etwa MMA, Boxen und BJJ. Die Nutzung ist nicht auf zwei Einheiten pro Woche begrenzt. Der Kursplan kann sich ändern, der wesentliche Charakter bleibt.'
  const feeEuro = `${Number(record.fee ?? 0).toFixed(2).replace('.', ',')} EUR`
  return [
    access,
    record.payMethod === 'transfer'
      ? `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du zahlst per Banküberweisung auf das Konto der ${GYM_BANK.holder}. ${account}. Die erste Überweisung ist am ${when} fällig. Aufnahmegebühr: ${feeEuro}.`
      : `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du zahlst mit Karte, Apple Pay oder SEPA-Lastschrift über Stripe. Die erste Abbuchung ist am ${when} fällig. Aufnahmegebühr: ${feeEuro}.`,
    record.payMethod === 'transfer'
      ? 'Ein Dauerauftrag auf dasselbe Konto deckt die folgenden Monate. Karte, Apple Pay oder SEPA-Lastschrift über Stripe ist die andere Zahlungsart. Kommt eine Überweisung nicht an, gelten die Regeln zum Zahlungsverzug.'
      : 'Die Zahlung läuft über Stripe (Karte, Apple Pay oder SEPA-Lastschrift). Das SEPA-Lastschriftmandat wird im Stripe-Checkout erteilt. Rücklastschriftkosten, die du zu vertreten hast, können in tatsächlich entstandener Höhe berechnet werden.',
    termLine,
    'Hausordnung gilt. Eigenverantwortliche Gesundheitsprüfung. Haftung nach Gesetz. Minderjährige brauchen die Zustimmung aller erforderlichen gesetzlichen Vertreter. AGB Stand 22.10.2026 und Hausordnung sind Teil des Vertrags.',
  ]
}

function signLine(writer, label, signed = '') {
  const name = String(signed ?? '').trim()
  if (name) {
    writer.gap(8)
    writer.ensure(36)
    writer.text(name, { font: writer.italic, size: 14, leading: 18 })
  } else {
    writer.gap(26)
    writer.ensure(30)
  }
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y + 2 },
    end: { x: MARGIN + 260, y: writer.y + 2 },
    thickness: 0.7,
    color: INK,
  })
  writer.gap(6)
  writer.text(label, { size: 8, color: MUTED, leading: 11 })
}

function spacedIban(iban) {
  return String(iban ?? '').replace(/(.{4})/g, '$1 ').trim()
}

export async function buildContractPdf(record, { paper = false, creditorId = '', returnCopy = false } = {}) {
  if (paper) return buildPaperContractPdf(record, creditorId, { returnCopy })
  const who = whoOf(record)
  const { formatted, unit, term } = moneyOf(record)
  const writer = new PdfWriter(`Mitgliedsvertrag ${who}`.trim(), 'Mitgliedsvertrag KONNI MMA GYM')
  await writer.init()
  writer.doc.setSubject(`${record.planName || record.plan} · ${who}`)

  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Mitgliedsvertrag', { font: writer.bold, size: 18, leading: 22 })
  writer.text(`${record.planName || record.plan} · Stand 22. Oktober 2026`, {
    size: 10,
    color: MUTED,
    leading: 14,
  })
  writer.gap(10)

  writer.heading('1. Vertragsparteien')
  writer.para(
    'Anbieter: KONNI MMA GYM GbR, vertreten durch Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig.',
  )
  writer.kv('E-Mail Studio', 'info@mma-in-leipzig.de')
  writer.kv('Telefon Studio', '+49 1522 1872354')
  writer.kv('Mitglied', `${who}, geboren ${formatIsoDate(record.birthDate)}`)
  writer.kv('Anschrift', `${record.street}, ${record.zip} ${record.city}`)
  writer.kv('E-Mail', record.email || '')
  writer.kv('Telefon', record.phone || '')
  if (record.guardian) {
    writer.kv('Gesetzliche Vertretung', record.guardian.name)
    if (record.guardian.email) writer.kv('E-Mail Vertretung', record.guardian.email)
    if (record.guardian.phone) writer.kv('Telefon Vertretung', record.guardian.phone)
  }

  writer.heading('2. Tarif, Beginn und Preis')
  writer.kv('Tarif', `${record.planName || record.plan}${term ? ` · ${term}` : ''}`)
  writer.kv('Beitrag', `${formatted}${unit ? ` ${unit}` : ''}`)
  if (record.plan !== 'daypass') {
    writer.kv('Aufnahmegebühr', `${Number(record.fee ?? 0).toFixed(2).replace('.', ',')} EUR`)
  }
  writer.kv('Vertragsschluss', formatWhen(record.createdAt))
  if (record.visitDay) writer.kv('Day Pass', formatIsoDate(record.visitDay))
  const seat = first50SeatLabel(record.inviteSlot)
  if (seat) writer.kv('Family & Friends Tarif', `Persönlicher ${seat}`)
  for (const block of contractParagraphs(record)) writer.para(block)

  writer.heading('3. Erklärungen')
  writer.para('Vor Abschluss zur Verfügung gestellt und bestätigt: AGB Stand 22. Oktober 2026, Hausordnung, Widerrufsbelehrung inklusive Muster-Formular, Datenschutzerklärung.')
  writer.para('Elektronische Unterschrift: Der Text gilt wie auf Papier.')
  writer.para(earlyText(record))
  if (record.consents?.photos) {
    writer.para('Zusätzlich: Einwilligung zu Foto- und Videoaufnahmen für die Kanäle des Gyms. Widerruf jederzeit mit Wirkung für die Zukunft.')
  }
  if (record.consents?.newsletter) {
    writer.para('Zusätzlich: Infos zu Start und Kursplan per E-Mail. Abmeldung in jeder Mail.')
  }

  writer.heading('4. Unterschrift')
  writer.para(`Ort, Datum: ${record.place || 'Leipzig'}, ${formatWhen(record.createdAt) || formatIsoDate(record.createdAt)}`)
  writer.gap(8)
  writer.ensure(36)
  writer.text(record.signature || who, { font: writer.italic, size: 14, leading: 18 })
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y + 2 },
    end: { x: MARGIN + 220, y: writer.y + 2 },
    thickness: 0.7,
    color: INK,
  })
  writer.gap(6)
  writer.text('Elektronische Unterschrift des Mitglieds', { size: 8, color: MUTED, leading: 11 })
  if (record.guardian) {
    writer.gap(10)
    writer.text(record.guardian.signature || record.guardian.name, { font: writer.italic, size: 12, leading: 16 })
    writer.page.drawLine({
      start: { x: MARGIN, y: writer.y + 2 },
      end: { x: MARGIN + 220, y: writer.y + 2 },
      thickness: 0.7,
      color: INK,
    })
    writer.gap(6)
    writer.text('Zustimmung der gesetzlichen Vertretung', { size: 8, color: MUTED, leading: 11 })
  }
  if (record.gymSignature) {
    writer.gap(10)
    writer.text(record.gymSignature, { font: writer.italic, size: 12, leading: 16 })
    writer.page.drawLine({
      start: { x: MARGIN, y: writer.y + 2 },
      end: { x: MARGIN + 220, y: writer.y + 2 },
      thickness: 0.7,
      color: INK,
    })
    writer.gap(6)
    writer.text('Für KONNI MMA GYM GbR', { size: 8, color: MUTED, leading: 11 })
  }

  writer.gap(14)
  writer.para(
    'Diese PDF-Kopie geht an das Mitglied und an KONNI MMA GYM. Die Widerrufsbelehrung liegt als weitere PDF bei. Widerruf: 14 Tage ab Vertragsschluss, formlos per E-Mail an info@mma-in-leipzig.de.',
  )

  return writer.bytes()
}

async function buildPaperContractPdf(record, creditorId, { returnCopy = false } = {}) {
  const who = whoOf(record)
  const { formatted, unit, term } = moneyOf(record)
  const writer = new PdfWriter(`Mitgliedsvertrag ${who}`.trim(), 'Mitgliedsvertrag KONNI MMA GYM')
  await writer.init()
  writer.doc.setSubject(`${record.planName || record.plan} · ${who}`)
  const blank = '______________________________'
  const bank = record.bank ?? {}
  const birth = formatIsoDate(record.birthDate)

  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Mitgliedsvertrag', { font: writer.bold, size: 18, leading: 22 })
  writer.text(`${record.planName || record.plan} · Abschluss vor Ort · Stand 22. Oktober 2026`, {
    size: 10,
    color: MUTED,
    leading: 14,
  })
  writer.gap(10)
  if (returnCopy) {
    writer.para('Bitte die freien Felder ausfüllen, unterschreiben und den Vertrag an info@mma-in-leipzig.de zurücksenden.')
  }

  writer.heading('1. Vertragsparteien')
  writer.para(
    'Anbieter: KONNI MMA GYM GbR, vertreten durch Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig.',
  )
  writer.kv('E-Mail Studio', 'info@mma-in-leipzig.de')
  writer.kv('Telefon Studio', '+49 1522 1872354')
  writer.kv('Mitglied', birth ? `${who}, geboren ${birth}` : `${who || blank}, geboren ${blank}`)
  writer.kv('Anschrift', [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || blank)
  writer.kv('E-Mail', record.email || blank)
  writer.kv('Telefon', record.phone || blank)
  if (record.guardian) {
    writer.kv(
      'Gesetzliche Vertretung',
      [record.guardian.name, record.guardian.relation].filter(Boolean).join(' · ') || blank,
    )
    writer.kv('E-Mail Vertretung', record.guardian.email || blank)
    writer.kv('Telefon Vertretung', record.guardian.phone || blank)
  }

  writer.heading('2. Tarif, Beginn und Preis')
  writer.kv('Tarif', `${record.planName || record.plan}${term ? ` · ${term}` : ''}`)
  writer.kv('Beitrag', `${formatted}${unit ? ` ${unit}` : ''}`)
  if (record.plan !== 'daypass') {
    writer.kv('Aufnahmegebühr', `${Number(record.fee ?? 0).toFixed(2).replace('.', ',')} EUR`)
  }
  writer.kv('Beginn', formatIsoDate(record.startDate))
  const paperSeat = first50SeatLabel(record.inviteSlot)
  if (paperSeat) writer.kv('Family & Friends Tarif', `Persönlicher ${paperSeat}`)
  for (const block of contractParagraphs(record)) writer.para(block)

  writer.heading('3. Erklärungen')
  writer.para('AGB Stand 22. Oktober 2026, Hausordnung und Datenschutzerklärung habe ich erhalten und gelesen.')
  writer.para('[  ] Freiwillig: Ich willige in Foto- und Videoaufnahmen für die Kanäle des Gyms ein. Widerruf jederzeit mit Wirkung für die Zukunft.')

  const captured = Boolean(String(record.gymSignature ?? '').trim())
  writer.heading('4. Unterschrift')
  writer.para(`Ort, Datum: ${record.place || 'Leipzig'}, ${captured ? formatWhen(record.createdAt) || formatIsoDate(record.createdAt) : blank}`)
  signLine(writer, `Unterschrift Mitglied (${who})`, captured ? record.signature : '')
  if (record.minor) {
    writer.gap(4)
    writer.para(
      'Das Mitglied ist unter 18. Der Vertrag wird erst wirksam, wenn die gesetzliche Vertretung die Elternvollmacht vollständig ausgefüllt und unterschrieben zurückgesandt hat. Bis dahin findet kein Training statt und es wird nichts abgebucht. Bei gemeinsamem Sorgerecht unterschreiben beide, oder die unterschreibende Person bestätigt die Zustimmung der anderen.',
    )
    signLine(
      writer,
      `Unterschrift gesetzliche Vertretung${record.guardian?.name ? ` (${record.guardian.name})` : ''}`,
      captured ? record.guardian?.signature : '',
    )
    signLine(writer, 'Unterschrift zweite sorgeberechtigte Person (falls gemeinsames Sorgerecht)', captured ? record.secondGuardianSignature : '')
  }
  signLine(writer, 'Für KONNI MMA GYM GbR', captured ? record.gymSignature : '')

  if (record.plan !== 'daypass' && record.payMethod === 'transfer') {
    writer.heading('5. Zahlungsart Banküberweisung')
    writer.para(
      'Das Mitglied überweist den Beitrag selbst. SEPA-Lastschrift über Stripe ist die andere Zahlungsart und wird mit diesem Vertrag nicht erteilt.',
    )
    writer.kv('Kontoinhaber', GYM_BANK.holder)
    writer.kv('IBAN', spaceGymIban(GYM_BANK.iban))
    writer.kv('BIC', GYM_BANK.bic)
    writer.kv('Bank', GYM_BANK.bank)
    writer.para(`Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am ${chargeLabel(record)} fällig.`)
  } else if (record.plan !== 'daypass') {
    writer.heading('5. Zahlung über Stripe')
    writer.para(
      'Du zahlst mit Karte, Apple Pay oder SEPA-Lastschrift über Stripe. Bei SEPA-Lastschrift erteilst du das Mandat im Stripe-Checkout; ein separates Papier-Mandat ist nicht erforderlich.',
    )
    writer.kv('Zahlungsempfänger', 'KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig')
    writer.para(`Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Abbuchung ist am ${chargeLabel(record)} fällig.`)
    if (bank.iban || bank.mandateSignature) {
      writer.gap(6)
      writer.para(
        'Zusätzliche Kontodaten (falls vor Ort erfasst). Das verbindliche SEPA-Mandat entsteht bei Stripe, sofern Lastschrift gewählt wird.',
      )
      writer.kv('Gläubiger-Identifikationsnummer', creditorId || 'wird vor dem ersten Einzug mitgeteilt')
      writer.kv('Mandatsreferenz', bank.mandateRef || blank)
      writer.kv('Kontoinhaber/in', bank.holder || blank)
      writer.kv('IBAN', bank.iban ? spacedIban(bank.iban) : blank)
      writer.kv('BIC', bank.bic || (bank.iban ? 'nicht nötig bei deutscher IBAN' : blank))
      if (bank.mandateSignature) {
        writer.para(
          'Ich ermächtige die KONNI MMA GYM GbR, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die von der KONNI MMA GYM GbR auf mein Konto gezogenen Lastschriften einzulösen. Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.',
        )
        writer.para(`Ort, Datum: ${record.place || 'Leipzig'}, ${captured ? formatWhen(record.createdAt) || formatIsoDate(record.createdAt) : blank}`)
        signLine(writer, `Unterschrift Kontoinhaber/in${bank.holder ? ` (${bank.holder})` : ''}`, captured ? bank.mandateSignature : '')
      }
    }
  }

  return writer.bytes()
}

export async function buildWithdrawalPdf() {
  const writer = new PdfWriter('Widerrufsbelehrung KONNI MMA GYM', 'Widerrufsbelehrung')
  await writer.init()
  writer.doc.setSubject('Widerrufsbelehrung und Muster-Widerrufsformular')

  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Widerrufsbelehrung', { font: writer.bold, size: 18, leading: 22 })
  writer.text('Stand: 27. September 2026', { size: 10, color: MUTED, leading: 14 })
  writer.gap(8)

  writer.para('KONNI MMA GYM GbR, vertreten durch die Gesellschafter Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig, E-Mail: info@mma-in-leipzig.de.')

  writer.heading('Widerrufsrecht')
  writer.para('Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.')
  writer.para('Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.')
  writer.para('Um Ihr Widerrufsrecht auszuüben, müssen Sie uns')
  writer.para('KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig, E-Mail: info@mma-in-leipzig.de')
  writer.para(
    'mittels einer eindeutigen Erklärung, zum Beispiel durch einen mit der Post versandten Brief oder eine E-Mail, über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.',
  )
  writer.para(
    'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
  )

  writer.heading('Folgen des Widerrufs')
  writer.para(
    'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.',
  )
  writer.para(
    'Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Zahlung eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart. In keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
  )
  writer.para(
    'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen. Dieser entspricht dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns über die Ausübung des Widerrufsrechts unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen.',
  )

  writer.heading('Erklärung zum Leistungsbeginn während der Widerrufsfrist')
  writer.para(
    'Diese Erklärung ist erforderlich, wenn Sie bereits vor Ablauf der 14-tägigen Widerrufsfrist mit dem Training beziehungsweise der Nutzung der vertraglich vereinbarten Leistungen beginnen möchten.',
  )
  writer.para(
    'Ich verlange ausdrücklich, dass die KONNI MMA GYM GbR bereits vor Ablauf der gesetzlichen Widerrufsfrist mit der Erbringung der vertraglich vereinbarten Dienstleistungen beginnt.',
  )
  writer.para(
    'Mir ist bekannt, dass ich bei Ausübung meines Widerrufsrechts für die bis zum Widerruf bereits erbrachten Dienstleistungen einen angemessenen Betrag zu zahlen habe, sofern die gesetzlichen Voraussetzungen für den Wertersatz vorliegen.',
  )

  writer.heading('Muster-Widerrufsformular')
  writer.para('Wenn Sie den Vertrag widerrufen wollen, können Sie dieses Formular ausfüllen und zurücksenden.')
  writer.para('An: KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig, E-Mail: info@mma-in-leipzig.de')
  writer.para('Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung:')
  writer.para('Mitgliedschaft / Dienstleistung: ______________________________')
  writer.para('Vertrag abgeschlossen am: ______________________________')
  writer.para('Name des/der Verbraucher(s): ______________________________')
  writer.para('Anschrift des/der Verbraucher(s): ______________________________')
  writer.para('Datum: ______________________________')
  writer.para('Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________________________')
  writer.para('(*) Unzutreffendes streichen.')

  return writer.bytes()
}

function loadOfficialWithdrawal() {
  try {
    return readFileSync(new URL('./assets/widerrufsbelehrung.pdf', import.meta.url))
  } catch {
    return null
  }
}

export async function loadWithdrawalPdf() {
  return (await loadOfficialWithdrawal()) || (await buildWithdrawalPdf())
}

export async function buildTransferNoticePdf(record) {
  const who = whoOf(record)
  const price = Number(record.price)
  const monthLabel = Number.isFinite(price) ? `${price.toFixed(2).replace('.', ',')} EUR je Monat` : ''
  const t = record.transfer
  const writer = new PdfWriter(`Banküberweisung ${who}`.trim(), 'Zahlungsart Banküberweisung')
  await writer.init()
  writer.doc.setSubject(`Banküberweisung · ${who}`)
  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Zahlungsart: Banküberweisung', { font: writer.bold, size: 18, leading: 22 })
  writer.gap(8)
  writer.para(
    `Für ${who || 'dieses Mitglied'} wurde Banküberweisung als Zahlung genommen. SEPA-Lastschrift kommt später und ist hier nicht erteilt. Es gibt keinen Einzug über Stripe.`,
  )
  writer.heading('Fälligkeit')
  if (t?.prorated) {
    const share = ((Number(t.prorateAmount) || 0) / 100).toFixed(2).replace('.', ',')
    const total = ((Number(t.amount) || 0) / 100).toFixed(2).replace('.', ',')
    const next = germanDate(t.nextFullDue) || chargeLabel(record)
    writer.para(
      `Das ist ein anteiliger Beitrag für den Rest des laufenden Monats — nicht der volle Monatsbeitrag. Jetzt überweisen: ${total} EUR (davon anteiliger Beitrag ${share} EUR). Ab dem ${next} dann der volle Monatsbeitrag.`,
    )
    writer.kv('Jetzt überweisen (anteilig)', `${total} EUR`)
    writer.kv('Anteiliger Beitrag', `${share} EUR`)
    if (Number(t.feeAmount) > 0) {
      writer.kv('Aufnahmegebühr', `${(Number(t.feeAmount) / 100).toFixed(2).replace('.', ',')} EUR`)
    }
    if (monthLabel) writer.kv('Voller Monatsbeitrag ab dem nächsten 1.', monthLabel)
  } else {
    writer.para(
      `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am ${t?.firstDueDate ? germanDate(t.firstDueDate) : chargeLabel(record)} fällig.`,
    )
    if (t?.amount != null) {
      writer.kv('Erste Überweisung', `${(Number(t.amount) / 100).toFixed(2).replace('.', ',')} EUR`)
    }
    if (monthLabel) writer.kv('Monatsbeitrag', monthLabel)
  }
  if (t?.purpose) writer.kv('Verwendungszweck', t.purpose)
  writer.kv('Mitglied', who)
  writer.kv('Anmeldung', formatWhen(record.createdAt))
  writer.heading('Konto der KONNI MMA GYM GbR')
  writer.kv('Kontoinhaber', t?.holder || GYM_BANK.holder)
  writer.kv('IBAN', spaceGymIban(t?.iban || GYM_BANK.iban))
  writer.kv('BIC', t?.bic || GYM_BANK.bic)
  writer.kv('Bank', t?.bank || GYM_BANK.bank)
  writer.para(
    'Das Mitglied überweist den Beitrag selbst auf dieses Konto. Ein Dauerauftrag auf dasselbe Konto deckt die folgenden Monate mit dem vollen Monatsbeitrag. Sobald eine Überweisung da ist, wird der Monat in der Verwaltung als gezahlt markiert.',
  )
  return writer.bytes()
}

/** Elternvollmacht: nass zu unterschreiben und an das Studio zurückzusenden. */
export async function buildGuardianMandatePdf(record) {
  const who = whoOf(record)
  const { formatted, unit, term } = moneyOf(record)
  const blank = '____________________'
  const writer = new PdfWriter(`Elternvollmacht ${who}`.trim(), 'Elternvollmacht KONNI MMA GYM')
  await writer.init()
  writer.doc.setSubject(`Elternvollmacht · ${who}`)

  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Elternvollmacht / Zustimmung der gesetzlichen Vertretung', {
    font: writer.bold,
    size: 14,
    leading: 18,
  })
  writer.text('Bitte vollständig ausfüllen, unterschreiben und zurücksenden', {
    size: 10,
    color: MUTED,
    leading: 13,
  })
  writer.gap(6)

  writer.kv('Studio', 'KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig')
  writer.kv('E-Mail', 'info@mma-in-leipzig.de')
  writer.kv('Telefon', '+49 1522 1872354')
  writer.para(
    'Ohne diese unterschriebene Vollmacht kommt kein wirksamer Mitgliedsvertrag mit einem Minderjährigen zustande. Bis die vollständige, unterschriebene Vollmacht beim Studio vorliegt, findet kein Training statt und es wird nichts abgebucht (weder Karte/Apple Pay noch SEPA-Lastschrift über Stripe noch Überweisungspflicht).',
  )

  writer.heading('1. Minderjähriges Mitglied')
  writer.kv('Name', who)
  writer.kv('Geburtsdatum', formatIsoDate(record.birthDate))
  writer.kv('Anschrift', `${record.street || ''}, ${record.zip || ''} ${record.city || ''}`.replace(/^, /, ''))
  writer.kv('E-Mail Mitglied', record.email || blank)
  writer.kv('Telefon Mitglied', record.phone || blank)

  writer.heading('2. Tarif (Angemeldet)')
  writer.kv('Tarif', `${record.planName || record.plan}${term ? ` · ${term}` : ''}`)
  writer.kv('Beitrag', `${formatted}${unit ? ` ${unit}` : ''}`)
  if (record.plan !== 'daypass') {
    writer.kv('Aufnahmegebühr', `${Number(record.fee ?? 0).toFixed(2).replace('.', ',')} EUR`)
  }
  const byTransfer = record.payMethod === 'transfer'
  writer.kv('Gewünschte Zahlungsart', byTransfer ? 'Banküberweisung' : 'Karte / Apple Pay / SEPA-Lastschrift (Stripe)')
  writer.kv('Beginn', formatIsoDate(record.startDate) || 'laut Vertrag')
  if (byTransfer) {
    writer.gap(4)
    writer.para(
      'Zahlung per Banküberweisung: Nach Freigabe der Vollmacht überweist das Mitglied bzw. die gesetzliche Vertretung den Beitrag selbst auf das Studio-Konto. Es gibt keinen Karteneinzug und keine Lastschrift. Bis zur Freigabe muss nichts überwiesen werden.',
    )
    writer.kv('Kontoinhaber', GYM_BANK.holder)
    writer.kv('IBAN', spaceGymIban(GYM_BANK.iban))
    writer.kv('BIC', GYM_BANK.bic)
    writer.kv('Bank', GYM_BANK.bank)
    writer.kv('Erste Überweisung fällig', chargeLabel(record))
    if (record.transfer?.purpose) writer.kv('Verwendungszweck', record.transfer.purpose)
  } else {
    writer.para(
      'Zahlung mit Karte, Apple Pay oder SEPA-Lastschrift über Stripe: Nach Freigabe der Vollmacht schickt das Studio einen Stripe-Zahlungslink. Bis dahin wird nichts abgebucht.',
    )
  }

  writer.heading('3. Gesetzliche Vertretung')
  writer.kv('Name', record.guardian?.name || blank)
  writer.kv('Beziehung', record.guardian?.relation || 'Mutter / Vater / Vormund')
  writer.kv('E-Mail', record.guardian?.email || blank)
  writer.kv('Telefon', record.guardian?.phone || blank)
  writer.para('Falls Angaben fehlen oder falsch sind, bitte hier korrigieren:')
  writer.para(blank + blank)

  writer.heading('4. Erklärungen der gesetzlichen Vertretung')
  writer.para(
    'Ich / wir bin / sind alleinige oder gemeinsam sorgeberechtigte gesetzliche Vertretung des oben genannten Minderjährigen und zur Vertretung berechtigt.',
  )
  writer.para(
    'Ich / wir stimme / stimmen dem Mitgliedsvertrag mit der KONNI MMA GYM GbR (inkl. AGB Stand 22. Oktober 2026, Hausordnung, Datenschutzerklärung und Widerrufsbelehrung) für das minderjährige Mitglied zu.',
  )
  if (byTransfer) {
    writer.para(
      'Ich / wir bestätige / bestätigen die Zahlungsart Banküberweisung und werde / werden nach Vorliegen dieser unterschriebenen Vollmacht den Mitgliedsbeitrag und ggf. die Aufnahmegebühr auf das oben genannte Konto der KONNI MMA GYM GbR überweisen. Bis dahin muss nichts überwiesen werden. SEPA-Lastschrift und Karteneinzug sind mit dieser Anmeldung nicht erteilt.',
    )
  } else {
    writer.para(
      'Ich / wir ermächtige / ermächtigen die KONNI MMA GYM GbR, nach Vorliegen dieser unterschriebenen Vollmacht den Mitgliedsbeitrag und ggf. die Aufnahmegebühr per Karte, Apple Pay oder SEPA-Lastschrift über Stripe einzuziehen. Bis dahin darf nichts abgebucht werden.',
    )
  }
  writer.para(
    'Ich / wir bestätige / bestätigen, dass das minderjährige Mitglied gesundheitlich für das Training geeignet ist und die Hausordnung eingehalten wird. AGB, Hausordnung und Widerrufsbelehrung habe ich / haben wir erhalten bzw. liegen bei.',
  )
  writer.para(
    'Bei gemeinsamem Sorgerecht: [  ] beide unterschreiben unten, oder [  ] die unterschreibende Person bestätigt die Zustimmung der anderen sorgeberechtigten Person.',
  )

  writer.heading('5. Unterschriften')
  writer.para(`Ort, Datum: ${blank}`)
  signLine(writer, 'Unterschrift gesetzliche Vertretung', '')
  signLine(writer, 'Unterschrift zweite sorgeberechtigte Person (falls gemeinsames Sorgerecht)', '')
  writer.gap(4)
  writer.para(
    'Rücksendung: vollständig ausgefüllt und unterschrieben per E-Mail an info@mma-in-leipzig.de (Scan/Foto) oder per Post / persönlich im Studio. Erst danach wird die Mitgliedschaft freigeschaltet und die Zahlung freigegeben.',
  )

  return writer.bytes()
}

export async function membershipPdfAttachments(record, { paper = false, creditorId = '' } = {}) {
  const [contract, withdrawal] = await Promise.all([
    buildContractPdf(record, { paper, creditorId }),
    loadWithdrawalPdf(),
  ])
  return [
    { name: 'Mitgliedsvertrag.pdf', content: Buffer.from(contract).toString('base64') },
    { name: 'Widerrufsbelehrung.pdf', content: Buffer.from(withdrawal).toString('base64') },
  ]
}

/** Kurzes Eltern-Einverständnis nur fürs Probetraining — ohne Beitrag/IBAN. */
export async function buildTrialGuardianConsentPdf(entry) {
  const who = String(entry?.name ?? '').trim() || 'Teilnehmer/in'
  const blank = '____________________'
  const slot = entry?.slot?.label || trialSlotLabel(entry?.slot || {})
  const writer = new PdfWriter(`Probetraining Einverstaendnis ${who}`.trim(), 'Probetraining Einverstaendnis')
  await writer.init()
  writer.doc.setSubject(`Probetraining-Einverständnis · ${who}`)

  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Einverständnis Probetraining', { font: writer.bold, size: 14, leading: 18 })
  writer.text('Für Minderjährige · bitte unterschreiben', { size: 10, color: MUTED, leading: 13 })
  writer.gap(6)

  writer.kv('Studio', 'KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig')
  writer.kv('E-Mail', 'info@mma-in-leipzig.de')
  writer.kv('Telefon', '+49 1522 1872354')
  writer.para(
    'Ohne dieses unterschriebene Einverständnis findet kein Probetraining mit einem Minderjährigen statt. Unterschreiben geht per Scan/Foto zurück an info@mma-in-leipzig.de oder vor Ort im Studio.',
  )

  writer.heading('1. Minderjährige Person')
  writer.kv('Name', who)
  writer.kv('Geburtsdatum', formatIsoDate(entry?.birthDate) || blank)
  writer.kv('Kontakt', [entry?.email, entry?.phone].filter(Boolean).join(' · ') || blank)

  writer.heading('2. Probetraining')
  writer.kv('Termin / Kurs', slot || blank)
  writer.para(
    'Das Probetraining ist einmalig und unverbindlich. Es entsteht kein Mitgliedsvertrag und keine Zahlungspflicht durch dieses Einverständnis.',
  )

  writer.heading('3. Gesetzliche Vertretung')
  writer.kv('Name', entry?.guardian?.name || blank)
  writer.kv('Beziehung', entry?.guardian?.relation || 'Mutter / Vater / Vormund')
  writer.kv('E-Mail', entry?.guardian?.email || blank)
  writer.kv('Telefon', entry?.guardian?.phone || blank)

  writer.heading('4. Erklärungen')
  writer.para(
    'Ich / wir bin / sind alleinige oder gemeinsam sorgeberechtigte gesetzliche Vertretung und zur Vertretung berechtigt.',
  )
  writer.para(
    'Ich / wir stimme / stimmen dem einmaligen Probetraining im KONNI MMA GYM zu. Hausordnung und eigenverantwortliche Gesundheitsprüfung gelten. Das minderjährige Mitglied ist gesundheitlich für das Training geeignet.',
  )
  writer.para(
    'Bei gemeinsamem Sorgerecht: [  ] beide unterschreiben unten, oder [  ] die unterschreibende Person bestätigt die Zustimmung der anderen sorgeberechtigten Person.',
  )

  writer.heading('5. Unterschriften')
  writer.para(`Ort, Datum: ${blank}`)
  signLine(writer, 'Unterschrift gesetzliche Vertretung', '')
  signLine(writer, 'Unterschrift zweite sorgeberechtigte Person (falls gemeinsames Sorgerecht)', '')
  writer.gap(4)
  writer.para(
    'Rücksendung per E-Mail an info@mma-in-leipzig.de (Scan/Foto) oder Unterschrift vor Ort im Studio. Erst danach ist das Probetraining freigegeben.',
  )

  return writer.bytes()
}

function trialSlotLabel(slot) {
  if (!slot) return ''
  if (slot.label) return String(slot.label)
  const parts = [slot.dayLabel, slot.time, slot.title].filter(Boolean)
  return parts.join(' · ')
}
