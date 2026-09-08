import { create } from 'zustand'
import type { QualityLevel } from './lib/quality'

type ExperienceState = {
  ready: boolean
  quality: QualityLevel
  reducedMotion: boolean
  compact: boolean
  setReady: (ready: boolean) => void
  setQuality: (quality: QualityLevel) => void
  setReducedMotion: (reducedMotion: boolean) => void
  setCompact: (compact: boolean) => void
}

function initialCompact() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 780
}

export const useExperience = create<ExperienceState>((set) => ({
  ready: false,
  quality: 'high',
  reducedMotion: false,
  compact: initialCompact(),
  setReady: (ready) => set({ ready }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setCompact: (compact) => set({ compact }),
}))

/** Read from the r3f loop — never write this through React state. */
export const scrollProgress = { current: 0 }

/** Intro spotlight fade, independent of camera. */
export const introReveal = { value: 0 }
