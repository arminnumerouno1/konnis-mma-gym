export const OPENING_DATE = '2026-11-02'
export const DEFAULT_BILLING_START = '2026-11-01'

const GERMAN_MONTHS = [
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

export function germanDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return ''
  const month = GERMAN_MONTHS[Number(match[2]) - 1]
  if (!month) return ''
  return `${Number(match[3])}. ${month} ${match[1]}`
}

/** Erste Beitragsfälligkeit. Ein späterer Vertragsbeginn am 1. eines Monats verschiebt sie. */
export function memberBillingStart(member) {
  const start = String(member?.startDate ?? '')
  if (/^\d{4}-\d{2}-01$/.test(start) && start > DEFAULT_BILLING_START) return start
  return DEFAULT_BILLING_START
}
export const ADMIN_COOKIE = 'konni_admin'
export const PLAN_LABELS = {
  standard: 'Standard',
  flex: 'Flex',
  plus: 'Plus',
  daypass: 'Day Pass',
  first50: 'First 50',
}
export const STATUS_LABELS = {
  received: 'Angemeldet',
  active: 'Aktiv',
  paused: 'Pausiert',
  cancelled: 'Gekündigt',
  withdrawn: 'Widerruf',
  expired: 'Beendet',
}

export function isFormerMember(status) {
  return status === 'cancelled' || status === 'withdrawn' || status === 'expired'
}
export const PAY_LABELS = {
  paid: 'Gezahlt',
  open: 'Offen',
  failed: 'Nicht erhalten',
  waived: 'Erlassen',
  upcoming: 'Noch nicht fällig',
}

export function normalizeIban(value) {
  return String(value ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase()
}

export function isValidIban(value) {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith('DE') && iban.length !== 22) return false
  const moved = `${iban.slice(4)}${iban.slice(0, 4)}`
  let rest = 0
  for (const ch of moved) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  }
  return rest === 1
}

export function isValidBic(value) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(value ?? '').trim().toUpperCase())
}

