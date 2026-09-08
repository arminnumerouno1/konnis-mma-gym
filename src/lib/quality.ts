export type QualityLevel = 'high' | 'medium' | 'low'

type NavigatorMemory = Navigator & {
  deviceMemory?: number
}

export function detectQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'medium'

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = window.innerWidth < 780
  const saveData =
    window.matchMedia('(prefers-reduced-data: reduce)').matches ||
    Boolean((navigator as NavigatorMemory & { connection?: { saveData?: boolean } }).connection?.saveData)
  const memory = (navigator as NavigatorMemory).deviceMemory
  const cores = navigator.hardwareConcurrency ?? 8

  if (saveData) return 'low'
  if ((coarse && small) || (memory !== undefined && memory <= 4) || cores <= 4) {
    return 'low'
  }
  if (coarse || small || (memory !== undefined && memory <= 6) || cores <= 6) {
    return 'medium'
  }
  return 'high'
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
