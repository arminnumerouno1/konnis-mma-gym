import { EffectComposer, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { QualityLevel } from '../lib/quality'

export function PostFX({ quality }: { quality: QualityLevel }) {
  // Low: skip the extra render target so the intro mark stays sharp on phones.
  // Film grain and vignette already live in CSS. Chromatic aberration is off —
  // it fringed the emblem edges on the dolly-in.
  if (quality === 'low') return null

  const grain = quality === 'high' ? 0.07 : 0.05

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Vignette offset={0.32} darkness={0.48} eskil={false} />
      <Noise opacity={grain} premultiply blendFunction={BlendFunction.OVERLAY} />
    </EffectComposer>
  )
}