export function maskIban(value) {
  const iban = normalizeIban(value)
  if (iban.length < 8) return iban
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`
}

export function mandateRefFor(id) {
  return `KONNI-${String(id ?? '').replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

function emailKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

/** Lebende Anmeldung zu dieser E-Mail. Gekündigt oder beendet zählt nicht. */
export function membershipTaken(members, email, exceptId) {
  const needle = emailKey(email)
  if (!needle) return false
  return (members ?? []).some((row) => {
    if (!row || emailKey(row.email) !== needle) return false
    if (exceptId && row.id === exceptId) return false
    if (isFormerMember(row.status)) return false
    return true
  })
}

export function needsBank(member) {
  return member.plan !== 'daypass' && !isFormerMember(member.status)
}

export function bankMissing(member) {
  if (member.payMethod === 'transfer') return false
  if (!needsBank(member)) return false
  const hasIban = Boolean(member.bank?.iban)
  // Karte, Apple Pay und Google Pay laufen über Stripe. Dafür gibt es keine IBAN.
  // Eine fehlende Unterschrift zählt erst, wenn schon ein Mandat angelegt wurde.
  if (member.payMethod === 'card' && !hasIban) return false
  return !(hasIban && member.bank?.mandateSignedAt)
}

export function contractMissing(member) {
  return member.source === 'admin' && needsBank(member) && !member.docs?.contract
}

export function guardianMissing(member) {
  return Boolean(member.minor) && !member.guardian?.signedAt
}

export function isoDate(at = new Date()) {
  return new Date(at).toISOString().slice(0, 10)
}

export function ymOf(iso) {
  return String(iso ?? '').slice(0, 7)
}

export function addMonthsIso(iso, months) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const targetMonthIndex = month - 1 + months
  const lastDay = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate()
  const dt = new Date(Date.UTC(year, targetMonthIndex, Math.min(day, lastDay)))
  return dt.toISOString().slice(0, 10)
}

export function addDaysIso(iso, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return null
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return dt.toISOString().slice(0, 10)
}

export function termEndDate(startDate, termMonths) {
  if (!startDate || !termMonths) return null
  const anniversary = addMonthsIso(startDate, termMonths)
  return anniversary ? addDaysIso(anniversary, -1) : null
}

export function cancelDeadlineDate(startDate, termMonths) {
  const end = termEndDate(startDate, termMonths)
  return end ? addMonthsIso(end, -1) : null
}

export function memberStartDate(record, today = isoDate()) {
  if (record.plan === 'daypass') return String(record.visitDay || record.startDate || today)
  if (record.startDate) return String(record.startDate)
  return today < OPENING_DATE ? OPENING_DATE : today
}

export function cancelInfo(member, today = isoDate()) {
  if (member.plan === 'daypass') {
    return {
      kind: 'day',
      canCancelNow: false,
      deadline: null,
      termEnd: member.visitDay || member.startDate || null,
      nextEnd: member.visitDay || member.startDate || null,
      hint: 'Tageskarte. Keine Kündigung.',
    }
  }
  if (member.status === 'withdrawn') {
    return {
      kind: 'withdrawn',
      canCancelNow: false,
      deadline: null,
      termEnd: member.cancelEffectiveOn || null,
      nextEnd: member.cancelEffectiveOn || null,
      hint: 'Widerruf innerhalb der Widerrufsfrist. Kein Mitglied mehr.',
    }
  }
  if (member.status === 'cancelled') {
    return {
      kind: 'cancelled',
      canCancelNow: false,
      deadline: member.cancelDeadline || null,
      termEnd: member.endDate || member.cancelEffectiveOn || null,
      nextEnd: member.cancelEffectiveOn || member.endDate || null,
      hint: member.cancelEffectiveOn
        ? `Gekündigt. Läuft bis ${member.cancelEffectiveOn}.`
        : 'Gekündigt.',
    }
  }
  const start = member.startDate
  const months = member.termMonths
  const termEnd = termEndDate(start, months)
  const deadline = cancelDeadlineDate(start, months)
  if (!termEnd || !deadline) {
    return { kind: 'none', canCancelNow: false, deadline: null, termEnd: null, nextEnd: null, hint: '' }
  }
  if (today <= deadline) {
    return {
      kind: 'min-term',
      canCancelNow: true,
      deadline,
      termEnd,
      nextEnd: termEnd,
      hint: `Kündbar bis ${deadline} zum Laufzeitende ${termEnd}. Frist: 1 Monat zum Ende der Mindestlaufzeit.`,
    }
  }
  if (today <= termEnd) {
    const after = addMonthsIso(addDaysIso(termEnd, 1), 1)
    return {
      kind: 'locked',
      canCancelNow: false,
      deadline,
      termEnd,
      nextEnd: after,
      hint: `Frist zum Laufzeitende war ${deadline}. Erst nach ${termEnd} mit 1 Monat Frist, nächstes Ende dann ${after}.`,
    }
  }
  const nextEnd = addMonthsIso(today, 1)
  return {
    kind: 'rolling',
    canCancelNow: true,
    deadline: null,
    termEnd,
    nextEnd,
    hint: `Mindestlaufzeit vorbei. Kündigung jederzeit mit 1 Monat Frist. Bei Kündigung heute: Ende ${nextEnd}.`,
  }
}

function paymentAmount(member, period) {
  if (member.plan === 'daypass') return member.price
  if (period === 'fee') return member.fee || 0
  return member.price
}

export function ensurePayments(member, today = isoDate()) {
  const existing = Array.isArray(member.payments) ? member.payments : []
  const byKey = new Map(existing.map((row) => [`${row.kind}:${row.period}`, row]))
  const rows = []

  if (member.plan === 'daypass') {
    const period = member.visitDay || member.startDate || today
    const key = `day:${period}`
    const prev = byKey.get(key)
    rows.push(
      prev ?? {
        kind: 'day',
        period,
        amount: member.price,
        status: 'open',
        paidAt: null,
        note: '',
      },
    )
    return { ...member, payments: rows }
  }

  const start = member.startDate || today
  const startYm = ymOf(start)
  const todayYm = ymOf(today)
  const lastYm = startYm > todayYm ? startYm : todayYm
  let cursor = startYm
  let guard = 0
  while (cursor && cursor <= lastYm && guard < 120) {
    const key = `month:${cursor}`
    const due = today >= `${cursor}-01` && today >= start
    const prev = byKey.get(key)
    if (prev) {
      if (prev.status === 'upcoming' && due) rows.push({ ...prev, status: 'open' })
      else rows.push(prev)
    } else {
      rows.push({
        kind: 'month',
        period: cursor,
        amount: paymentAmount(member, cursor),
        status: due ? 'open' : 'upcoming',
        paidAt: null,
        note: '',
      })
    }
    cursor = addMonthsIso(`${cursor}-01`, 1)?.slice(0, 7) ?? null
    guard += 1
  }

  const seen = new Set(rows.map((row) => `${row.kind}:${row.period}`))
  for (const row of existing) {
    const key = `${row.kind}:${row.period}`
    if (seen.has(key)) continue
    rows.push(row)
    seen.add(key)
  }
  return { ...member, payments: rows }
}

export function payStatusThisMonth(member, today = isoDate()) {
  if (isFormerMember(member.status)) return 'na'
  if (member.status === 'paused') return 'waived'
  if (member.plan === 'daypass') {
    const row = (member.payments ?? []).find((item) => item.kind === 'day')
    return row?.status || 'open'
  }
  const period = today < (member.startDate || today) ? ymOf(member.startDate) : ymOf(today)
  const row = (member.payments ?? []).find((item) => item.kind === 'month' && item.period === period)
  if (row) return row.status
  return today < (member.startDate || today) ? 'upcoming' : 'open'
}

export function publicMember(member, today = isoDate(), withPhoto = false) {
  const ready = ensurePayments(member, today)
  const cancel = cancelInfo(ready, today)
  const { photoData, ...rest } = ready
  return {
    ...rest,
    hasPhoto: Boolean(photoData),
    photoData: withPhoto ? photoData || null : undefined,
    payThisMonth: payStatusThisMonth(ready, today),
    cancel,
  }
}

export function listMember(member, today = isoDate()) {
  const view = publicMember(member, today)
  return {
    id: view.id,
    firstName: view.firstName,
    lastName: view.lastName,
    email: view.email,
    phone: view.phone,
    plan: view.plan,
    planName: view.planName,
    price: view.price,
    status: view.status,
    startDate: view.startDate,
    visitDay: view.visitDay ?? null,
    minor: Boolean(view.minor),
    hasPhoto: view.hasPhoto,
    bankMissing: bankMissing(view),
    guardianMissing: guardianMissing(view),
    contractMissing: contractMissing(view),
    payMethod: view.payMethod === 'transfer' ? 'transfer' : view.payMethod === 'card' ? 'card' : null,
    isNew: view.source === 'online' && !view.reviewedAt,
    stripeLinked: Boolean(view.stripe?.customerId),
    payThisMonth: view.payThisMonth,
    cancel: view.cancel,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  }
}

export function memberFromSignup(record, today = isoDate()) {
  const startDate = memberStartDate(record, today)
  const base = {
    ...record,
    status: record.status && record.status !== 'received' ? record.status : 'active',
    startDate,
    endDate: termEndDate(startDate, record.termMonths),
    cancelDeadline: cancelDeadlineDate(startDate, record.termMonths),
    guardian:
      record.guardian && !record.guardian.signedAt && record.source !== 'admin'
        ? { ...record.guardian, signedAt: record.createdAt ?? null, signedVia: 'online' }
        : (record.guardian ?? null),
    bank: record.bank ?? null,
    notes: record.notes ?? '',
    photoData: record.photoData ?? null,
    payments: Array.isArray(record.payments) ? record.payments : [],
    source: record.source ?? 'online',
    updatedAt: record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
    pausedUntil: record.pausedUntil ?? null,
    cancelledAt: record.cancelledAt ?? null,
    cancelEffectiveOn: record.cancelEffectiveOn ?? null,
  }
  return ensurePayments(base, today)
}

export function setPayment(
  member,
  { period, kind = 'month', status, note = '', source = 'manual', ref = null, amount = null },
  today = isoDate(),
) {
  const ready = ensurePayments(member, today)
  const extra = { source, ref, ...(typeof amount === 'number' ? { amount } : {}) }
  const rows = ready.payments.map((row) => {
    if (row.period !== period || row.kind !== kind) return row
    return {
      ...row,
      ...extra,
      status,
      note,
      paidAt: status === 'paid' ? new Date().toISOString() : null,
    }
  })
  const found = rows.some((row) => row.period === period && row.kind === kind)
  if (!found) {
    rows.push({
      kind,
      period,
      amount: member.price,
      ...extra,
      status,
      note,
      paidAt: status === 'paid' ? new Date().toISOString() : null,
    })
  }
  return { ...ready, payments: rows, updatedAt: new Date().toISOString() }
}
