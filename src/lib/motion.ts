export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ageFromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const born = new Date(year, month - 1, day)
  if (born.getFullYear() !== year || born.getMonth() !== month - 1 || born.getDate() !== day) return null
  const now = new Date()
  let age = now.getFullYear() - year
  const monthDiff = now.getMonth() - (month - 1)
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age -= 1
  return age
}
