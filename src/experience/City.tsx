import { COPY } from '../brand/copy'
import { LEIPZIG_SKYLINE, makeSkylineTexture, type SkylineKind } from '../brand/skyline'
import type { QualityLevel } from '../lib/quality'
import { TypeInSpace } from './TypeInSpace'
import { useExperience } from '../store'
import { useMemo } from 'react'

function BuildingMat({ kind }: { kind: SkylineKind }) {
  if (kind === 'highrise') {
    return <meshStandardMaterial color="#c8c3b6" metalness={0.22} roughness={0.48} emissive="#2a2824" emissiveIntensity={0.22} />
  }
  if (kind === 'monument' || kind === 'block') {
    return <meshStandardMaterial color="#9a958a" metalness={0.12} roughness={0.7} emissive="#1a1916" emissiveIntensity={0.12} />
  }
  return <meshStandardMaterial color="#b7b2a6" metalness={0.16} roughness={0.55} emissive="#222019" emissiveIntensity={0.16} />
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
  const depth = Math.max(0.55, w * 0.7)

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
          Array.from({ length: 6 }, (_, row) =>
            Array.from({ length: 3 }, (_, col) => (
              <mesh
                key={`${row}-${col}`}
                position={[(col - 1) * (w * 0.26), 0.7 + row * (h * 0.13), depth / 2 + 0.02]}
              >
                <boxGeometry args={[w * 0.14, 0.12, 0.03]} />
                <meshStandardMaterial
                  color="#0a0a0a"
                  emissive="#cfc8b4"
                  emissiveIntensity={0.22}
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
  const compact = useExperience((s) => s.compact)
  const width = compact ? 7.4 : 26
  const height = compact ? 6.8 : 11.2
  const skyTex = useMemo(() => makeSkylineTexture(), [])

  return (
    <group position={[0, 0, compact ? -90 : -94]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]}>
        <planeGeometry args={[compact ? 16 : 36, compact ? 14 : 16]} />
        <meshStandardMaterial color="#121210" roughness={0.96} metalness={0.06} />
      </mesh>

      <mesh position={[0, compact ? 2.6 : 3.4, compact ? -4.2 : -6]}>
        <planeGeometry args={[compact ? 14 : 40, compact ? 8 : 12]} />
        <meshBasicMaterial
          color="#4a453c"
          transparent
          opacity={0.22}
          depthWrite={false}
          fog
        />
      </mesh>

      <mesh position={[0, height * 0.46, compact ? -1.6 : -3.2]}>
        <planeGeometry args={[width * 1.08, height]} />
        <meshBasicMaterial
          map={skyTex}
          color="#e6e0d2"
          transparent
          alphaTest={0.12}
          depthWrite={false}
          fog
          toneMapped={false}
        />
      </mesh>

      {LEIPZIG_SKYLINE.map((b) => (
        <group key={b.id} position={[(b.x + b.w / 2 - 0.5) * width, 0, Math.sin(b.x * 12) * 0.35]}>
          <Building
            kind={b.kind}
            w={Math.max(compact ? 0.42 : 0.7, b.w * width)}
            h={b.h * height}
            quality={quality}
          />
        </group>
      ))}

      <TypeInSpace position={[0, compact ? 4.6 : 3.8, compact ? 5.2 : 8.6]} fontSize={compact ? 1.4 : 2.8} quality={quality} letterSpacing={0.12}>
        {COPY.city}
      </TypeInSpace>
    </group>
  )
}
