import {
  KURSPLAN as RAW_KURSPLAN,
  KURSPLAN_DAYS as RAW_DAYS,
  KURSPLAN_TIMES as RAW_TIMES,
  kursLevelLabel as rawKursLevelLabel,
  kursplanByDay as rawKursplanByDay,
  openingHoursFromKursplan as rawOpeningHours,
  trialSlots as rawTrialSlots,
  findTrialSlot as rawFindTrialSlot,
  trialSlotLabel as rawTrialSlotLabel,
} from '../../server/kursplan.mjs'

export type KursLevel = 'all' | 'advanced'

export type KursSlot = {
  title: string
  level: KursLevel
  /** Own time label when it differs from the row (e.g. Saturday Open Mat). */
  when?: string
  accent: 'red' | 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'gold'
}

export type KursCell = KursSlot | null

export type KursDay = {
  id: string
  short: string
  label: string
}

export const KURSPLAN_DAYS = RAW_DAYS as readonly KursDay[]

export const KURSPLAN_TIMES = RAW_TIMES as readonly string[]

export const KURSPLAN = RAW_KURSPLAN as KursCell[][]

export function kursLevelLabel(level: KursLevel) {
  return rawKursLevelLabel(level) as 'Fortgeschrittene' | 'All Levels'
}

export type KursDayEntry = {
  time: string
  slot: KursSlot
}

export type KursDayPlan = {
  day: KursDay
  entries: KursDayEntry[]
}

/** Courses grouped by day for the stacked mobile layout. Empty days stay listed. */
export function kursplanByDay(): KursDayPlan[] {
  return rawKursplanByDay() as KursDayPlan[]
}

export type TrialSlot = {
  id: string
  dayId: string
  dayLabel: string
  time: string
  title: string
  level: KursLevel
  label: string
}

export function trialSlots(): TrialSlot[] {
  return rawTrialSlots() as TrialSlot[]
}

export function findTrialSlot(slotId: string): TrialSlot | null {
  return (rawFindTrialSlot(slotId) as TrialSlot | null) ?? null
}

export function trialSlotLabel(slot: TrialSlot) {
  return rawTrialSlotLabel(slot) as string
}

/** Merge course blocks into opening windows; gaps over 90 minutes stay separate. */
export function openingHoursFromKursplan(gapMinutes = 90) {
  return rawOpeningHours(gapMinutes) as Array<{
    day: KursDay
    label: string
    hours: string
    windows: string[]
  }>
}
