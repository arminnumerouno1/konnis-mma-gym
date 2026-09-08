import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { TypeInSpace } from './TypeInSpace'

type DisciplinesProps = {
  quality: QualityLevel
}

export function Disciplines({ quality }: DisciplinesProps) {
  return (
    <group>
      <TypeInSpace position={[0, 1.58, -46.4]} fontSize={2.35} quality={quality} letterSpacing={0.08}>
        {COPY.mma}
      </TypeInSpace>

      <mesh position={[-4.6, 2.2, -54.2]}>
        <boxGeometry args={[0.22, 4.4, 0.22]} />
        <meshStandardMaterial color="#1a1a18" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[4.6, 2.2, -54.2]}>
        <boxGeometry args={[0.22, 4.4, 0.22]} />
        <meshStandardMaterial color="#1a1a18" metalness={0.3} roughness={0.5} />
      </mesh>

      <TypeInSpace position={[0, 1.42, -57.4]} fontSize={1.35} quality={quality} letterSpacing={0.1}>
        {COPY.grappling}
      </TypeInSpace>

      <mesh position={[-5.2, 2.55, -66.4]}>
        <boxGeometry args={[0.7, 5.1, 0.42]} />
        <meshStandardMaterial color="#171714" roughness={0.9} metalness={0.08} />
      </mesh>
      <mesh position={[5.2, 2.55, -66.4]}>
        <boxGeometry args={[0.7, 5.1, 0.42]} />
        <meshStandardMaterial color="#171714" roughness={0.9} metalness={0.08} />
      </mesh>
      <mesh position={[0, 5.2, -66.4]}>
        <boxGeometry args={[11.2, 0.38, 0.42]} />
        <meshStandardMaterial color="#1c1c1a" metalness={0.35} roughness={0.48} />
      </mesh>
      <mesh position={[0, 2.7, -66.55]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.08, 3.6, 0.08]} />
        <meshStandardMaterial
          color="#f3eee4"
          emissive="#f3eee4"
          emissiveIntensity={1.4}
          roughness={0.3}
        />
      </mesh>

      <TypeInSpace
        position={[0, 1.48, -67.8]}
        fontSize={1.45}
        quality={quality}
        letterSpacing={0.09}
      >
        {COPY.striking}
      </TypeInSpace>
    </group>
  )
}
