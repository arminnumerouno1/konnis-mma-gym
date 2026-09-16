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

function Steel({ color = '#6a6660' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.48} roughness={0.38} fog={false} />
}

function Pad({ color = '#3a3836' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.86} metalness={0.06} fog={false} />
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
  repeat = [5, 4],
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation: [number, number, number]
  repeat?: [number, number]
}) {
  const [repeatX, repeatY] = repeat
  const alpha = useMemo(() => chainWithRepeat(repeatX, repeatY), [repeatX, repeatY])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#d2cec6"
        metalness={0.22}
        roughness={0.4}
        alphaMap={alpha}
        alphaTest={0.5}
        depthWrite
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
        fog={false}
      />
    </mesh>
  )
}

const AISLE_POST_H = 1.92
const AISLE_FENCE_H = 1.62
const AISLE_KICK = 0.26

/** Chain-link run the camera walks through after the mats, toward NO EGOS. */
export function CageAisle({
  x = 1.28,
  z0 = -19.42,
  z1 = -25.28,
}: {
  x?: number
  z0?: number
  z1?: number
}) {
  const zMin = Math.min(z0, z1)
  const zMax = Math.max(z0, z1)
  const length = zMax - zMin
  const zMid = (zMin + zMax) / 2
  const zs = [0, 0.25, 0.5, 0.75, 1].map((u) => zMin + length * u)
  const fenceRepeat: [number, number] = [Math.max(8, Math.round(length * 1.85)), 4]

  return (
    <group>
      {([-x, x] as const).map((side) => (
        <group key={side}>
          {zs.map((z, i) => (
            <group key={z}>
              <mesh position={[side, AISLE_POST_H / 2, z]}>
                <cylinderGeometry args={[0.065, 0.065, AISLE_POST_H, 8]} />
                <Steel color="#8a8680" />
              </mesh>
              <mesh position={[side, AISLE_POST_H + 0.05, z]}>
                <cylinderGeometry args={[0.08, 0.08, 0.1, 8]} />
                {i >= zs.length - 2 ? (
                  <meshStandardMaterial
                    color="#2a0c0c"
                    emissive="#ff2414"
                    emissiveIntensity={1.05}
                    roughness={0.55}
                    metalness={0.12}
                    fog={false}
                  />
                ) : (
                  <Pad color="#4a4844" />
                )}
              </mesh>
            </group>
          ))}
          <mesh position={[side, AISLE_KICK / 2, zMid]}>
            <boxGeometry args={[0.07, AISLE_KICK, length]} />
            <Pad color="#3a3632" />
          </mesh>
          <CageFence
            width={length - 0.12}
            height={AISLE_FENCE_H}
            position={[side, AISLE_KICK + AISLE_FENCE_H / 2, zMid]}
            rotation={[0, Math.PI / 2, 0]}
            repeat={fenceRepeat}
          />
          <mesh position={[side, 1.02, zMid]}>
            <boxGeometry args={[0.055, 0.045, length]} />
            <Steel />
          </mesh>
          <mesh position={[side, AISLE_POST_H - 0.02, zMid]}>
            <boxGeometry args={[0.09, 0.09, length]} />
            <Pad color="#3a3834" />
          </mesh>
        </group>
      ))}
    </group>
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
        <meshStandardMaterial color="#4a2a2a" roughness={0.9} metalness={0.04} fog={false} />
      </mesh>
      <mesh position={[0, 0.11, 0]} rotation={[0, ANGLE0, 0]}>
        <cylinderGeometry args={[RADIUS - 0.22, RADIUS - 0.22, 0.02, SIDES]} />
        <meshStandardMaterial color="#5a3030" roughness={0.88} metalness={0.05} fog={false} />
      </mesh>

      {sides.map((side) => (
        <group key={side.i}>
          <mesh position={[side.ax, POST_H / 2, side.az]}>
            <cylinderGeometry args={[0.07, 0.07, POST_H, 8]} />
            <Steel color="#8a8680" />
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
              <Pad color="#4a4844" />
            )}
          </mesh>

          <mesh position={[side.railX, KICK_H / 2, side.railZ]} rotation={[0, side.rotY, 0]}>
            <boxGeometry args={[side.railSpan, KICK_H, 0.06]} />
            <Pad color="#3a3632" />
          </mesh>

          <CageFence
            width={side.span}
            height={FENCE_H}
            position={[side.midX, KICK_H + FENCE_H / 2, side.midZ]}
            rotation={[0, side.rotY, 0]}
          />

          <mesh position={[side.railX, 1.02, side.railZ]} rotation={[0, side.rotY, 0]}>
            <boxGeometry args={[side.railSpan, 0.045, 0.055]} />
            <Steel />
          </mesh>
          <mesh position={[side.railX, POST_H - 0.02, side.railZ]} rotation={[0, side.rotY, 0]}>
            <boxGeometry args={[side.railSpan, 0.09, 0.09]} />
            <Pad color="#3a3834" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
