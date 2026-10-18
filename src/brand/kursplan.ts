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
