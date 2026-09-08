import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { TypeInSpace } from './TypeInSpace'
import { chainWithRepeat } from './textures'
import { useMemo } from 'react'
import * as THREE from 'three'

type DisciplinesProps = {
  quality: QualityLevel
}

export function Disciplines({ quality }: DisciplinesProps) {
  const meshTex = useMemo(() => chainWithRepeat(18, 10), [])

  return (
    <group>
      <TypeInSpace position={[0, 1.58, -46.4]} fontSize={2.35} quality={quality} letterSpacing={0.08}>
        {COPY.mma}
      </TypeInSpace>

      <mesh position={[0, 1.55, -53.1]}>
        <planeGeometry args={[10, 4.8]} />
        <meshStandardMaterial
          color="#c8c3b8"
          metalness={0.8}
          roughness={0.3}
          alphaMap={meshTex}
          transparent
          alphaTest={0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <TypeInSpace position={[0, 1.42, -57.4]} fontSize={1.35} quality={quality} letterSpacing={0.1}>
        {COPY.grappling}
      </TypeInSpace>

      <mesh position={[7.72, 2.4, -66.2]}>
        <planeGeometry args={[0.08, 4.6]} />
        <meshBasicMaterial color="#f3eee4" />
      </mesh>
      <mesh position={[7.68, 2.4, -66.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.4, 4.6]} />
        <meshBasicMaterial color="#d8d2c6" transparent opacity={0.08} depthWrite={false} />
      </mesh>

      <TypeInSpace
        position={[0.85, 1.48, -67.2]}
        rotation={[0, 0.42, 0]}
        fontSize={1.55}
        quality={quality}
        letterSpacing={0.09}
      >
        {COPY.striking}
      </TypeInSpace>
    </group>
  )
}
