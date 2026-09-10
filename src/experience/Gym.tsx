import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { Arrival } from './Arrival'
import { TypeInSpace } from './TypeInSpace'
import { sharedNoise } from './textures'

type GymProps = {
  quality: QualityLevel
}

function Steel({ color = '#1a1a1a' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.38} roughness={0.46} />
}

function Concrete({ color = '#1b1b19' }: { color?: string }) {
  const map = sharedNoise()
  return (
    <meshStandardMaterial color={color} roughness={0.96} metalness={0.04} roughnessMap={map} />
  )
}

function ThaiPad({
  position,
  rotationY = 0,
  color,
}: {
  position: [number, number, number]
  rotationY?: number
  color: string
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[0.3, 0.62, 0.11]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.09, 0.1, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.08} />
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
        <meshStandardMaterial color="#f0ebe2" emissive="#f0ebe2" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
    </group>
  )
}

const PADS: { z: number; color: string }[] = [
  { z: -20.4, color: '#8a1812' },
  { z: -21.35, color: '#1c1c1c' },
  { z: -22.3, color: '#8a1812' },
  { z: -23.25, color: '#d8cfc2' },
]

export function Gym({ quality }: GymProps) {
  const beams = quality === 'low' ? [-12, -24, -36, -48] : [-10, -18, -26, -34, -42, -50, -58]
  const pads = quality === 'low' ? PADS.slice(0, 3) : PADS

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -34]} receiveShadow>
        <planeGeometry args={[22, 68]} />
        <Concrete color="#141412" />
      </mesh>

      <mesh position={[-7.9, 3.4, -34]}>
        <boxGeometry args={[0.45, 6.8, 56]} />
        <Concrete color="#171714" />
      </mesh>
      <mesh position={[7.9, 3.4, -34]}>
        <boxGeometry args={[0.45, 6.8, 56]} />
        <Concrete color="#161613" />
      </mesh>
      <mesh position={[0, 6.95, -34]}>
        <boxGeometry args={[16.4, 0.18, 56]} />
        <meshStandardMaterial color="#0c0c0b" roughness={0.9} metalness={0.15} />
      </mesh>

      {[-8, 8].map((x) =>
        [-16, -32, -48].map((z) => (
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
      <LampFixture position={[-1.2, 6.35, -16.9]} />
      <LampFixture position={[-3.2, 6.35, -26]} />
      <LampFixture position={[3.1, 6.35, -38]} />
      <LampFixture position={[0, 6.35, -50]} />

      <Arrival position={[-1.2, 0, -16.9]} />

      <TypeInSpace
        position={[-1.2, 0.07, -18.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.78}
        quality={quality}
        letterSpacing={0.1}
      >
        {COPY.showUp}
      </TypeInSpace>

      <mesh position={[7.52, 2.35, -21.8]}>
        <boxGeometry args={[0.06, 0.08, 3.4]} />
        <Steel color="#141414" />
      </mesh>
      {pads.map((pad) => (
        <ThaiPad key={pad.z} position={[7.35, 1.72, pad.z]} rotationY={-Math.PI / 2} color={pad.color} />
      ))}

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

      <mesh position={[-6.4, 2.6, -61.8]}>
        <boxGeometry args={[1.2, 5.2, 0.55]} />
        <Concrete color="#181816" />
      </mesh>
      <mesh position={[6.4, 2.6, -61.8]}>
        <boxGeometry args={[1.2, 5.2, 0.55]} />
        <Concrete color="#181816" />
      </mesh>
      <mesh position={[0, 5.35, -61.8]}>
        <boxGeometry args={[14.2, 0.45, 0.55]} />
        <Steel color="#161616" />
      </mesh>
    </group>
  )
}
