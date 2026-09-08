export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (Math.abs(b - a) < 1e-6) return 0
  return (value - a) / (b - a)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(inverseLerp(edge0, edge1, x), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Fade in, hold, fade out. Returns 0–1. */
export function windowOpacity(
  t: number,
  fadeInStart: number,
  fadeInEnd: number,
  fadeOutStart: number,
  fadeOutEnd: number,
): number {
  if (t < fadeInStart || t > fadeOutEnd) return 0
  if (t < fadeInEnd) return smoothstep(fadeInStart, fadeInEnd, t)
  if (t > fadeOutStart) return 1 - smoothstep(fadeOutStart, fadeOutEnd, t)
  return 1
}
