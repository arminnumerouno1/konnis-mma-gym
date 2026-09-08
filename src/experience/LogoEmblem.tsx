import { useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { octagonShape } from '../brand/logoMaps'

type LogoEmblemProps = {
  position: [number, number, number]
  scale?: number
}

/** Metal body stays behind the artwork. Bevel was covering the texture. */
const PLATE_RADIUS = 1.22
const PLATE_DEPTH = 0.1
const LOGO_SIZE = 2.42

export function LogoEmblem({ position, scale = 1 }: LogoEmblemProps) {
  const albedo = useTexture('/brand/konnis-logo.jpg')

  useLayoutEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.anisotropy = 8
    albedo.generateMipmaps = true
    albedo.minFilter = THREE.LinearMipmapLinearFilter
    albedo.magFilter = THREE.LinearFilter
    albedo.needsUpdate = true
  }, [albedo])

  const plate = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(octagonShape(PLATE_RADIUS), {
      depth: PLATE_DEPTH,
      bevelEnabled: false,
      curveSegments: 1,
    })
    geo.translate(0, 0, -PLATE_DEPTH - 0.012)
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <group position={position} scale={scale}>
      <mesh geometry={plate} castShadow>
        <meshStandardMaterial color="#2c2c2a" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.02]} renderOrder={3}>
        <planeGeometry args={[LOGO_SIZE, LOGO_SIZE]} />
        <meshBasicMaterial
          map={albedo}
          toneMapped={false}
          fog={false}
          side={THREE.FrontSide}
          depthWrite
        />
      </mesh>
    </group>
  )
}
