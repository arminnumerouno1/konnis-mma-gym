import { useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

type LogoEmblemProps = {
  position: [number, number, number]
  scale?: number
}

const LOGO_HEIGHT = 2.42
const SOURCE_ASPECT = 1096 / 1164

export function LogoEmblem({ position, scale = 1 }: LogoEmblemProps) {
  const albedo = useTexture('/brand/konni-logo.png')

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
          alphaTest={0.12}
          toneMapped={false}
          fog={false}
          side={THREE.FrontSide}
          depthWrite
        />
      </mesh>
    </group>
  )
}
