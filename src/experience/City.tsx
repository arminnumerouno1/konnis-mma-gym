import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { scrollProgress, useExperience } from '../store'
import { sharedNoise } from './textures'
import { TypeInSpace } from './TypeInSpace'

const TERRACE_Y = 1.34
const CRYPT_H = 1.9
const CRYPT_W = 6.72
const HALL_H = 3.18
const HALL_W = 5.18
const DOME_Y = TERRACE_Y + CRYPT_H + 0.18 + HALL_H

const DOME_PROFILE = [
  new THREE.Vector2(2.58, 0),
  new THREE.Vector2(2.8, 0.36),
  new THREE.Vector2(2.74, 0.88),
  new THREE.Vector2(2.5, 1.55),
  new THREE.Vector2(2.08, 2.22),
  new THREE.Vector2(1.48, 2.78),
  new THREE.Vector2(1.02, 3.16),
  new THREE.Vector2(0.9, 3.42),
  new THREE.Vector2(0.88, 3.58),
]

function Granite({
  color = '#9a8f82',
  emissive = '#241f18',
  emissiveIntensity = 0.22,
}: {
  color?: string
  emissive?: string
  emissiveIntensity?: number
}) {
  const map = sharedNoise()
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.9}
      metalness={0.07}
      roughnessMap={map}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  )
}

function Void() {
  return <meshStandardMaterial color="#0c0b09" roughness={1} metalness={0} />
}

function ArchVoid({
  width,
  height,
  depth,
  position,
  rotation = [0, 0, 0],
}: {
  width: number
  height: number
  depth: number
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  const radius = width * 0.5
  const shaft = Math.max(0.12, height - radius)
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, shaft * 0.5, 0]}>
        <boxGeometry args={[width, shaft, depth]} />
        <Void />
      </mesh>
      <mesh position={[0, shaft, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, depth, 14, 1]} />
        <Void />
      </mesh>
    </group>
  )
}

