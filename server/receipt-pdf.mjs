import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { GYM_BANK, spacedIban } from './gym-bank.mjs'
import { germanDate } from './member-model.mjs'

const A4 = [595.28, 841.89]
const MARGIN = 54
const INK = rgb(0.07, 0.07, 0.07)
const MUTED = rgb(0.32, 0.32, 0.32)
const RULE = rgb(0.55, 0.08, 0.08)

function pdfSafe(value) {
  return String(value ?? '')
    .replaceAll('€', 'EUR')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
}

function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')} EUR` : String(value ?? '')
}

function periodLabel(period, kind) {
  if (kind === 'fee' || period === 'fee') return 'Aufnahmegebühr'
  if (kind === 'day') return `Day Pass ${germanDate(period) || period}`
  const match = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''))
  if (!match) return String(period ?? '')
  const months = [
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
  return `${months[Number(match[2]) - 1] || match[2]} ${match[1]}`
}

/**
 * Nächste Quittungsnummer: KONNI-YYYY-00001
 * Speichert invoiceSeq / invoiceYear im Store-Root.
 */
export function allocateInvoiceNumber(db, todayIso = new Date().toISOString().slice(0, 10)) {
  const y = String(todayIso).slice(0, 4)
  if (db.invoiceYear !== y) {
    db.invoiceYear = y
    db.invoiceSeq = 0
  }
  db.invoiceSeq = Number(db.invoiceSeq || 0) + 1
  return `KONNI-${y}-${String(db.invoiceSeq).padStart(5, '0')}`
}

export async function buildReceiptPdf(member, payment, { number, issuedAt = new Date().toISOString() } = {}) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage(A4)
  let y = A4[1] - MARGIN

  const draw = (text, { size = 10, weight = font, color = INK, gap = size * 1.4 } = {}) => {
    page.drawText(pdfSafe(text), { x: MARGIN, y: y - size, size, font: weight, color })
    y -= gap
  }

  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: A4[0] - MARGIN, y: y + 8 },
    thickness: 2,
    color: RULE,
  })
  draw('KONNI MMA GYM GbR', { size: 14, weight: bold, gap: 18 })
  draw('Wittenberger Straße 15, 04129 Leipzig', { size: 9, color: MUTED, gap: 12 })
  draw('Quittung / Zahlungsbeleg', { size: 16, weight: bold, gap: 22 })

  draw(`Belegnummer: ${number}`, { size: 11, weight: bold })
  draw(`Ausgestellt: ${germanDate(issuedAt.slice(0, 10)) || issuedAt.slice(0, 10)}`, { size: 10, color: MUTED })
  y -= 8

  draw('Empfänger', { size: 9, weight: bold, color: MUTED, gap: 12 })
  draw(`${member.firstName || ''} ${member.lastName || ''}`.trim(), { size: 11, weight: bold })
  if (member.street) draw(`${member.street}`, { size: 10 })
  if (member.zip || member.city) draw(`${member.zip || ''} ${member.city || ''}`.trim(), { size: 10 })
  if (member.email) draw(member.email, { size: 10, color: MUTED })
  y -= 10

  draw('Leistung', { size: 9, weight: bold, color: MUTED, gap: 12 })
  const label = periodLabel(payment.period, payment.kind)
  draw(`${member.planName || member.plan} · ${label}`, { size: 11, weight: bold })
  draw(`Betrag: ${money(payment.amount)}`, { size: 12, weight: bold, gap: 16 })
  draw(`Status: bezahlt`, { size: 10 })
  if (payment.paidAt) {
    draw(`Zahlungseingang: ${germanDate(String(payment.paidAt).slice(0, 10)) || String(payment.paidAt).slice(0, 10)}`, {
      size: 10,
    })
  }
  if (payment.source) draw(`Quelle: ${payment.source}`, { size: 9, color: MUTED })
  y -= 12

  draw('Zahlungsempfänger', { size: 9, weight: bold, color: MUTED, gap: 12 })
  draw(GYM_BANK.holder, { size: 10 })
  draw(`IBAN ${spacedIban(GYM_BANK.iban)}`, { size: 10 })
  draw(`BIC ${GYM_BANK.bic} · ${GYM_BANK.bank}`, { size: 9, color: MUTED })
  y -= 16

  draw('Diese Quittung bestätigt den Zahlungseingang. Keine Umsatzsteuer-ID vorhanden (GbR).', {
    size: 8,
    color: MUTED,
    gap: 12,
  })
  draw('KONNI MMA GYM GbR · info@mma-in-leipzig.de', { size: 8, color: MUTED })

  return doc.save()
}
