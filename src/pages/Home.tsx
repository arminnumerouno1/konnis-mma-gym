import { useEffect, useState } from 'react'
import { COPY } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { PLANS, type Plan } from '../brand/plans'
import { Link } from '../lib/Link'
import { fetchFirst50 } from '../membership/api'
import { href } from '../lib/router'
import { useSiteMotion } from '../lib/useSiteMotion'

function PlanCard({ plan, remaining }: { plan: Plan; remaining: number }) {
  const soldOut = plan.id === 'first50' && remaining <= 0
  return (
    <article className={`price-card accent-${plan.accent} ${soldOut ? 'is-sold' : ''}`} data-reveal>
      <p className="price-tag">{plan.tag}</p>
      <h3>{plan.name}</h3>
      <p className="price-sum">
        <strong>{plan.price}€</strong>
        <span>{plan.unit}</span>
      </p>
      <p className="price-term">{plan.term}</p>
      {plan.limited ? (
        <p className="price-limit">
          {soldOut ? 'First 50 ist voll' : `${remaining} ${COPY.slotsLeft}`}
        </p>
      ) : null}
      <ul>
        {plan.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {soldOut ? (
        <span className="btn btn-ghost">Nicht mehr frei</span>
      ) : (
        <Link className="btn btn-solid" href={href('join', { plan: plan.id })}>
          {plan.id === 'daypass' ? 'Day Pass sichern' : COPY.ctaJoin}
        </Link>
      )}
    </article>
  )
}

export function Home() {
  const [remaining, setRemaining] = useState(50)
  useSiteMotion(true)

  useEffect(() => {
    void fetchFirst50().then((data) => setRemaining(data.remainingFirst50))
  }, [])

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const timer = window.setTimeout(scrollToHash, 60)
    window.addEventListener('popstate', scrollToHash)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('popstate', scrollToHash)
    }
  }, [])

  return (
    <main className="home">
      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-glow" />
        <img className="hero-mark" src={GYM.logo} alt="" width={220} height={234} data-scale />
        <div className="hero-copy">
          <p className="kicker">{COPY.kicker}</p>
          <h1>
            <span>{COPY.heroLead}</span>
            <span className="hero-red">{COPY.heroPunch}</span>
          </h1>
          <p className="hero-sub">{COPY.heroSub}</p>
          <div className="hero-actions">
            <Link className="btn btn-solid" href={href('join')}>
              {COPY.ctaJoin}
            </Link>
            <Link className="btn btn-ghost" href="/#preise">
              {COPY.ctaPlans}
            </Link>
          </div>
        </div>
        <div className="hero-konrad" data-parallax="-18">
          <img src={GYM.konrad} alt="Konrad Dyrschka" width={720} height={1520} />
        </div>
        <p className="scroll-hint">{COPY.ctaScroll}</p>
      </section>

      <section className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i}>NO EGOS · JUST WORK · UNLIMITED TRAINING · LEIPZIG · </span>
          ))}
        </div>
      </section>

      <section className="about" id="studio">
        <p className="kicker" data-reveal>
          {COPY.aboutKicker}
        </p>
        <h2 data-reveal>{COPY.aboutTitle}</h2>
        <p className="lead" data-reveal>
          {COPY.aboutBody}
        </p>
        <div className="about-grid">
          {COPY.aboutPoints.map((item) => (
            <article key={item.n} data-reveal>
              <span>{item.n}</span>
              <h3>{item.t}</h3>
              <p>{item.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="training" id="training">
        <p className="kicker" data-reveal>
          {COPY.trainKicker}
        </p>
        <h2 data-reveal>{COPY.trainTitle}</h2>
        <div className="train-grid">
          <article data-reveal>
            <h3>{COPY.mma}</h3>
            <p>{COPY.mmaText}</p>
          </article>
          <article data-reveal>
            <h3>{COPY.grappling}</h3>
            <p>{COPY.grapplingText}</p>
          </article>
          <article data-reveal>
            <h3>{COPY.striking}</h3>
            <p>{COPY.strikingText}</p>
          </article>
        </div>
      </section>

      <section className="konrad" id="konrad">
        <div className="konrad-photo" data-parallax="-8">
          <img src={GYM.konrad} alt="Konrad Dyrschka" width={520} height={1100} />
        </div>
        <div className="konrad-copy">
          <p className="kicker" data-reveal>
            {COPY.konradKicker}
          </p>
          <h2 data-reveal>{COPY.konradTitle}</h2>
          <p className="role" data-reveal>
            {COPY.konradRole}
          </p>
          <p data-reveal>{COPY.konradBody}</p>
          <blockquote data-reveal>{COPY.konradQuote}</blockquote>
        </div>
      </section>

      <section className="pricing" id="preise">
        <p className="kicker" data-reveal>
          {COPY.priceKicker}
        </p>
        <h2 data-reveal>{COPY.priceTitle}</h2>
        <p className="lead" data-reveal>
          {COPY.priceLead}
        </p>
        <div className="price-grid">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} remaining={remaining} />
          ))}
        </div>
        <p className="price-foot" data-reveal>
          {COPY.priceFoot}
        </p>
      </section>

      <section className="join-band" id="mitglied">
        <p className="kicker" data-reveal>
          {COPY.joinKicker}
        </p>
        <h2 data-reveal>{COPY.joinTitle}</h2>
        <p className="lead" data-reveal>
          {COPY.joinLead}
        </p>
        <Link className="btn btn-solid" href={href('join')} data-reveal>
          {COPY.ctaJoin}
        </Link>
      </section>

      <section className="location" id="standort">
        <p className="kicker" data-reveal>
          {COPY.locKicker}
        </p>
        <h2 data-reveal>{COPY.locTitle}</h2>
        <p className="lead" data-reveal>
          {COPY.locCity}
        </p>
        <p data-reveal>{COPY.locBody}</p>
        <p data-reveal>
          {COPY.locMail}: <a href={`mailto:${GYM.email}`}>{GYM.email}</a>
        </p>
        <a className="btn btn-ghost" href={GYM.mapsUrl} target="_blank" rel="noreferrer" data-reveal>
          {GYM_ADDRESS} auf der Karte
        </a>
      </section>
    </main>
  )
}
