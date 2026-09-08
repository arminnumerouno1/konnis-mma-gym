import { COPY } from '../brand/copy'
import { LEIPZIG_SKYLINE, type SkylineKind } from '../brand/skyline'
import type { QualityLevel } from '../lib/quality'
import { TypeInSpace } from './TypeInSpace'

const WIDTH = 30
const HEIGHT = 11.5

function BuildingMat({ kind }: { kind: SkylineKind }) {
  if (kind === 'highrise') {
    return <meshStandardMaterial color="#3a3936" metalness={0.72} roughness={0.42} />
  }
  if (kind === 'monument' || kind === 'block') {
    return <meshStandardMaterial color="#2f2e2b" metalness={0.28} roughness={0.78} />
  }
  return <meshStandardMaterial color="#353430" metalness={0.48} roughness={0.58} />
}

function Building({
  kind,
  w,
  h,
  quality,
}: {
  kind: SkylineKind
  w: number
  h: number
  quality: QualityLevel
}) {
  const depth = Math.max(0.7, w * 0.85)

  if (kind === 'spire') {
    return (
      <group>
        <mesh position={[0, h * 0.31, 0]}>
          <boxGeometry args={[w * 0.42, h * 0.62, depth * 0.42]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.8, 0]}>
          <coneGeometry args={[w * 0.28, h * 0.38, 4]} />
          <BuildingMat kind={kind} />
        </mesh>
      </group>
    )
  }

  if (kind === 'church') {
    return (
      <group>
        <mesh position={[0, h * 0.21, 0]}>
          <boxGeometry args={[w, h * 0.42, depth]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.62, 0]}>
          <boxGeometry args={[w * 0.38, h * 0.38, depth * 0.38]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.9, 0]}>
          <coneGeometry args={[w * 0.22, h * 0.22, 4]} />
          <BuildingMat kind={kind} />
        </mesh>
      </group>
    )
  }

  if (kind === 'rathaus') {
    return (
      <group>
        <mesh position={[0, h * 0.2, 0]}>
          <boxGeometry args={[w, h * 0.4, depth]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.58, 0]}>
          <boxGeometry args={[w * 0.28, h * 0.38, depth * 0.28]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.88, 0]}>
          <coneGeometry args={[w * 0.16, h * 0.22, 4]} />
          <BuildingMat kind={kind} />
        </mesh>
      </group>
    )
  }

  if (kind === 'highrise') {
    return (
      <group>
        <mesh position={[0, h * 0.48, 0]}>
          <boxGeometry args={[w, h * 0.96, depth]} />
          <BuildingMat kind={kind} />
        </mesh>
        {quality !== 'low' &&
          Array.from({ length: 7 }, (_, row) =>
            Array.from({ length: 3 }, (_, col) => (
              <mesh
                key={`${row}-${col}`}
                position={[
                  (col - 1) * (w * 0.26),
                  0.7 + row * (h * 0.12),
                  depth / 2 + 0.02,
                ]}
              >
                <boxGeometry args={[w * 0.14, 0.14, 0.03]} />
                <meshStandardMaterial
                  color="#0a0a0a"
                  emissive="#1c1b18"
                  emissiveIntensity={0.35}
                  roughness={0.4}
                />
              </mesh>
            )),
          )}
      </group>
    )
  }

  if (kind === 'monument') {
    return (
      <group>
        <mesh position={[0, h * 0.14, 0]}>
          <boxGeometry args={[w, h * 0.28, depth]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.42, 0]}>
          <boxGeometry args={[w * 0.68, h * 0.28, depth * 0.68]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.68, 0]}>
          <boxGeometry args={[w * 0.4, h * 0.24, depth * 0.4]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.88, 0]}>
          <coneGeometry args={[w * 0.16, h * 0.16, 4]} />
          <BuildingMat kind={kind} />
        </mesh>
      </group>
    )
  }

  if (kind === 'dome') {
    return (
      <group>
        <mesh position={[0, h * 0.22, 0]}>
          <boxGeometry args={[w, h * 0.44, depth]} />
          <BuildingMat kind={kind} />
        </mesh>
        <mesh position={[0, h * 0.58, 0]}>
          <sphereGeometry args={[w * 0.38, 10, 8]} />
          <BuildingMat kind={kind} />
        </mesh>
      </group>
    )
  }

  return (
    <mesh position={[0, h * 0.5, 0]}>
      <boxGeometry args={[w, h, depth]} />
      <BuildingMat kind={kind} />
    </mesh>
  )
}

export function City({ quality }: { quality: QualityLevel }) {
  return (
    <group position={[0, 0, -94]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]}>
        <planeGeometry args={[42, 18]} />
        <meshStandardMaterial color="#10100f" roughness={0.95} metalness={0.08} />
      </mesh>

      {LEIPZIG_SKYLINE.map((b) => (
        <group key={b.id} position={[(b.x + b.w / 2 - 0.5) * WIDTH, 0, (Math.sin(b.x * 12) * 0.6)]}>
          <Building kind={b.kind} w={Math.max(0.7, b.w * WIDTH)} h={b.h * HEIGHT} quality={quality} />
        </group>
      ))}

      <TypeInSpace position={[0, 3.8, 8.6]} fontSize={2.8} quality={quality} letterSpacing={0.12}>
        {COPY.city}
      </TypeInSpace>
    </group>
  )
}
