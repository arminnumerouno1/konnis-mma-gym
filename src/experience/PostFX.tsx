import { EffectComposer, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { QualityLevel } from '../lib/quality'

export function PostFX({ quality }: { quality: QualityLevel }) {
  // Low: skip the extra render target so the intro mark stays sharp on phones.
  // Film grain and vignette already live in CSS.
  if (quality === 'low') return null

  if (quality === 'medium') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Vignette offset={0.32} darkness={0.48} eskil={false} />
        <Noise opacity={0.05} premultiply blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Vignette offset={0.32} darkness={0.48} eskil={false} />
      <Noise opacity={0.085} premultiply blendFunction={BlendFunction.OVERLAY} />
      <ChromaticAberration offset={[0.00045, 0.00028]} radialModulation modulationOffset={0.4} />
    </EffectComposer>
  )
}
