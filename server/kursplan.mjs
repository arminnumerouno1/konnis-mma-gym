/** Shared Kursplan. Keep in sync with the published poster. */

export const KURSPLAN_DAYS = [
  { id: 'mo', short: 'Mo', label: 'Montag' },
  { id: 'di', short: 'Di', label: 'Dienstag' },
  { id: 'mi', short: 'Mi', label: 'Mittwoch' },
  { id: 'do', short: 'Do', label: 'Donnerstag' },
  { id: 'fr', short: 'Fr', label: 'Freitag' },
  { id: 'sa', short: 'Sa', label: 'Samstag' },
]

export const KURSPLAN_TIMES = [
  '10:00 – 11:30',
  '11:30 – 13:00',
  '17:00 – 18:00',
  '18:00 – 19:30',
  '19:30 – 21:00',
]

const all = (title, accent, when) => ({
  title,
  level: 'all',
  accent,
  ...(when ? { when } : {}),
})

const advanced = (title, accent) => ({
  title,
  level: 'advanced',
  accent,
})

/** Rows × days, Monday first. Keep in sync with the published poster. */
export const KURSPLAN = [
  // 10:00 – 11:30
  [
    all('BJJ NoGi / MMA', 'blue'),
    null,
    all('Boxen Basic', 'red'),
    null,
    null,
    all('Sparring', 'orange'),
  ],
  // 11:30 – 13:00
  [null, null, null, null, null, all('Open Mat', 'teal')],
  // 17:00 – 18:00
  [null, all('Boxen Basic', 'red'), all('Ringen', 'green'), null, all('MMA', 'gold'), null],
  // 18:00 – 19:30
  [
    advanced('Boxen', 'red'),
    all('BJJ NoGi', 'blue'),
    advanced('Boxen', 'red'),
    all('BJJ NoGi', 'blue'),
    all('K1', 'purple'),
    null,
  ],
  // 19:30 – 21:00
  [
    all('MMA Basic', 'gold'),
    all('MMA', 'gold'),
    null,
    all('K1', 'purple'),
    all('Boxen Basic', 'red'),
    null,
  ],
]

export function kursLevelLabel(level) {
  return level === 'advanced' ? 'Fortgeschrittene' : 'All Levels'
}

/** Courses grouped by day for the stacked mobile layout. Empty days stay listed. */
export function kursplanByDay() {
  return KURSPLAN_DAYS.map((day, dayIndex) => {
    const entries = []
    for (let rowIndex = 0; rowIndex < KURSPLAN.length; rowIndex += 1) {
      const slot = KURSPLAN[rowIndex][dayIndex]
      if (!slot) continue
      entries.push({ time: slot.when || KURSPLAN_TIMES[rowIndex], slot })
    }
    return { day, entries }
  })
}

export function trialSlotId(dayId, time, title) {
  return `${dayId}|${time}|${title}`
}

export function trialSlotLabel(slot) {
  return `${slot.dayLabel} · ${slot.time} · ${slot.title}`
}

/** Flat bookable slots for Probetraining. */
export function trialSlots() {
  const rows = []
  for (const { day, entries } of kursplanByDay()) {
    for (const entry of entries) {
      const time = entry.time
      const title = entry.slot.title
      rows.push({
        id: trialSlotId(day.id, time, title),
        dayId: day.id,
        dayLabel: day.label,
        time,
        title,
        level: entry.slot.level,
        label: `${day.label} · ${time} · ${title}`,
      })
    }
  }
  return rows
}

export function findTrialSlot(slotId) {
  const wanted = String(slotId ?? '')
  if (!wanted) return null
  return trialSlots().find((row) => row.id === wanted) ?? null
}

function berlinParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  const weekday = String(get('weekday') || '').toLowerCase()
  const map = { mon: 'mo', tue: 'di', wed: 'mi', thu: 'do', fri: 'fr', sat: 'sa', sun: 'so' }
  return {
    dayId: map[weekday] || null,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

export function slotsForDayId(dayId) {
  return trialSlots().filter((row) => row.dayId === dayId)
}

/**
 * Current class for door check-in.
 * Window: 20 minutes before start until 40 minutes after start.
 */
export function currentSlot(now = new Date(), { beforeMinutes = 20, afterMinutes = 40 } = {}) {
  const { dayId, minutes } = berlinParts(now)
  if (!dayId || dayId === 'so') return null
  const candidates = []
  for (const row of slotsForDayId(dayId)) {
    const range = parseRange(row.time)
    if (!range) continue
    if (minutes >= range.start - beforeMinutes && minutes <= range.start + afterMinutes) {
      candidates.push({ ...row, startMinutes: range.start, distance: Math.abs(minutes - range.start) })
    }
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => a.distance - b.distance)
  const best = candidates[0]
  return {
    id: best.id,
    dayId: best.dayId,
    dayLabel: best.dayLabel,
    time: best.time,
    title: best.title,
    level: best.level,
    label: best.label,
  }
}

export function todaySlots(now = new Date()) {
  const { dayId } = berlinParts(now)
  if (!dayId || dayId === 'so') return []
  return slotsForDayId(dayId)
}

function parseClock(raw) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(raw).trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseRange(raw) {
  const parts = String(raw).split('–').map((part) => part.trim())
  if (parts.length !== 2) return null
  const start = parseClock(parts[0])
  const end = parseClock(parts[1])
  if (start == null || end == null || end <= start) return null
  return { start, end }
}

/** Merge course blocks into opening windows; gaps over 90 minutes stay separate. */
export function openingHoursFromKursplan(gapMinutes = 90) {
  return kursplanByDay().map(({ day, entries }) => {
    const ranges = entries
      .map((entry) => parseRange(entry.time))
      .filter((range) => Boolean(range))
      .sort((a, b) => a.start - b.start)

    if (!ranges.length) {
      return { day, label: day.label, hours: 'geschlossen', windows: [] }
    }

    const windows = [{ ...ranges[0] }]
    for (const range of ranges.slice(1)) {
      const last = windows.at(-1)
      if (range.start <= last.end + gapMinutes) {
        last.end = Math.max(last.end, range.end)
      } else {
        windows.push({ ...range })
      }
    }

    const labels = windows.map((window) => `${formatClock(window.start)} – ${formatClock(window.end)}`)
    return { day, label: day.label, hours: labels.join(' · '), windows: labels }
  })
}
