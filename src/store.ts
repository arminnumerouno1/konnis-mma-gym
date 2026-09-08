import { create } from 'zustand'
import type { QualityLevel } from './lib/quality'

type ExperienceState = {
  ready: boolean
  quality: QualityLevel
  reducedMotion: boolean
  setReady: (ready: boolean) => void
  setQuality: (quality: QualityLevel) => void
  setReducedMotion: (reducedMotion: boolean) => void
}

export const useExperience = create<ExperienceState>((set) => ({
  ready: false,
  quality: 'high',
  reducedMotion: false,
  setReady: (ready) => set({ ready }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}))

/** Read from the r3f loop — never write this through React state. */
export const scrollProgress = { current: 0 }

/** Intro spotlight fade, independent of camera. */
export const introReveal = { value: 0 }