function Windows({
  z,
  y,
  spacing,
  rotation = [0, 0, 0],
}: {
  z: number
  y: number
  spacing: number
  rotation?: [number, number, number]
}) {
  return (
    <group rotation={rotation}>
      {[-spacing, 0, spacing].map((x) => (
        <mesh key={x} position={[x, y, z]}>
          <boxGeometry args={[0.28, 0.5, 0.12]} />
          <meshStandardMaterial color="#14110e" roughness={0.85} emissive="#2a2418" emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  )
}

function Guardian({ angle, radius, y }: { angle: number; radius: number; y: number }) {
  return (
    <group position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]} rotation={[0.28, Math.PI / 2 - angle, 0]}>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[0.62, 1.58, 0.42]} />
        <Granite color="#7a7164" emissiveIntensity={0.16} />
      </mesh>
      <mesh position={[0, 1.48, 0.02]}>
        <boxGeometry args={[0.88, 0.28, 0.48]} />
        <Granite color="#6f675c" emissiveIntensity={0.14} />
      </mesh>
      <mesh position={[0, 1.72, 0.14]} rotation={[0.62, 0, 0]}>
        <boxGeometry args={[0.32, 0.32, 0.34]} />
        <Granite color="#8a8174" />
      </mesh>
      <mesh position={[0, 0.12, 0.34]}>
        <boxGeometry args={[0.07, 1.72, 0.07]} />
        <meshStandardMaterial color="#4a4034" metalness={0.42} roughness={0.4} emissive="#2a2418" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 0.95, 0.34]}>
        <boxGeometry args={[0.2, 0.06, 0.06]} />
        <meshStandardMaterial color="#4a4034" metalness={0.42} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Michael() {
  const bronze = '#6a5134'
  return (
    <group position={[0, TERRACE_Y + 0.12, CRYPT_W * 0.5 + 0.18]} scale={1.35}>
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[0.48, 1.38, 0.3]} />
        <meshStandardMaterial color={bronze} metalness={0.48} roughness={0.42} emissive="#3a2814" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[0, 1.58, 0.05]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.26, 0.26, 0.24]} />
        <meshStandardMaterial color="#7a5e3c" metalness={0.46} roughness={0.44} emissive="#3a2814" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.18, 0.02]} rotation={[0, 0, 0.58]}>
        <boxGeometry args={[0.92, 0.12, 0.38]} />
        <meshStandardMaterial color="#5a442c" metalness={0.4} roughness={0.5} emissive="#2a1c10" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 1.18, 0.02]} rotation={[0, 0, -0.58]}>
        <boxGeometry args={[0.92, 0.12, 0.38]} />
        <meshStandardMaterial color="#5a442c" metalness={0.4} roughness={0.5} emissive="#2a1c10" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0.2, 1.05, 0.18]} rotation={[0.12, 0, -0.22]}>
        <boxGeometry args={[0.06, 1.35, 0.06]} />
        <meshStandardMaterial color="#3a2c1c" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Monument({ quality }: { quality: QualityLevel }) {
  const segments = quality === 'low' ? 12 : 28
  const steps = quality === 'low' ? 8 : 14
  const guardians = 12

  const dome = useMemo(() => {
    const geometry = new THREE.LatheGeometry(DOME_PROFILE, segments)
    geometry.computeVertexNormals()
    return geometry
  }, [segments])

  const hallY = TERRACE_Y + CRYPT_H + 0.16 + HALL_H * 0.5
  const cryptY = TERRACE_Y + CRYPT_H * 0.5

  return (
    <group>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[6.1, 8.6, 0.84, segments]} />
        <Granite color="#5c564e" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[5.15, 6.15, 0.55, segments]} />
        <Granite color="#6a6358" emissiveIntensity={0.1} />
      </mesh>

      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[8.55, 0.42, 8.55]} />
        <Granite color="#6e675c" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[7.85, 0.36, 7.85]} />
        <Granite color="#7a7266" />
      </mesh>
      <mesh position={[0, TERRACE_Y - 0.04, 0]}>
        <boxGeometry args={[7.25, 0.18, 7.25]} />
        <Granite color="#6f675c" />
      </mesh>

      {Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1)
        const y = 0.08 + t * (TERRACE_Y - 0.16)
        const z = 8.45 - t * 4.85
        const w = 7.35 - t * 1.05
        return (
          <mesh key={i} position={[0, y, z]}>
            <boxGeometry args={[w, 0.16, 0.42]} />
            <Granite color="#8a8174" />
          </mesh>
        )
      })}

      <mesh position={[0, 0.06, 6.15]}>
        <boxGeometry args={[6.7, 0.14, 0.55]} />
        <Granite color="#5e574e" />
      </mesh>

      <mesh position={[0, cryptY, 0]}>
        <boxGeometry args={[CRYPT_W, CRYPT_H, CRYPT_W]} />
        <Granite color="#81776b" />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z]) => (
        <mesh key={`crypt-p-${x}-${z}`} position={[(CRYPT_W * 0.5 - 0.18) * x, cryptY, (CRYPT_W * 0.5 - 0.18) * z]}>
          <boxGeometry args={[0.42, CRYPT_H + 0.08, 0.42]} />
          <Granite color="#6e675c" />
        </mesh>
      ))}
      <ArchVoid width={2.15} height={1.55} depth={0.7} position={[0, TERRACE_Y + 0.08, CRYPT_W * 0.5 - 0.08]} />
      <ArchVoid
        width={1.7}
        height={1.28}
        depth={0.55}
        position={[CRYPT_W * 0.5 - 0.08, TERRACE_Y + 0.08, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <ArchVoid
        width={1.7}
        height={1.28}
        depth={0.55}
        position={[-CRYPT_W * 0.5 + 0.08, TERRACE_Y + 0.08, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <mesh position={[0, cryptY, 0]}>
        <boxGeometry args={[CRYPT_W - 1.35, CRYPT_H - 0.35, CRYPT_W - 1.35]} />
        <Void />
      </mesh>
      <Michael />

      <mesh position={[0, TERRACE_Y + CRYPT_H + 0.05, 0]}>
        <boxGeometry args={[7.05, 0.16, 7.05]} />
        <Granite color="#6a6358" />
      </mesh>

      <mesh position={[0, hallY, 0]}>
        <boxGeometry args={[HALL_W, HALL_H, HALL_W]} />
        <Granite color="#a3988a" emissiveIntensity={0.24} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z]) => (
        <mesh key={`hall-p-${x}-${z}`} position={[(HALL_W * 0.5 - 0.16) * x, hallY, (HALL_W * 0.5 - 0.16) * z]}>
          <boxGeometry args={[0.4, HALL_H + 0.12, 0.4]} />
          <Granite color="#746c60" />
        </mesh>
      ))}
      <ArchVoid width={2.35} height={2.25} depth={0.72} position={[0, TERRACE_Y + CRYPT_H + 0.22, HALL_W * 0.5 - 0.06]} />
      <ArchVoid
        width={2.35}
        height={2.25}
        depth={0.72}
        position={[0, TERRACE_Y + CRYPT_H + 0.22, -HALL_W * 0.5 + 0.06]}
      />
      <ArchVoid
        width={2.35}
        height={2.25}
        depth={0.72}
        position={[HALL_W * 0.5 - 0.06, TERRACE_Y + CRYPT_H + 0.22, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <ArchVoid
        width={2.35}
        height={2.25}
        depth={0.72}
        position={[-HALL_W * 0.5 + 0.06, TERRACE_Y + CRYPT_H + 0.22, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      {quality !== 'low' && (
        <>
          <Windows z={HALL_W * 0.5 + 0.01} y={hallY + 1.05} spacing={0.48} />
          <Windows z={-HALL_W * 0.5 - 0.01} y={hallY + 1.05} spacing={0.48} />
          <Windows z={HALL_W * 0.5 + 0.01} y={hallY + 1.05} spacing={0.48} rotation={[0, Math.PI / 2, 0]} />
          <Windows z={-HALL_W * 0.5 - 0.01} y={hallY + 1.05} spacing={0.48} rotation={[0, Math.PI / 2, 0]} />
        </>
      )}
      <mesh position={[0, hallY, 0]}>
        <boxGeometry args={[HALL_W - 1.5, HALL_H - 0.5, HALL_W - 1.5]} />
        <Void />
      </mesh>

      <mesh position={[0, TERRACE_Y + CRYPT_H + 0.16 + HALL_H + 0.05, 0]}>
        <boxGeometry args={[5.85, 0.16, 5.85]} />
        <Granite color="#6f675c" />
      </mesh>
      <mesh position={[0, DOME_Y + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.68, 0.2, 8, segments]} />
        <Granite color="#746c60" />
      </mesh>

      <mesh position={[0, DOME_Y, 0]} geometry={dome}>
        <Granite color="#a09080" emissiveIntensity={0.24} />
      </mesh>

      {Array.from({ length: guardians }, (_, i) => (
        <Guardian key={i} angle={(i / guardians) * Math.PI * 2 + Math.PI / 12} radius={2.78} y={DOME_Y + 0.02} />
      ))}

      <mesh position={[0, DOME_Y + 3.62, 0]}>
        <boxGeometry args={[1.92, 0.22, 1.92]} />
        <Granite color="#7a7266" />
      </mesh>
      <mesh position={[0, DOME_Y + 3.82, 0]}>
        <boxGeometry args={[2.08, 0.2, 2.08]} />
        <Granite color="#6a6358" />
      </mesh>
      {[
        [0.96, 0.96],
        [0.96, -0.96],
        [-0.96, 0.96],
        [-0.96, -0.96],
      ].map(([x, z]) => (
        <mesh key={`cap-${x}-${z}`} position={[x, DOME_Y + 3.92, z]}>
          <boxGeometry args={[0.2, 0.28, 0.2]} />
          <Granite color="#5e574e" />
        </mesh>
      ))}
    </group>
  )
}

function CityMark({ quality, compact }: { quality: QualityLevel; compact: boolean }) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = !compact && scrollProgress.current > 0.73
  })
  return (
    <group ref={ref} visible={false}>
      <TypeInSpace position={[0, 8.55, 7.6]} fontSize={1.38} quality={quality} letterSpacing={0.12}>
        {COPY.city}
      </TypeInSpace>
    </group>
  )
}

