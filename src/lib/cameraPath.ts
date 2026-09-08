import * as THREE from 'three'
import { clamp, inverseLerp, lerp } from './math'

export type CamKey = {
  t: number
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  fov: number
}

export type LightKey = {
  t: number
  intro: number
  gym: number
  side: number
  city: number
  finale: number
  fog: number
  exposure: number
}

/**
 * Camera is a single continuous dolly through the warehouse.
 * Times are scroll progress 0–1. Motion stays slow and heavy.
 */
export const CAMERA_KEYS: CamKey[] = [
  { t: 0.0, position: [0.18, 1.08, 10.6], target: [0, 1.06, 0], fov: 30 },
  { t: 0.055, position: [0.06, 1.08, 6.1], target: [0, 1.05, 0], fov: 28 },
  { t: 0.11, position: [0.0, 1.06, 2.55], target: [0, 1.04, 0.05], fov: 25 },
  { t: 0.155, position: [1.05, 1.02, 0.55], target: [0.15, 1.02, -3.2], fov: 30 },
  { t: 0.2, position: [0.25, 1.35, -6.2], target: [0, 1.45, -16], fov: 36 },
  { t: 0.28, position: [0.12, 1.52, -15.4], target: [0.05, 1.75, -25.5], fov: 34 },
  { t: 0.36, position: [-0.15, 2.15, -27.2], target: [0, 0.15, -33.6], fov: 38 },
  { t: 0.395, position: [0.22, 1.46, -34.15], target: [1.05, 1.12, -39.3], fov: 31 },
  { t: 0.43, position: [0.08, 1.48, -36.4], target: [0, 1.52, -45.5], fov: 32 },
  { t: 0.5, position: [0.0, 1.52, -40.2], target: [0, 1.55, -46.2], fov: 27 },
  { t: 0.57, position: [0.28, 1.42, -49.4], target: [0, 1.38, -57.2], fov: 34 },
  { t: 0.64, position: [-2.35, 1.58, -61.2], target: [0.9, 1.42, -67.4], fov: 32 },
  { t: 0.7, position: [0.1, 2.55, -72.5], target: [0, 2.0, -86], fov: 40 },
  { t: 0.76, position: [-3.8, 3.4, -80.5], target: [0.2, 2.6, -93], fov: 36 },
  { t: 0.825, position: [3.2, 5.6, -90.5], target: [0, 2.4, -101], fov: 38 },
  { t: 0.88, position: [0.12, 1.42, -104.6], target: [0, 1.05, -114.15], fov: 32 },
  { t: 0.94, position: [0.0, 1.28, -107.15], target: [0, 0.78, -114.15], fov: 33 },
  { t: 1.0, position: [0.0, 1.26, -106.85], target: [0, 0.74, -114.15], fov: 33 },
]

/** Portrait / phone: stay on axis so titles are not cropped. */
export const CAMERA_KEYS_COMPACT: CamKey[] = [
  { t: 0.0, position: [0, 1.08, 8.6], target: [0, 1.06, 0], fov: 38 },
  { t: 0.055, position: [0, 1.08, 5.2], target: [0, 1.05, 0], fov: 36 },
  { t: 0.11, position: [0, 1.06, 3.2], target: [0, 1.04, 0], fov: 34 },
  { t: 0.16, position: [0.28, 1.04, 0.9], target: [0, 1.04, -4], fov: 38 },
  { t: 0.22, position: [0, 1.4, -7.2], target: [0, 1.4, -16], fov: 42 },
  { t: 0.3, position: [0, 1.5, -16.2], target: [0, 1.5, -24], fov: 40 },
  { t: 0.37, position: [0, 1.72, -28.2], target: [0, 0.35, -33.2], fov: 42 },
  { t: 0.4, position: [0.12, 1.46, -33.8], target: [0.55, 1.12, -39.2], fov: 38 },
  { t: 0.48, position: [0, 1.5, -38.2], target: [0, 1.52, -46], fov: 36 },
  { t: 0.56, position: [0, 1.42, -49.2], target: [0, 1.4, -57], fov: 38 },
  { t: 0.64, position: [0, 1.5, -60.2], target: [0.2, 1.45, -67], fov: 38 },
  { t: 0.72, position: [0, 2.35, -73], target: [0, 2.05, -86], fov: 44 },
  { t: 0.78, position: [0, 3.05, -81], target: [0, 2.5, -93], fov: 42 },
  { t: 0.84, position: [0.2, 4.1, -90], target: [0, 2.2, -100], fov: 42 },
  { t: 0.9, position: [0, 1.42, -104.2], target: [0, 1.0, -114.15], fov: 38 },
  { t: 0.96, position: [0, 1.32, -106.3], target: [0, 0.68, -114.15], fov: 38 },
  { t: 1.0, position: [0, 1.3, -106.1], target: [0, 0.66, -114.15], fov: 38 },
]

