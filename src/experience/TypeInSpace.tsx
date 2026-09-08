import { Text } from '@react-three/drei'
import type { QualityLevel } from '../lib/quality'

const FONT = '/fonts/BebasNeue-Regular.ttf'

type TypeInSpaceProps = {
  children: string
  position: [number, number, number]
  rotation?: [number, number, number]
  fontSize?: number
  color?: string
  letterSpacing?: number
  quality: QualityLevel
  maxWidth?: number
}

export function TypeInSpace({
  children,
  position,
  rotation = [0, 0, 0],
  fontSize = 1,
  color = '#e6e1d6',
  letterSpacing = 0.04,
  quality,
  maxWidth,
}: TypeInSpaceProps) {
  const layers = quality === 'low' ? 1 : quality === 'medium' ? 2 : 4
  const step = 0.032

  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: layers }, (_, i) => {
        const front = i === layers - 1
        return (
          <Text
            key={i}
            font={FONT}
            fontSize={fontSize}
            letterSpacing={letterSpacing}
            color={front ? color : '#090909'}
            position={[0, 0, (i - layers + 1) * step]}
            anchorX="center"
            anchorY="middle"
            maxWidth={maxWidth}
            overflowWrap="normal"
          >
            {children}
            <meshStandardMaterial
              color={front ? color : '#090909'}
              metalness={front ? 0.18 : 0.06}
              roughness={front ? 0.48 : 0.92}
              emissive={front ? color : '#000000'}
              emissiveIntensity={front ? 0.08 : 0}
            />
          </Text>
        )
      })}
    </group>
  )
}
