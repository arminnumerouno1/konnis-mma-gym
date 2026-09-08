import { useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { octagonShape } from '../brand/logoMaps'

type LogoEmblemProps = {
  position: [number, number, number]
  scale?: number
}

const RADIUS = 1.26
const DEPTH = 0.09
const FACE = 2.48

export function LogoEmblem({ position, scale = 1 }: LogoEmblemProps) {
  const albedo = useTexture('/brand/konnis-logo.jpg')

  useLayoutEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.anisotropy = 8
    albedo.generateMipmaps = true
    albedo.minFilter = THREE.LinearMipmapLinearFilter
    albedo.needsUpdate = true
  }, [albedo])

  const plate = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(octagonShape(RADIUS), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 1,
    })
    geo.translate(0, 0, -DEPTH / 2)
    geo.computeVertexNormals()
    return geo
  }, [])

  const plateMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a2a28',
        metalness: 0.42,
        roughness: 0.48,
      }),
    [],
  )

  const faceMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: albedo,
        toneMapped: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
    [albedo],
  )

  return (
    <group position={position} scale={scale}>
      <mesh geometry={plate} material={plateMat} castShadow />
      <mesh position={[0, 0, DEPTH / 2 + 0.004]} material={faceMat}>
        <planeGeometry args={[FACE, FACE]} />
      </mesh>
    </group>
  )
}
