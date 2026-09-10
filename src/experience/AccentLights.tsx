import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleLights, type LightKey } from '../lib/cameraPath'
import type { QualityLevel } from '../lib/quality'
import { introReveal, scrollProgress } from '../store'

type Channel = Exclude<keyof LightKey, 't' | 'fog' | 'exposure'>

function Steel({ color = '#141414' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.4} roughness={0.48} />
}

function useChannel(channel: Channel, reveal?: boolean) {
  const amount = useRef(0)
  useFrame(() => {
    const sampled = sampleLights(scrollProgress.current)[channel]
    amount.current = sampled * (reveal ? introReveal.value : 1)
  })
  return amount
}

function RedCore({
  channel,
  reveal,
  size = 0.05,
}: {
  channel: Channel
  reveal?: boolean
  size?: number
}) {
  const amount = useChannel(channel, reveal)
  const core = useRef<THREE.MeshBasicMaterial>(null)
  const halo = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    const on = amount.current
    if (core.current) core.current.color.setRGB(1.0 * on, 0.16 * on, 0.08 * on)
    if (halo.current) halo.current.opacity = on * 0.16
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[size, 10, 10]} />
        <meshBasicMaterial ref={core} color="#000" toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 3.4, 10, 10]} />
        <meshBasicMaterial
          ref={halo}
          color="#ff2a14"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function HangLamp({ position, channel }: { position: [number, number, number]; channel: Channel }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, 0.55, 6]} />
        <Steel />
      </mesh>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.16, 8]} />
        <Steel color="#101010" />
      </mesh>
      <group position={[0, -0.42, 0]}>
        <RedCore channel={channel} size={0.055} />
      </group>
    </group>
  )
}

function WallSconce({
  position,
  rotation = [0, 0, 0],
  channel,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  channel: Channel
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[0.16, 0.28, 0.08]} />
        <Steel color="#121212" />
      </mesh>
      <group position={[0, 0, 0.05]}>
        <RedCore channel={channel} size={0.042} />
      </group>
    </group>
  )
}

function GroundFlood({
  position,
  rotation = [0, 0, 0],
  channel,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  channel: Channel
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[0.28, 0.16, 0.42]} />
        <Steel color="#161616" />
      </mesh>
      <group position={[0, 0.14, 0.02]} rotation={[-0.55, 0, 0]}>
        <RedCore channel={channel} size={0.05} />
      </group>
    </group>
  )
}

function RedVolume({
  position,
  channel,
  scale = [1, 1, 1],
}: {
  position: [number, number, number]
  channel: Channel
  scale?: [number, number, number]
}) {
  const amount = useChannel(channel)
  const mat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (mat.current) mat.current.opacity = amount.current * 0.045
  })

  return (
    <mesh position={position} rotation={[Math.PI, 0, 0]} scale={scale}>
      <coneGeometry args={[1.05, 3.4, 14, 1, true]} />
      <meshBasicMaterial
        ref={mat}
        color="#ff2a14"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  )
}

export function AccentLights({ quality }: { quality: QualityLevel }) {
  return (
    <group>
      <HangLamp position={[-1.2, 6.28, -16.9]} channel="gym" />
      <HangLamp position={[0, 6.28, -20.55]} channel="gym" />
      {quality !== 'low' && <HangLamp position={[0, 6.28, -50.2]} channel="gym" />}
      <HangLamp position={[0.15, 6.22, -66.8]} channel="side" />

      <WallSconce position={[-7.52, 2.05, -18.4]} rotation={[0, Math.PI / 2, 0]} channel="gym" />
      <WallSconce position={[-4.15, 2.55, -25.45]} channel="gym" />
      <WallSconce position={[7.52, 1.92, -33.6]} rotation={[0, -Math.PI / 2, 0]} channel="gym" />
      <WallSconce position={[-7.52, 1.78, -66.2]} rotation={[0, Math.PI / 2, 0]} channel="side" />

      <HangLamp position={[0, 6.22, -94]} channel="city" />
      <GroundFlood position={[-2.8, 0.1, -91.4]} rotation={[0, 0.22, 0]} channel="city" />
      <GroundFlood position={[2.8, 0.1, -91.4]} rotation={[0, -0.22, 0]} channel="city" />
      {quality !== 'low' && <GroundFlood position={[0, 0.1, -90.6]} channel="city" />}

      {quality !== 'low' && (
        <>
          <RedVolume position={[-1.2, 4.35, -16.9]} channel="gym" scale={[1.55, 1.05, 1.55]} />
          <RedVolume position={[0.15, 4.3, -66.8]} channel="side" scale={[0.82, 0.95, 0.82]} />
          <RedVolume position={[0, 4.35, -94]} channel="city" scale={[1.35, 1.1, 1.35]} />
        </>
      )}
    </group>
  )
}
