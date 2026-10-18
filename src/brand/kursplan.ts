export type KursLevel = 'all' | 'advanced'

export type KursSlot = {
  title: string
  level: KursLevel
  /** Own time label when it differs from the row (e.g. Saturday Open Mat). */
  when?: string
  accent: 'red' | 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'gold'
}

export type KursCell = KursSlot | null

export const KURSPLAN_DAYS = [
  { id: 'mo', short: 'Mo', label: 'Montag' },
  { id: 'di', short: 'Di', label: 'Dienstag' },
  { id: 'mi', short: 'Mi', label: 'Mittwoch' },
  { id: 'do', short: 'Do', label: 'Donnerstag' },
  { id: 'fr', short: 'Fr', label: 'Freitag' },
  { id: 'sa', short: 'Sa', label: 'Samstag' },
] as const

export const KURSPLAN_TIMES = [
  '09:00 – 10:30',
  '10:00 – 11:30',
  '17:00 – 18:00',
  '18:00 – 19:30',
  '19:30 – 21:00',
] as const

const all = (title: string, accent: KursSlot['accent'], when?: string): KursSlot => ({
  title,
  level: 'all',
  accent,
  ...(when ? { when } : {}),
})

const advanced = (title: string, accent: KursSlot['accent']): KursSlot => ({
  title,
  level: 'advanced',
  accent,
})

/** Rows × days, Monday first. Matches the published Kursplan poster. */
export const KURSPLAN: KursCell[][] = [
  // 09:00 – 10:30
  [null, null, null, all('Fitness Boxen', 'orange'), null, null],
  // 10:00 – 11:30
  [all('BJJ / MMA', 'blue'), null, null, null, null, all('Open Mat / Sparring', 'teal', '10:00 – 14:00')],
  // 17:00 – 18:00
  [all('Fitness Boxen', 'orange'), null, null, advanced('MMA', 'red'), null, null],
  // 18:00 – 19:30
  [all('Boxen', 'red'), all('BJJ', 'blue'), all('Boxen', 'red'), all('BJJ', 'blue'), all('Kickboxen', 'purple'), null],
  // 19:30 – 21:00
  [
    all('MMA Basic', 'gold'),
    advanced('MMA', 'red'),
    all('Sparring', 'orange'),
    all('Ringen', 'green'),
    all('BJJ / MMA Grappling', 'purple'),
    null,
  ],
]

export function kursLevelLabel(level: KursLevel) {
  return level === 'advanced' ? 'Fortgeschrittene' : 'All Levels'
}

export type KursDayEntry = {
  time: string
  slot: KursSlot
}

export type KursDayPlan = {
  day: (typeof KURSPLAN_DAYS)[number]
  entries: KursDayEntry[]
}

/** Courses grouped by day for the stacked mobile layout. Empty days stay listed. */
export function kursplanByDay(): KursDayPlan[] {
  return KURSPLAN_DAYS.map((day, dayIndex) => {
    const entries: KursDayEntry[] = []
    for (let rowIndex = 0; rowIndex < KURSPLAN.length; rowIndex += 1) {
      const slot = KURSPLAN[rowIndex][dayIndex]
      if (!slot) continue
      entries.push({ time: slot.when || KURSPLAN_TIMES[rowIndex], slot })
    }
    return { day, entries }
  })
}

function parseClock(raw: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseRange(raw: string) {
  const parts = raw.split('–').map((part) => part.trim())
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
      .filter((range): range is { start: number; end: number } => Boolean(range))
      .sort((a, b) => a.start - b.start)

    if (!ranges.length) {
      return { day, label: day.label, hours: 'geschlossen' as const, windows: [] as string[] }
    }

    const windows: { start: number; end: number }[] = [{ ...ranges[0] }]
    for (const range of ranges.slice(1)) {
      const last = windows.at(-1)!
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
