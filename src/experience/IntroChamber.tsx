import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { smoothstep } from '../lib/math'
import { scrollProgress } from '../store'

export function IntroChamber() {
  const wall = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    const fade = 1 - smoothstep(0.13, 0.21, scrollProgress.current)
    if (wall.current) wall.current.visible = fade > 0.02
    if (mat.current) mat.current.opacity = fade
  })

  return (
    <mesh ref={wall} position={[0, 1.1, -2.15]}>
      <planeGeometry args={[28, 16]} />
      <meshBasicMaterial ref={mat} color="#050505" transparent depthWrite={false} />
    </mesh>
  )
}
