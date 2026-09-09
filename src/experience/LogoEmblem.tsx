import { useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

type LogoEmblemProps = {
  position: [number, number, number]
  scale?: number
}

const LOGO_HEIGHT = 2.42
const SOURCE_ASPECT = 2202 / 2340

function sharpenEmblem(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `#include <map_fragment>
    float emblemW = max(fwidth(diffuseColor.a), 0.0008);
    diffuseColor.a = smoothstep(0.5 - emblemW, 0.5 + emblemW, diffuseColor.a);
    if (diffuseColor.a < 0.04) discard;`,
  )
}

export function LogoEmblem({ position, scale = 1 }: LogoEmblemProps) {
  const albedo = useTexture('/brand/konni-logo.webp')

  useLayoutEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.generateMipmaps = false
    albedo.minFilter = THREE.LinearFilter
    albedo.magFilter = THREE.LinearFilter
    albedo.wrapS = THREE.ClampToEdgeWrapping
    albedo.wrapT = THREE.ClampToEdgeWrapping
    albedo.needsUpdate = true
  }, [albedo])

  const [width, height] = useMemo(() => {
    const img = albedo.image as { width: number; height: number } | undefined
    const aspect = img?.height ? img.width / img.height : SOURCE_ASPECT
    return [LOGO_HEIGHT * aspect, LOGO_HEIGHT] as const
  }, [albedo])

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0, 0.02]} renderOrder={3} frustumCulled={false}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={albedo}
          transparent
          toneMapped={false}
          fog={false}
          depthWrite
          side={THREE.FrontSide}
          onBeforeCompile={sharpenEmblem}
          customProgramCacheKey={() => 'konni-emblem-edge-aa'}
          alphaToCoverage
        />
      </mesh>
    </group>
  )
}
