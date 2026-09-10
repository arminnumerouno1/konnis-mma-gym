import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
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

function HeavyBag({
  position,
  rotationY = 0,
  sway = 0.03,
  leather = '#1a0d0d',
}: {
  position: [number, number, number]
  rotationY?: number
  sway?: number
  leather?: string
}) {
  return (
    <group position={position} rotation={[0, rotationY, sway]}>
      <mesh position={[0, 4.92, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 3.05, 6]} />
        <Steel color="#111" />
      </mesh>
      <mesh position={[0, 3.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.042, 0.011, 8, 12]} />
        <Steel color="#2a2a2a" />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 2.48, 0]}>
          <boxGeometry args={[0.038, 0.32, 0.028]} />
          <meshStandardMaterial color="#241010" roughness={0.82} metalness={0.08} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]}>
        <capsuleGeometry args={[0.22, 1.18, 6, 12]} />
        <meshStandardMaterial color={leather} roughness={0.88} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <cylinderGeometry args={[0.228, 0.228, 0.11, 12]} />
        <meshStandardMaterial color="#6a1210" roughness={0.72} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.2, 0.175, 0.08, 12]} />
        <meshStandardMaterial color="#120808" roughness={0.9} metalness={0.06} />
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

const HERO_BAGS: { position: [number, number, number]; rotationY: number; sway: number; leather: string }[] = [
  { position: [-4.25, 0, -16.45], rotationY: 0.14, sway: 0.05, leather: '#1a0c0c' },
  { position: [-2.35, 0, -17.15], rotationY: -0.22, sway: -0.04, leather: '#160b0b' },
  { position: [-4.55, 0, -18.85], rotationY: 0.32, sway: 0.02, leather: '#1c0e0e' },
  { position: [-2.15, 0, -18.55], rotationY: -0.08, sway: -0.06, leather: '#140a0a' },
]

export function Gym({ quality }: GymProps) {
  const beams = quality === 'low' ? [-12, -24, -36, -48] : [-10, -18, -26, -34, -42, -50, -58]
  const wallBags = quality === 'low' ? 2 : 4
  const heroBags = quality === 'low' ? HERO_BAGS.slice(0, 3) : HERO_BAGS

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
      <LampFixture position={[-3.2, 6.35, -26]} />
      <LampFixture position={[3.1, 6.35, -38]} />
      <LampFixture position={[0, 6.35, -50]} />

      <mesh position={[-3.35, 6.55, -17.5]}>
        <boxGeometry args={[3.8, 0.08, 0.22]} />
        <Steel color="#141414" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.3, 0.025, -17.5]} receiveShadow>
        <planeGeometry args={[4.6, 4.8]} />
        <meshStandardMaterial color="#2a1012" roughness={0.95} metalness={0.02} />
      </mesh>
      {heroBags.map((bag) => (
        <HeavyBag key={bag.position.join(',')} {...bag} />
      ))}

      {Array.from({ length: wallBags }, (_, i) => (
        <HeavyBag key={`wall-${i}`} position={[4.55, 0, -22.4 - i * 2.1]} rotationY={0.08} sway={0.02} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.4, 0.025, -28]} receiveShadow>
        <planeGeometry args={[2.8, 3.2]} />
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
