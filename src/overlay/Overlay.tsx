import { useEffect, useRef, useState } from 'react'
import { COPY } from '../brand/copy'
import { smoothstep, windowOpacity } from '../lib/math'
import { scrollProgress } from '../store'
import { WaitlistForm } from '../waitlist/WaitlistForm'

const MARK_SRC = '/brand/konni-logo.webp'

function setOpacity(el: HTMLElement | null, value: number) {
  if (!el) return
  el.style.opacity = String(value)
  el.hidden = value < 0.02
}

function WaitlistConfirmedBanner() {
  const [visible] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('liste') === 'bestaetigt'
  })

  if (!visible) return null
  return (
    <p className="waitlist-banner" role="status">
      {COPY.waitlistConfirmed}
    </p>
  )
}

function Emblem({ className, alt }: { className: string; alt: string }) {
  return (
    <img
      src={MARK_SRC}
      alt={alt}
      className={className}
      width={2202}
      height={2340}
      decoding="async"
      draggable={false}
    />
  )
}

type OverlayProps = {
  reducedMotion: boolean
  compact: boolean
}

export function Overlay({ reducedMotion, compact }: OverlayProps) {
  const scrollHint = useRef<HTMLDivElement>(null)
  const introMark = useRef<HTMLDivElement>(null)
  const showUp = useRef<HTMLDivElement>(null)
  const noEgos = useRef<HTMLDivElement>(null)
  const justWork = useRef<HTMLDivElement>(null)
  const mma = useRef<HTMLDivElement>(null)
  const grappling = useRef<HTMLDivElement>(null)
  const striking = useRef<HTMLDivElement>(null)
  const leipzig = useRef<HTMLDivElement>(null)
  const finale = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    let id = 0
    const loop = () => {
      const p = scrollProgress.current
      const intro = windowOpacity(p, -0.08, 0, 0.05, 0.132)
      if (introMark.current) {
        introMark.current.style.opacity = String(intro)
        introMark.current.hidden = intro < 0.02
        introMark.current.style.setProperty('--mark-scale', String(1 + 0.03 * smoothstep(0, 0.08, p)))
      }
      setOpacity(scrollHint.current, windowOpacity(p, -1, 0, 0.05, 0.1))
      setOpacity(showUp.current, windowOpacity(p, 0.165, 0.192, 0.232, 0.262))
      setOpacity(noEgos.current, windowOpacity(p, 0.258, 0.286, 0.318, 0.348))
      setOpacity(justWork.current, windowOpacity(p, 0.322, 0.348, 0.368, 0.392))
      setOpacity(mma.current, windowOpacity(p, 0.498, 0.528, 0.555, 0.585))
      setOpacity(grappling.current, windowOpacity(p, 0.54, 0.57, 0.61, 0.64))
      setOpacity(striking.current, windowOpacity(p, 0.62, 0.65, 0.69, 0.73))
      setOpacity(leipzig.current, windowOpacity(p, 0.72, 0.76, 0.84, 0.88))
      setOpacity(finale.current, windowOpacity(p, 0.88, 0.92, 1.05, 1.1))
      if (progress.current) {
        progress.current.style.transform = `scaleX(${p})`
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [reducedMotion, compact])

  if (reducedMotion) {
    return (
      <main className="story">
        <WaitlistConfirmedBanner />
        <section className="story-block">
          <Emblem className="story-logo" alt="KONNI MMA GYM Leipzig" />
          <p className="kicker">{COPY.gymName}</p>
          <h1>{COPY.city}</h1>
          <p>{COPY.homeOf}</p>
        </section>
        <section className="story-block">
          <h2>{COPY.showUp}</h2>
          <h2>{COPY.noEgos}</h2>
          <h2>{COPY.justWork}</h2>
          <img src="/brand/konrad.png" alt="Konrad" className="story-fighter" />
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
          <WaitlistForm variant="page" />
        </section>
      </main>
    )
  }

  return (
    <div className={compact ? 'overlay is-compact' : 'overlay'}>
      <WaitlistConfirmedBanner />
      <div className="progress-track">
        <div ref={progress} className="progress-bar" />
      </div>

      <div ref={introMark} className="intro-mark">
        <Emblem className="intro-mark-img" alt="KONNI MMA GYM Leipzig" />
      </div>

      <div ref={scrollHint} className="overlay-block scroll-hint">
        <span>SCROLL</span>
        <i />
      </div>

      {compact && (
        <>
          <div ref={showUp} className="caption caption-arrive" hidden>
            <p>{COPY.showUp}</p>
          </div>
          <div ref={noEgos} className="caption" hidden>
            <p>{COPY.noEgos}</p>
          </div>
          <div ref={justWork} className="caption caption-accent" hidden>
            <p>{COPY.justWork}</p>
          </div>
          <div ref={mma} className="caption" hidden>
            <p>{COPY.mma}</p>
          </div>
          <div ref={grappling} className="caption" hidden>
            <p>{COPY.grappling}</p>
          </div>
          <div ref={striking} className="caption" hidden>
            <p>{COPY.striking}</p>
          </div>
        </>
      )}

      <div ref={leipzig} className="overlay-block leipzig-copy" hidden>
        {compact && <p className="caption-title">{COPY.city}</p>}
        <p className="line">{COPY.homeOf}</p>
        <p className="sub">{COPY.locationSoon}</p>
      </div>

      <div ref={finale} className="overlay-block finale-copy has-waitlist" hidden>
        <div className="finale-card">
          <Emblem className="finale-logo" alt="" />
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
          <WaitlistForm />
        </div>
      </div>
    </div>
  )
}
