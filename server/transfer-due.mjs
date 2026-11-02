import { GYM_BANK } from './gym-bank.mjs'
import { germanDate, memberBillingStart } from './member-model.mjs'
import { berlinIsoDate } from './opening.mjs'

/** Tage im Kalendermonat von YYYY-MM-DD (Berlin-Kalender, lokal gerechnet). */
export function daysInMonth(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return 30
  const year = Number(match[1])
  const month = Number(match[2])
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Resttage inkl. Anmeldetag bis Monatsende. */
export function remainingDaysInclusive(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return 0
  const day = Number(match[3])
  const total = daysInMonth(iso)
  if (day < 1 || day > total) return 0
  return total - day + 1
}

/** Nächster 1. (bei schon 1. → derselbe Tag). */
export function nextFirstIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (day === 1) return iso
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

/** Immer der 1. des Folgemonats. */
export function followingFirstIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

/**
 * Anteiliger Monatsbeitrag in Cent.
 * Formel: round(Monatspreis × Resttage inkl. heute / Tage im Monat).
 */
export function prorateMonthCents(monthCents, isoDay) {
  const cents = Math.round(Number(monthCents) || 0)
  if (cents <= 0) return 0
  const total = daysInMonth(isoDay)
  const rem = remainingDaysInclusive(isoDay)
  if (total <= 0 || rem <= 0) return 0
  if (rem >= total) return cents
  return Math.round((cents * rem) / total)
}

export function transferPurpose(member) {
  const name = `${member?.firstName || ''} ${member?.lastName || ''}`.replace(/\s+/g, ' ').trim()
  const id = String(member?.id || '').slice(0, 8)
  const parts = ['KONNI Beitrag', name, id].filter(Boolean)
  return parts.join(' ').slice(0, 140)
}

function eurFromCents(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2).replace('.', ',')
}

/**
 * Erste Überweisung bei Bankzahlung — analog Stripe-Anteil bei Mid-Month.
 * @param {object} member
 * @param {number} [nowMs]
 */
export function buildTransferDue(member, nowMs = Date.now()) {
  const today = berlinIsoDate(new Date(nowMs))
  const monthCents = Math.round(Number(member?.price) * 100) || 0
  const feeCents = Math.round(Number(member?.fee) * 100) || 0
  const billingStart = memberBillingStart(member)
  const purpose = transferPurpose(member)
  const base = {
    holder: GYM_BANK.holder,
    iban: GYM_BANK.iban,
    bic: GYM_BANK.bic,
    bank: GYM_BANK.bank,
    monthCents,
    feeCents,
    purpose,
  }

  if (today < billingStart) {
    return {
      ...base,
      amount: monthCents + feeCents,
      prorateCents: monthCents,
      prorated: false,
      dueNow: false,
      firstDueDate: billingStart,
      nextFullDue: billingStart,
    }
  }

  if (today.endsWith('-01')) {
    return {
      ...base,
      amount: monthCents + feeCents,
      prorateCents: monthCents,
      prorated: false,
      dueNow: true,
      firstDueDate: today,
      nextFullDue: followingFirstIso(today),
    }
  }

  const next = nextFirstIso(today)
  const prorateCents = prorateMonthCents(monthCents, today)
  return {
    ...base,
    amount: prorateCents + feeCents,
    prorateCents,
    prorated: true,
    dueNow: true,
    firstDueDate: today,
    nextFullDue: next,
  }
}

/** Transfer-Objekt für Store / API / Mail. */
export function buildTransferPayload(member, nowMs = Date.now()) {
  const due = buildTransferDue(member, nowMs)
  return {
    holder: due.holder,
    iban: due.iban,
    bic: due.bic,
    bank: due.bank,
    /** Erste Überweisung in Cent (Anteil + Aufnahmegebühr). */
    amount: due.amount,
    monthAmount: due.monthCents,
    prorateAmount: due.prorateCents,
    feeAmount: due.feeCents,
    prorated: due.prorated,
    dueNow: due.dueNow,
    firstDueDate: due.firstDueDate,
    nextFullDue: due.nextFullDue,
    purpose: due.purpose,
  }
}

export function formatTransferEuro(cents) {
  return eurFromCents(cents)
}

export function transferDueLabel(transfer) {
  const date = germanDate(transfer?.firstDueDate)
  return date || ''
}

export function transferNextLabel(transfer) {
  return germanDate(transfer?.nextFullDue) || ''
}
