import * as THREE from 'three'
import type { QualityLevel } from '../lib/quality'

function Cone({
  position,
  rotation,
  scale,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
}) {
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <coneGeometry args={[1.15, 3.6, 16, 1, true]} />
      <meshBasicMaterial
        color="#e8e4da"
        transparent
        opacity={0.028}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function Volumetric({ quality }: { quality: QualityLevel }) {
  if (quality === 'low') return null
  return (
    <group>
      <Cone position={[0, 4.4, -14]} rotation={[Math.PI, 0, 0]} />
      <Cone position={[-3.2, 4.4, -26]} rotation={[Math.PI, 0, 0]} scale={[0.85, 1, 0.85]} />
      {quality === 'high' && <Cone position={[3.1, 4.4, -38]} rotation={[Math.PI, 0, 0]} scale={[0.75, 1, 0.75]} />}
    </group>
  )
}
