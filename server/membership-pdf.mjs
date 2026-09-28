import { readFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

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

function wrapLines(font, text, size, maxWidth) {
  const blocks = pdfSafe(text).split('\n')
  const lines = []
  for (const block of blocks) {
    const words = block.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next
        continue
      }
      if (current) lines.push(current)
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word
        continue
      }
      let chunk = ''
      for (const ch of word) {
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

function earlyText(record) {
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
      'AGB Stand 27. September 2026 und Hausordnung sind Teil dieses Vertrags. Widerruf: 14 Tage.',
    ]
  }
  return [
    'Nutzung der Trainings und Flächen ab Beginn des regulären Betriebs zu den veröffentlichten Zeiten. Der Kursplan kann sich ändern, der wesentliche Charakter bleibt.',
    'Die Zahlungspflicht beginnt erst mit der tatsächlichen Eröffnung. Verschiebt sich die Eröffnung um mehr als acht Wochen über den geplanten Termin, kannst du vor Leistungsbeginn in Textform zurücktreten. Schon gezahlte Beträge werden erstattet.',
    'Die Monatsbeiträge werden per SEPA-Lastschrift eingezogen. Fälligkeit ist der 1. des Monats. Fällt der 1. auf ein Wochenende oder einen Feiertag, gilt der nächste Bankarbeitstag. Der erste angebrochene Monat wird anteilig berechnet. Aufnahmegebühr: 0,00 EUR, fällig mit Beginn der Zahlungspflicht.',
    'Du erteilst uns ein SEPA-Lastschriftmandat. Gläubiger-Identifikationsnummer und Mandatsreferenz teilen wir vor dem ersten Einzug mit. Das Konto muss am Abbuchungstag gedeckt sein. Rücklastschriftkosten, die du zu vertreten hast, können in tatsächlich entstandener Höhe berechnet werden. Mandat und Kontodaten klären wir vor dem ersten Einzug.',
    `Anfängliche Vertragsdauer: ${months} Monate ab Vertragsschluss. Beginnt das Training später, bleibt das vertragliche Ende gleich; vorher fallen keine Monatsbeiträge an. Ordentliche Kündigung mit einem Monat zum Ende dieser Erstlaufzeit. Ohne Kündigung läuft der Vertrag unbefristet weiter und ist dann jederzeit mit einem Monat kündbar. Kündigung in Textform an info@mma-in-leipzig.de. Außerordentliche Kündigung bleibt.`,
    'Hausordnung gilt. Eigenverantwortliche Gesundheitsprüfung. Haftung nach Gesetz. Minderjährige brauchen die Zustimmung aller erforderlichen gesetzlichen Vertreter. AGB Stand 27.09.2026 und Hausordnung sind Teil des Vertrags.',
  ]
}

export async function buildContractPdf(record) {
  const who = whoOf(record)
  const { formatted, unit, term } = moneyOf(record)
  const writer = new PdfWriter(`Mitgliedsvertrag ${who}`.trim(), 'Mitgliedsvertrag KONNI MMA GYM')
  await writer.init()
  writer.doc.setSubject(`${record.planName || record.plan} · ${who}`)

  writer.text('KONNI MMA GYM', { font: writer.bold, size: 16, leading: 20, color: RULE })
  writer.text('Mitgliedsvertrag', { font: writer.bold, size: 18, leading: 22 })
  writer.text(`${record.planName || record.plan} · Stand 27. September 2026`, {
    size: 10,
    color: MUTED,
    leading: 14,
  })
  writer.gap(10)

  writer.heading('1. Vertragsparteien')
  writer.para(
    'Anbieter: KONNI MMA GYM GbR, vertreten durch Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig. E-Mail: info@mma-in-leipzig.de. Telefon: +49 1522 1872354.',
  )
  writer.kv('Mitglied', `${who}, geboren ${formatIsoDate(record.birthDate)}`)
  writer.kv('Anschrift', `${record.street}, ${record.zip} ${record.city}`)
  writer.kv('Kontakt', [record.email, record.phone].filter(Boolean).join(' · '))
  if (record.guardian) {
    writer.kv(
      'Gesetzliche Vertretung',
      `${record.guardian.name} · ${record.guardian.email} · ${record.guardian.phone}`,
    )
  }

  writer.heading('2. Tarif, Beginn und Preis')
  writer.kv('Tarif', `${record.planName || record.plan}${term ? ` · ${term}` : ''}`)
  writer.kv('Beitrag', `${formatted}${unit ? ` ${unit}` : ''}`)
  writer.kv('Aufnahmegebühr', '0,00 EUR')
  writer.kv('Vertragsschluss', formatWhen(record.createdAt))
  if (record.visitDay) writer.kv('Day Pass', formatIsoDate(record.visitDay))
  if (record.inviteSlot) writer.kv('First 50', `Persönlicher Platz ${record.inviteSlot} von 50`)
  for (const block of contractParagraphs(record)) writer.para(block)

  writer.heading('3. Erklärungen')
  writer.para('Vor Abschluss zur Verfügung gestellt und bestätigt: AGB Stand 27. September 2026, Hausordnung, Widerrufsbelehrung inklusive Muster-Formular, Datenschutzerklärung.')
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
    writer.text(record.guardian.name, { font: writer.italic, size: 12, leading: 16 })
    writer.page.drawLine({
      start: { x: MARGIN, y: writer.y + 2 },
      end: { x: MARGIN + 220, y: writer.y + 2 },
      thickness: 0.7,
      color: INK,
    })
    writer.gap(6)
    writer.text('Zustimmung der gesetzlichen Vertretung', { size: 8, color: MUTED, leading: 11 })
  }

  writer.gap(14)
  writer.para(
    'Diese PDF-Kopie geht an das Mitglied und an KONNI MMA GYM. Die Widerrufsbelehrung liegt als weitere PDF bei. Widerruf: 14 Tage ab Vertragsschluss, formlos per E-Mail an info@mma-in-leipzig.de.',
  )

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

export async function membershipPdfAttachments(record) {
  const [contract, withdrawal] = await Promise.all([buildContractPdf(record), loadWithdrawalPdf()])
  return [
    { name: 'Mitgliedsvertrag.pdf', content: Buffer.from(contract).toString('base64') },
    { name: 'Widerrufsbelehrung.pdf', content: Buffer.from(withdrawal).toString('base64') },
  ]
}
