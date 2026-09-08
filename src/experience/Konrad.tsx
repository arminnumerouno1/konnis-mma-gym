import { useLayoutEffect } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const HEIGHT = 1.94
const WIDTH = HEIGHT * (400 / 600)

type KonradProps = {
  position: [number, number, number]
}

export function Konrad({ position }: KonradProps) {
  const map = useTexture('/brand/konrad.png')

  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    map.generateMipmaps = true
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.magFilter = THREE.LinearFilter
    map.needsUpdate = true
  }, [map])

  return (
    <group position={position}>
      <mesh position={[0, HEIGHT / 2, 0]} renderOrder={2} frustumCulled={false}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial
          map={map}
          transparent
          alphaTest={0.12}
          toneMapped
          fog
          depthWrite
          side={THREE.FrontSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.04, 0.012, 0.06]}>
        <circleGeometry args={[0.28, 18]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} />
      </mesh>
    </group>
  )
}
