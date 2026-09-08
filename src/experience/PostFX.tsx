import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { QualityLevel } from '../lib/quality'

export function PostFX({ quality }: { quality: QualityLevel }) {
  if (quality === 'low') return null

  if (quality === 'medium') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Vignette offset={0.28} darkness={0.78} eskil={false} />
        <Noise opacity={0.05} premultiply blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={0.18} luminanceThreshold={0.82} luminanceSmoothing={0.28} mipmapBlur />
      <Vignette offset={0.28} darkness={0.78} eskil={false} />
      <Noise opacity={0.085} premultiply blendFunction={BlendFunction.OVERLAY} />
      <ChromaticAberration offset={[0.00045, 0.00028]} radialModulation modulationOffset={0.4} />
    </EffectComposer>
  )
}
