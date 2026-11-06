export type KursLevel = 'all' | 'advanced'

export type KursSlot = {
  title: string
  level: KursLevel
  when?: string
  accent: 'red' | 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'gold'
}

export type KursCell = KursSlot | null

export type KursDay = {
  id: string
  short: string
  label: string
}

export const KURSPLAN_DAYS: KursDay[]
export const KURSPLAN_TIMES: string[]
export const KURSPLAN: KursCell[][]

export function kursLevelLabel(level: KursLevel): string

export function kursplanByDay(): Array<{
  day: KursDay
  entries: Array<{ time: string; slot: KursSlot }>
}>

export type TrialSlot = {
  id: string
  dayId: string
  dayLabel: string
  time: string
  title: string
  level: KursLevel
  label: string
}

export function trialSlotId(dayId: string, time: string, title: string): string
export function trialSlotLabel(slot: Partial<TrialSlot>): string
export function trialSlots(): TrialSlot[]
export function findTrialSlot(slotId: string): TrialSlot | null

export function openingHoursFromKursplan(gapMinutes?: number): Array<{
  day: KursDay
  label: string
  hours: string
  windows: string[]
}>