export function City({ quality }: { quality: QualityLevel }) {
  const compact = useExperience((s) => s.compact)

  return (
    <group position={[0, 0, compact ? -90 : -94]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 3]}>
        <planeGeometry args={[compact ? 22 : 34, compact ? 20 : 28]} />
        <meshStandardMaterial color="#10100e" roughness={0.97} metalness={0.04} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 11.55]}>
        <planeGeometry args={[10.4, 4.6]} />
        <meshStandardMaterial color="#1a2430" metalness={0.88} roughness={0.12} emissive="#243044" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[0, 0.09, 9.32]}>
        <boxGeometry args={[10.85, 0.16, 0.3]} />
        <Granite color="#5a544c" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 0.09, 13.78]}>
        <boxGeometry args={[10.85, 0.16, 0.3]} />
        <Granite color="#5a544c" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[-5.28, 0.09, 11.55]}>
        <boxGeometry args={[0.3, 0.16, 4.76]} />
        <Granite color="#5a544c" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[5.28, 0.09, 11.55]}>
        <boxGeometry args={[0.3, 0.16, 4.76]} />
        <Granite color="#5a544c" emissiveIntensity={0.1} />
      </mesh>

      <group scale={compact ? 0.86 : 1}>
        <Monument quality={quality} />
      </group>

      <CityMark quality={quality} compact={compact} />
    </group>
  )
}
