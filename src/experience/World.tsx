import type { QualityLevel } from '../lib/quality'
import { City } from './City'
import { Disciplines } from './Disciplines'
import { Dust } from './Dust'
import { Gym } from './Gym'
import { IntroChamber } from './IntroChamber'
import { Konrad } from './Konrad'
import { LogoEmblem } from './LogoEmblem'
import { Volumetric } from './Volumetric'

export function World({ quality }: { quality: QualityLevel }) {
  const dust = quality === 'high' ? 130 : quality === 'medium' ? 55 : 18

  return (
    <>
      <LogoEmblem position={[0, 1.08, 0]} />
      <IntroChamber />
      <Gym quality={quality} />
      <Konrad position={[1.18, 0, -39.35]} />
      <Disciplines quality={quality} />
      <City quality={quality} />
      <LogoEmblem position={[0, 1.1, -114.15]} scale={1.12} />
      <Volumetric quality={quality} />
      <Dust count={dust} />
    </>
  )
}
