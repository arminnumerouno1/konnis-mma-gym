import { addDaysIso, addMonthsIso, ensurePayments, isoDate } from './member-model.mjs'

const berlinDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function berlinDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return berlinDay.format(date)
}

export function berlinYm(iso) {
  return berlinDate(iso).slice(0, 7)
}

function monthEnd(ym) {
  return addDaysIso(addMonthsIso(`${ym}-01`, 1), -1)
}

function endedOn(member) {
  if (member.status === 'withdrawn') return member.cancelEffectiveOn || berlinDate(member.cancelledAt) || null
  if (member.status === 'cancelled') return member.cancelEffectiveOn || member.endDate || null
  if (member.status === 'expired') return member.endDate || berlinDate(member.updatedAt) || null
  return null
}

function inStock(member, lastDay) {
  if (member.plan === 'daypass' || member.status === 'received') return false
  if (!member.startDate || member.startDate > lastDay) return false
  const end = endedOn(member)
  return !end || end >= lastDay
}

function emptyMonth(ym) {
  return {
    ym,
    signups: 0,
    online: 0,
    desk: 0,
    minors: 0,
    byPlan: { slowstart: 0, standard: 0, flex: 0, plus: 0, first50: 0 },
    daypasses: 0,
    dayRevenue: 0,
    cancellations: 0,
    endings: 0,
    stock: 0,
    paused: 0,
    expected: 0,
    due: 0,
    paid: 0,
    open: 0,
    openCount: 0,
  }
}

const round = (value) => Math.round(value * 100) / 100

export function buildReport(members, year, today = isoDate()) {
  const months = Array.from({ length: 12 }, (_, index) => emptyMonth(`${year}-${String(index + 1).padStart(2, '0')}`))
  const byYm = new Map(months.map((row) => [row.ym, row]))

  for (const raw of members) {
    const member = ensurePayments(raw, today)
    if (member.plan === 'daypass') {
      const row = byYm.get(String(member.visitDay || member.startDate || '').slice(0, 7))
      if (row) {
        row.daypasses += 1
        const pay = member.payments.find((item) => item.kind === 'day')
        if (pay?.status === 'paid') row.dayRevenue += Number(pay.amount) || 0
      }
      continue
    }

    const joined = byYm.get(berlinYm(member.createdAt))
    if (joined) {
      joined.signups += 1
      if (member.source === 'admin') joined.desk += 1
      else joined.online += 1
      if (member.minor) joined.minors += 1
      if (member.plan in joined.byPlan) joined.byPlan[member.plan] += 1
    }

    const cancelled = member.status !== 'withdrawn' && member.cancelledAt ? byYm.get(berlinYm(member.cancelledAt)) : null
    if (cancelled) cancelled.cancellations += 1
    const end = endedOn(member)
    const ended = end ? byYm.get(String(end).slice(0, 7)) : null
    if (ended) ended.endings += 1

    for (const row of months) {
      const lastDay = monthEnd(row.ym)
      if (!inStock(member, lastDay)) continue
      row.stock += 1
      if (member.status === 'paused') row.paused += 1
      else row.expected += Number(member.price) || 0
    }

    for (const pay of member.payments) {
      if (pay.kind !== 'month') continue
      const row = byYm.get(pay.period)
      if (!row || pay.status === 'upcoming' || pay.status === 'waived') continue
      const amount = Number(pay.amount) || 0
      row.due += amount
      if (pay.status === 'paid') row.paid += amount
      else {
        row.open += amount
        row.openCount += 1
      }
    }
  }

  for (const row of months) {
    row.dayRevenue = round(row.dayRevenue)
    row.expected = round(row.expected)
    row.due = round(row.due)
    row.paid = round(row.paid)
    row.open = round(row.open)
  }

  const sum = (key) => months.reduce((total, row) => total + row[key], 0)
  const totals = {
    signups: sum('signups'),
    online: sum('online'),
    desk: sum('desk'),
    minors: sum('minors'),
    byPlan: {
      slowstart: months.reduce((t, row) => t + row.byPlan.slowstart, 0),
      standard: months.reduce((t, row) => t + row.byPlan.standard, 0),
      flex: months.reduce((t, row) => t + row.byPlan.flex, 0),
      plus: months.reduce((t, row) => t + row.byPlan.plus, 0),
      first50: months.reduce((t, row) => t + row.byPlan.first50, 0),
    },
    daypasses: sum('daypasses'),
    dayRevenue: round(sum('dayRevenue')),
    cancellations: sum('cancellations'),
    endings: sum('endings'),
    due: round(sum('due')),
    paid: round(sum('paid')),
    open: round(sum('open')),
    openCount: sum('openCount'),
  }

  const years = new Set([Number(year), Number(today.slice(0, 4))])
  for (const member of members) {
    for (const value of [berlinYm(member.createdAt), member.startDate, member.visitDay]) {
      const y = Number(String(value ?? '').slice(0, 4))
      if (y >= 2020 && y <= 2100) years.add(y)
    }
  }

  return { year: Number(year), today, months, totals, years: [...years].sort((a, b) => b - a) }
}
