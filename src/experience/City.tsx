import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { scrollProgress, useExperience } from '../store'
import { OctagonCage } from './Cage'
import { TypeInSpace } from './TypeInSpace'
import { sharedNoise } from './textures'

function Steel({ color = '#1a1a1a' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.38} roughness={0.46} />
}

function Concrete({ color = '#1b1b19' }: { color?: string }) {
  const map = sharedNoise()
  return (
    <meshStandardMaterial color={color} roughness={0.96} metalness={0.04} roughnessMap={map} />
  )
}

function CityMark({ quality, compact }: { quality: QualityLevel; compact: boolean }) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = !compact && scrollProgress.current > 0.73
  })
  return (
    <group ref={ref} visible={false}>
      <TypeInSpace position={[0, 2.72, -6.05]} fontSize={1.12} quality={quality} letterSpacing={0.12}>
        {COPY.city}
      </TypeInSpace>
    </group>
  )
}

export function City({ quality }: { quality: QualityLevel }) {
  const compact = useExperience((s) => s.compact)

  return (
    <group position={[0, 0, -94]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 22]} />
        <Concrete color="#141412" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[3.55, 24]} />
        <meshStandardMaterial color="#2a1012" roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[-8.15, 3.4, 0]}>
        <boxGeometry args={[0.42, 6.8, 20]} />
        <Concrete color="#171714" />
      </mesh>
      <mesh position={[8.15, 3.4, 0]}>
        <boxGeometry args={[0.42, 6.8, 20]} />
        <Concrete color="#161613" />
      </mesh>
      <mesh position={[-6.55, 2.6, -8.85]}>
        <boxGeometry args={[3.4, 5.2, 0.55]} />
        <Concrete color="#181816" />
      </mesh>
      <mesh position={[6.55, 2.6, -8.85]}>
        <boxGeometry args={[3.4, 5.2, 0.55]} />
        <Concrete color="#181816" />
      </mesh>
      <mesh position={[0, 5.55, -8.85]}>
        <boxGeometry args={[16.8, 2.5, 0.55]} />
        <Concrete color="#161613" />
      </mesh>
      <mesh position={[0, 6.95, 0]}>
        <boxGeometry args={[16.8, 0.18, 20]} />
        <meshStandardMaterial color="#0c0c0b" roughness={0.9} metalness={0.15} />
      </mesh>

      {[-8, 8].map((x) =>
        [-6.4, 6.4].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 3.3, z]}>
            <boxGeometry args={[0.55, 6.6, 0.55]} />
            <Concrete color="#1a1a17" />
          </mesh>
        )),
      )}

      {[-6, 0, 6].map((z) => (
        <group key={z} position={[0, 6.62, z]}>
          <mesh>
            <boxGeometry args={[15.6, 0.08, 0.3]} />
            <Steel color="#141414" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[15.6, 0.05, 0.12]} />
            <Steel color="#101010" />
          </mesh>
        </group>
      ))}

      <OctagonCage position={[0, 0, 0]} scale={compact ? 0.92 : 1.08} />
      <CityMark quality={quality} compact={compact} />
    </group>
  )
}
