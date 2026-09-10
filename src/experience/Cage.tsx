import { useMemo } from 'react'
import * as THREE from 'three'
import { chainWithRepeat } from './textures'

const SIDES = 8
const RADIUS = 2.58
const POST_H = 1.92
const FENCE_H = 1.68
const POST_R = 0.055
const KICK_H = 0.28
const ANGLE0 = Math.PI / 8

function Steel({ color = '#1c1c1c' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.42} roughness={0.44} />
}

function Pad({ color = '#161616' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.86} metalness={0.06} />
}

function octagonPoint(i: number, radius = RADIUS) {
  const a = (i / SIDES) * Math.PI * 2 + ANGLE0
  return { x: Math.cos(a) * radius, z: Math.sin(a) * radius }
}

function CageFence({
  width,
  height,
  position,
  rotation,
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation: [number, number, number]
}) {
  const alpha = useMemo(() => chainWithRepeat(5, 4), [])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#8d8980"
        metalness={0.22}
        roughness={0.4}
        alphaMap={alpha}
        alphaTest={0.5}
        depthWrite
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  )
}

export function OctagonCage({
  position,
  scale = 1,
}: {
  position: [number, number, number]
  scale?: number
}) {
  const sides = Array.from({ length: SIDES }, (_, i) => {
    const a = octagonPoint(i)
    const b = octagonPoint(i + 1)
    const midX = (a.x + b.x) / 2
    const midZ = (a.z + b.z) / 2
    const span = Math.hypot(b.x - a.x, b.z - a.z)
    const len = Math.hypot(midX, midZ) || 1
    const nx = midX / len
    const nz = midZ / len
    const rotY = Math.atan2(nx, nz)
    const inset = POST_R + 0.02
    return {
      i,
      ax: a.x,
      az: a.z,
      midX: midX - nx * inset,
      midZ: midZ - nz * inset,
      railX: midX - nx * 0.01,
      railZ: midZ - nz * 0.01,
      span: Math.max(0.2, span - POST_R * 2.2),
      railSpan: span,
      rotY,
    }
  })

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.05, 0]} rotation={[0, ANGLE0, 0]}>
        <cylinderGeometry args={[RADIUS - 0.08, RADIUS - 0.08, 0.1, SIDES]} />
        <meshStandardMaterial color="#1a1212" roughness={0.92} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.11, 0]} rotation={[0, ANGLE0, 0]}>
        <cylinderGeometry args={[RADIUS - 0.22, RADIUS - 0.22, 0.02, SIDES]} />
        <meshStandardMaterial color="#241818" roughness={0.9} metalness={0.05} />
      </mesh>

      {sides.map((side) => (
        <group key={side.i}>
          <mesh position={[side.ax, POST_H / 2, side.az]}>
            <cylinderGeometry args={[0.07, 0.07, POST_H, 8]} />
            <Steel color="#3a3a38" />
          </mesh>
          <mesh position={[side.ax, POST_H + 0.055, side.az]}>
            <cylinderGeometry args={[0.085, 0.085, 0.11, 8]} />
            {side.i === 1 || side.i === 2 ? (
              <meshStandardMaterial
                color="#2a0c0c"
                emissive="#ff2414"
                emissiveIntensity={1.15}
                roughness={0.55}
                metalness={0.12}
              />
            ) : (
              <Pad color="#2a2a2a" />
            )}
          </mesh>

          <mesh position={[side.railX, KICK_H / 2, side.railZ]} rotation={[0, side.rotY, 0]}>
            <boxGeometry args={[side.railSpan, KICK_H, 0.06]} />
            <Pad color="#141414" />
          </mesh>

          <CageFence
            width={side.span}
            height={FENCE_H}
            position={[side.midX, KICK_H + FENCE_H / 2, side.midZ]}
            rotation={[0, side.rotY, 0]}
          />

          <mesh position={[side.railX, 1.02, side.railZ]} rotation={[0, side.rotY, 0]}>
            <boxGeometry args={[side.railSpan, 0.045, 0.055]} />
            <Steel color="#222" />
          </mesh>
          <mesh position={[side.railX, POST_H - 0.02, side.railZ]} rotation={[0, side.rotY, 0]}>
            <boxGeometry args={[side.railSpan, 0.09, 0.09]} />
            <Pad color="#121212" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
