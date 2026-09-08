import { useEffect, useState } from 'react'
import { Experience } from './experience/Experience'
import { detectQuality, prefersReducedMotion, type QualityLevel } from './lib/quality'
import { Overlay } from './overlay/Overlay'
import { Loader } from './overlay/Loader'
import { ViewToggle } from './overlay/ViewToggle'
import { useScrollExperience } from './scroll/useScrollExperience'
import { useExperience } from './store'

export default function App() {
  const ready = useExperience((s) => s.ready)
  const [boot, setBoot] = useState(false)
  const [quality, setQuality] = useState<QualityLevel>('medium')
  const [reduced, setReduced] = useState(false)
  const [phone, setPhone] = useState(false)

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

  const togglePhone = () => {
    setPhone((current) => {
      const next = !current
      setQuality(next ? 'low' : detectQuality())
      return next
    })
  }

  return (
    <div className={phone ? 'app is-phone' : 'app'}>
      <div className={phone ? 'phone-stage' : undefined}>
        <div className={phone ? 'phone-bezel' : undefined}>
          <div className="viewport">
            {boot && (
              <Experience key={phone ? 'phone' : 'desktop'} quality={quality} reducedMotion={reduced} />
            )}
            <Overlay reducedMotion={reduced} />
            <div className="film-grain" />
            <div className="film-vignette" />
            <Loader visible={!ready} />
          </div>
        </div>
      </div>
      {!reduced && <div id="scroll-track" className="scroll-track" />}
      <ViewToggle phone={phone} onToggle={togglePhone} />
    </div>
  )
}