export const LIGHT_KEYS: LightKey[] = [
  { t: 0.0, intro: 0.82, gym: 0, side: 0, city: 0, finale: 0, fog: 0.034, exposure: 0.92 },
  { t: 0.05, intro: 1, gym: 0, side: 0, city: 0, finale: 0, fog: 0.03, exposure: 1.02 },
  { t: 0.15, intro: 0.85, gym: 0.15, side: 0, city: 0, finale: 0, fog: 0.032, exposure: 0.88 },
  { t: 0.23, intro: 0, gym: 1, side: 0, city: 0, finale: 0, fog: 0.03, exposure: 0.74 },
  { t: 0.5, intro: 0, gym: 0.82, side: 0.25, city: 0, finale: 0, fog: 0.028, exposure: 0.76 },
  { t: 0.57, intro: 0, gym: 0.45, side: 0.2, city: 0, finale: 0, fog: 0.034, exposure: 0.68 },
  { t: 0.64, intro: 0, gym: 0.35, side: 1, city: 0, finale: 0, fog: 0.026, exposure: 0.82 },
  { t: 0.72, intro: 0, gym: 0.08, side: 0.05, city: 0.55, finale: 0, fog: 0.044, exposure: 0.5 },
  { t: 0.8, intro: 0, gym: 0, side: 0, city: 1, finale: 0, fog: 0.026, exposure: 0.66 },
  { t: 0.88, intro: 0, gym: 0, side: 0, city: 0.15, finale: 0.25, fog: 0.058, exposure: 0.38 },
  { t: 0.95, intro: 0, gym: 0, side: 0, city: 0, finale: 1, fog: 0.048, exposure: 0.7 },
  { t: 1.0, intro: 0, gym: 0, side: 0, city: 0, finale: 1, fog: 0.05, exposure: 0.68 },
]

function findSegment<T extends { t: number }>(keys: T[], t: number): { a: T; b: T; u: number } {
  const p = clamp(t, 0, 1)
  if (p <= keys[0].t) return { a: keys[0], b: keys[0], u: 0 }
  const last = keys[keys.length - 1]
  if (p >= last.t) return { a: last, b: last, u: 0 }
  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t < p) i += 1
  const a = keys[i]
  const b = keys[i + 1]
  return { a, b, u: clamp(inverseLerp(a.t, b.t, p), 0, 1) }
}

export function sampleCameraInto(
  t: number,
  position: THREE.Vector3,
  target: THREE.Vector3,
  compact = false,
): number {
  const { a, b, u } = findSegment(compact ? CAMERA_KEYS_COMPACT : CAMERA_KEYS, t)
  position.set(
    lerp(a.position[0], b.position[0], u),
    lerp(a.position[1], b.position[1], u),
    lerp(a.position[2], b.position[2], u),
  )
  target.set(
    lerp(a.target[0], b.target[0], u),
    lerp(a.target[1], b.target[1], u),
    lerp(a.target[2], b.target[2], u),
  )
  return lerp(a.fov, b.fov, u)
}

export function sampleLights(t: number): LightKey {
  const { a, b, u } = findSegment(LIGHT_KEYS, t)
  return {
    t,
    intro: lerp(a.intro, b.intro, u),
    gym: lerp(a.gym, b.gym, u),
    side: lerp(a.side, b.side, u),
    city: lerp(a.city, b.city, u),
    finale: lerp(a.finale, b.finale, u),
    fog: lerp(a.fog, b.fog, u),
    exposure: lerp(a.exposure, b.exposure, u),
  }
}
