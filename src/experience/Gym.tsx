import { useMemo } from 'react'
import * as THREE from 'three'
import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { TypeInSpace } from './TypeInSpace'
import { chainWithRepeat, sharedNoise } from './textures'

type GymProps = {
  quality: QualityLevel
}

function Steel({ color = '#1a1a1a' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.82} roughness={0.38} />
}

function Concrete({ color = '#1b1b19' }: { color?: string }) {
  const map = sharedNoise()
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.96}
      metalness={0.04}
      roughnessMap={map}
    />
  )
}

function CagePanel({
  width,
  height,
  position,
  rotation,
  repeat,
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation?: [number, number, number]
  repeat: [number, number]
}) {
  const alpha = useMemo(() => chainWithRepeat(repeat[0], repeat[1]), [repeat])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#c9c4ba"
        metalness={0.78}
        roughness={0.32}
        alphaMap={alpha}
        transparent
        alphaTest={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function OctagonCage({ position }: { position: [number, number, number] }) {
  const radius = 2.35
  const sides = 8
  return (
    <group position={position}>
      {Array.from({ length: sides }, (_, i) => {
        const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8
        const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8
        const x0 = Math.cos(a0) * radius
        const z0 = Math.sin(a0) * radius
        const x1 = Math.cos(a1) * radius
        const z1 = Math.sin(a1) * radius
        const midX = (x0 + x1) / 2
        const midZ = (z0 + z1) / 2
        const span = Math.hypot(x1 - x0, z1 - z0)
        const rot = Math.atan2(x1 - x0, z1 - z0)
        return (
          <group key={i}>
            <mesh position={[x0, 1.28, z0]}>
              <cylinderGeometry args={[0.045, 0.045, 2.56, 6]} />
              <Steel color="#1f1f1f" />
            </mesh>
            <CagePanel
              width={span}
              height={2.4}
              position={[midX, 1.28, midZ]}
              rotation={[0, rot, 0]}
              repeat={[5, 5]}
            />
          </group>
        )
      })}
      {Array.from({ length: sides }, (_, i) => {
        const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8
        const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8
        const x0 = Math.cos(a0) * radius
        const z0 = Math.sin(a0) * radius
        const x1 = Math.cos(a1) * radius
        const z1 = Math.sin(a1) * radius
        const midX = (x0 + x1) / 2
        const midZ = (z0 + z1) / 2
        const span = Math.hypot(x1 - x0, z1 - z0)
        const rot = Math.atan2(x1 - x0, z1 - z0)
        return (
          <mesh key={`ring-${i}`} position={[midX, 2.58, midZ]} rotation={[0, rot, 0]}>
            <boxGeometry args={[span, 0.07, 0.07]} />
            <Steel color="#242424" />
          </mesh>
        )
      })}
    </group>
  )
}

function HeavyBag({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 3.35, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.5, 6]} />
        <Steel color="#111" />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <capsuleGeometry args={[0.2, 1.12, 4, 8]} />
        <meshStandardMaterial color="#1a0d0d" roughness={0.88} metalness={0.08} />
      </mesh>
    </group>
  )
}

function IBeam({ z }: { z: number }) {
  return (
    <group position={[0, 6.62, z]}>
      <mesh>
        <boxGeometry args={[15.6, 0.08, 0.3]} />
        <Steel color="#141414" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[15.6, 0.05, 0.12]} />
        <Steel color="#101010" />
      </mesh>
    </group>
  )
}

function LampFixture({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.16, 0.22, 0.14, 8]} />
        <Steel color="#121212" />
      </mesh>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.03, 8]} />
        <meshStandardMaterial color="#f0ebe2" emissive="#f0ebe2" emissiveIntensity={1.8} />
      </mesh>
    </group>
  )
}

export function Gym({ quality }: GymProps) {
  const beams = quality === 'low' ? [-12, -24, -36, -48, -60] : [-10, -18, -26, -34, -42, -50, -58, -66]
  const bags = quality === 'low' ? 2 : 4

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -42]} receiveShadow>
        <planeGeometry args={[22, 88]} />
        <Concrete color="#141412" />
      </mesh>

      <mesh position={[-7.9, 3.4, -40]}>
        <boxGeometry args={[0.45, 6.8, 68]} />
        <Concrete color="#171714" />
      </mesh>
      <mesh position={[7.9, 3.4, -40]}>
        <boxGeometry args={[0.45, 6.8, 68]} />
        <Concrete color="#161613" />
      </mesh>
      <mesh position={[0, 6.95, -40]}>
        <boxGeometry args={[16.4, 0.18, 68]} />
        <meshStandardMaterial color="#0c0c0b" roughness={0.9} metalness={0.15} />
      </mesh>

      {[-8, 8].map((x) =>
        [-16, -32, -48, -64].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 3.3, z]}>
            <boxGeometry args={[0.55, 6.6, 0.55]} />
            <Concrete color="#1a1a17" />
          </mesh>
        )),
      )}

      {beams.map((z) => (
        <IBeam key={z} z={z} />
      ))}

      <LampFixture position={[0, 6.35, -14]} />
      <LampFixture position={[-3.2, 6.35, -26]} />
      <LampFixture position={[3.1, 6.35, -38]} />
      <LampFixture position={[0, 6.35, -50]} />

      <CagePanel
        width={9}
        height={5.2}
        position={[0, 2.4, -7.2]}
        repeat={[16, 9]}
      />

      <OctagonCage position={[-3.1, 0, -18.5]} />

      {Array.from({ length: bags }, (_, i) => (
        <HeavyBag key={i} position={[3.4, 0, -16.5 - i * 2.1]} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.6, 0.025, -22]} receiveShadow>
        <planeGeometry args={[3.4, 3.4]} />
        <meshStandardMaterial color="#2a1012" roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.2, 0.02, -33]} receiveShadow>
        <planeGeometry args={[4.2, 3.6]} />
        <meshStandardMaterial color="#241010" roughness={0.96} metalness={0.02} />
      </mesh>

      <mesh position={[-2.8, 3.1, -14]}>
        <cylinderGeometry args={[0.018, 0.018, 4.4, 5]} />
        <Steel color="#2a2a2a" />
      </mesh>
      <mesh position={[2.4, 3.4, -30]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.016, 0.016, 5.2, 5]} />
        <Steel color="#262626" />
      </mesh>

      <mesh position={[0, 2.05, -25.6]}>
        <boxGeometry args={[8.4, 3.6, 0.22]} />
        <Concrete color="#1c1c18" />
      </mesh>

      <TypeInSpace position={[0, 2.15, -25.42]} fontSize={1.05} quality={quality} letterSpacing={0.06}>
        {COPY.noEgos}
      </TypeInSpace>

      <TypeInSpace
        position={[0, 0.04, -33.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.15}
        quality={quality}
        letterSpacing={0.08}
      >
        {COPY.justWork}
      </TypeInSpace>
    </group>
  )
}
