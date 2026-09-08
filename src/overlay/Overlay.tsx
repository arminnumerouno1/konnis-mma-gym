import { useEffect, useRef } from 'react'
import { COPY } from '../brand/copy'
import { windowOpacity } from '../lib/math'
import { scrollProgress } from '../store'

function setOpacity(el: HTMLElement | null, value: number) {
  if (!el) return
  el.style.opacity = String(value)
  el.hidden = value < 0.02
}

export function Overlay({ reducedMotion }: { reducedMotion: boolean }) {
  const scrollHint = useRef<HTMLDivElement>(null)
  const leipzig = useRef<HTMLDivElement>(null)
  const finale = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    let id = 0
    const loop = () => {
      const p = scrollProgress.current
      setOpacity(scrollHint.current, windowOpacity(p, -1, 0, 0.05, 0.1))
      setOpacity(leipzig.current, windowOpacity(p, 0.72, 0.76, 0.83, 0.875))
      setOpacity(finale.current, windowOpacity(p, 0.9, 0.935, 0.995, 1.02))
      if (progress.current) {
        progress.current.style.transform = `scaleX(${p})`
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [reducedMotion])

  if (reducedMotion) {
    return (
      <main className="story">
        <section className="story-block">
          <p className="kicker">{COPY.gymName}</p>
          <h1>{COPY.city}</h1>
          <p>{COPY.homeOf}</p>
        </section>
        <section className="story-block">
          <h2>{COPY.noEgos}</h2>
          <h2>{COPY.justWork}</h2>
        </section>
        <section className="story-block">
          <h2>{COPY.mma}</h2>
          <h2>{COPY.grappling}</h2>
          <h2>{COPY.striking}</h2>
        </section>
        <section className="story-block">
          <h2>{COPY.city}</h2>
          <p>{COPY.homeOf}</p>
          <p>{COPY.locationSoon}</p>
        </section>
        <section className="story-block">
          <h2>
            {COPY.fightSoon}
            <br />
            {COPY.startsSoon}
          </h2>
          <p>{COPY.gymName}</p>
          <p>{COPY.city}</p>
          <p>{COPY.openingSoon}</p>
          <p>{COPY.moreSoon}</p>
        </section>
      </main>
    )
  }

  return (
    <div className="overlay" aria-hidden="true">
      <div className="progress-track">
        <div ref={progress} className="progress-bar" />
      </div>

      <div ref={scrollHint} className="overlay-block scroll-hint">
        <span>SCROLL</span>
        <i />
      </div>

      <div ref={leipzig} className="overlay-block leipzig-copy">
        <p className="line">{COPY.homeOf}</p>
        <p className="sub">{COPY.locationSoon}</p>
      </div>

      <div ref={finale} className="overlay-block finale-copy">
        <h2>
          {COPY.fightSoon}
          <br />
          {COPY.startsSoon}
        </h2>
        <p className="meta">
          {COPY.gymName}
          <br />
          {COPY.city}
        </p>
        <p className="open">{COPY.openingSoon}</p>
        <p className="sub">{COPY.moreSoon}</p>
      </div>
    </div>
  )
}
