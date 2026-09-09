import type { QualityLevel } from '../lib/quality'
import { City } from './City'
import { Disciplines } from './Disciplines'
import { Dust } from './Dust'
import { Gym } from './Gym'
import { IntroChamber } from './IntroChamber'
import { Konrad } from './Konrad'
import { Volumetric } from './Volumetric'

export function World({ quality }: { quality: QualityLevel }) {
  const dust = quality === 'high' ? 130 : quality === 'medium' ? 55 : 18

  return (
    <>
      <IntroChamber />
      <Gym quality={quality} />
      <Konrad position={[1.14, 0, -39.35]} />
      <Disciplines quality={quality} />
      <City quality={quality} />
      <Volumetric quality={quality} />
      <Dust count={dust} />
    </>
  )
}
