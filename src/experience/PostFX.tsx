import { EffectComposer, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { QualityLevel } from '../lib/quality'

export function PostFX({ quality }: { quality: QualityLevel }) {
  // Extra render target + vignette stacked on the CSS film layer and crushed
  // midtones on phones. Keep the pass for high desktops only.
  if (quality !== 'high') return null

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Vignette offset={0.38} darkness={0.28} eskil={false} />
      <Noise opacity={0.05} premultiply blendFunction={BlendFunction.OVERLAY} />
    </EffectComposer>
  )
}
