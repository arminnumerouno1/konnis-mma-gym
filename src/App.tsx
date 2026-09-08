import { useEffect, useState } from 'react'
import { Experience } from './experience/Experience'
import { detectQuality, prefersReducedMotion, type QualityLevel } from './lib/quality'
import { Overlay } from './overlay/Overlay'
import { Loader } from './overlay/Loader'
import { useScrollExperience } from './scroll/useScrollExperience'
import { useExperience } from './store'

export default function App() {
  const ready = useExperience((s) => s.ready)
  const [boot, setBoot] = useState(false)
  const [quality, setQuality] = useState<QualityLevel>('medium')
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setQuality(detectQuality())
    setReduced(prefersReducedMotion())
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)

    let cancelled = false
    const start = async () => {
      try {
        await Promise.all([
          document.fonts.load('400 16px "Bebas Neue"'),
          document.fonts.load('400 16px "Barlow Condensed"'),
        ])
      } catch {
        /* fonts still usable via fallback */
      }
      if (!cancelled) {
        requestAnimationFrame(() => setBoot(true))
      }
    }
    void start()
    return () => {
      cancelled = true
      media.removeEventListener('change', onChange)
    }
  }, [])

  useScrollExperience(reduced, ready)

  return (
    <>
      <div className="viewport">
        {boot && <Experience quality={quality} reducedMotion={reduced} />}
        <Overlay reducedMotion={reduced} />
        <div className="film-grain" />
        <div className="film-vignette" />
        <Loader visible={!ready} />
      </div>
      {!reduced && <div id="scroll-track" className="scroll-track" />}
    </>
  )
}
