import { useEffect, useState } from 'react'
import { scrollProgress } from '../store'
import type { QualityLevel } from '../lib/quality'
import { City } from './City'
import { Disciplines } from './Disciplines'
import { Dust } from './Dust'
import { Gym } from './Gym'
import { IntroChamber } from './IntroChamber'
import { Konrad } from './Konrad'
import { Volumetric } from './Volumetric'

function useAfterProgress(threshold: number) {
  const [ready, setReady] = useState(() => scrollProgress.current >= threshold)

  useEffect(() => {
    if (ready) return
    let id = 0
    const tick = () => {
      if (scrollProgress.current >= threshold) {
        setReady(true)
        return
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [ready, threshold])

  return ready
}

export function World({ quality }: { quality: QualityLevel }) {
  const dust = quality === 'high' ? 90 : quality === 'medium' ? 36 : 12
  const fighter = useAfterProgress(0.26)
  const city = useAfterProgress(0.58)

  return (
    <>
      <IntroChamber />
      <Gym quality={quality} />
      {fighter && <Konrad position={[1.14, 0, -39.35]} />}
      <Disciplines quality={quality} />
      {city && <City quality={quality} />}
      <Volumetric quality={quality} />
      <Dust count={dust} />
    </>
  )
}
