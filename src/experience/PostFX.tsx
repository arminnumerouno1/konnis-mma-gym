import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { QualityLevel } from '../lib/quality'

export function PostFX({ quality }: { quality: QualityLevel }) {
  if (quality === 'low') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Vignette offset={0.3} darkness={0.4} eskil={false} />
        <Noise opacity={0.045} premultiply blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    )
  }

  if (quality === 'medium') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom intensity={0.14} luminanceThreshold={0.76} luminanceSmoothing={0.36} mipmapBlur />
        <Vignette offset={0.32} darkness={0.48} eskil={false} />
        <Noise opacity={0.05} premultiply blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={0.26} luminanceThreshold={0.68} luminanceSmoothing={0.32} mipmapBlur />
      <Vignette offset={0.32} darkness={0.48} eskil={false} />
      <Noise opacity={0.085} premultiply blendFunction={BlendFunction.OVERLAY} />
      <ChromaticAberration offset={[0.00045, 0.00028]} radialModulation modulationOffset={0.4} />
    </EffectComposer>
  )
}
