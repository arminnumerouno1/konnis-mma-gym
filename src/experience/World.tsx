import { COPY } from '../brand/copy'
import type { QualityLevel } from '../lib/quality'
import { City } from './City'
import { Disciplines } from './Disciplines'
import { Dust } from './Dust'
import { Gym } from './Gym'
import { LogoEmblem } from './LogoEmblem'
import { TypeInSpace } from './TypeInSpace'
import { Volumetric } from './Volumetric'

export function World({ quality }: { quality: QualityLevel }) {
  const dust = quality === 'high' ? 130 : quality === 'medium' ? 55 : 18

  return (
    <>
      <LogoEmblem position={[0, 1.08, 0]} />
      <Gym quality={quality} />
      <Disciplines quality={quality} />
      <City quality={quality} />
      <LogoEmblem position={[0, 1.1, -114.15]} scale={1.12} />
      <TypeInSpace
        position={[0, -0.35, -113.6]}
        fontSize={0.28}
        quality={quality}
        letterSpacing={0.16}
        color="#b9b4a8"
      >
        {COPY.gymName}
      </TypeInSpace>
      <Volumetric quality={quality} />
      <Dust count={dust} />
    </>
  )
}
