import { useEffect, useState, type FormEvent } from 'react'
import { COPY, FAQ } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { KURSPLAN, KURSPLAN_DAYS, KURSPLAN_TIMES, kursLevelLabel } from '../brand/kursplan'
import { PUBLIC_PLANS, TRIAL_OPEN, type Plan } from '../brand/plans'
import { submitTrial } from '../contact/api'
import { hasExtrasConsent, onConsentChange } from '../lib/consent'
import { Link } from '../lib/Link'
import { href } from '../lib/router'
import { wantsSmoothScroll } from '../lib/motion'
import { useSiteMotion } from '../lib/useSiteMotion'
import { InstagramIcon } from '../components/InstagramIcon'

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`price-card accent-${plan.accent}`}>
      <p className="price-tag">{plan.tag}</p>
      <h3>{plan.name}</h3>
      <p className="price-sum">
        <strong>{plan.price}€</strong>
        <span>{plan.unit}</span>
      </p>
      <p className="price-term">{plan.term}</p>
      <p className="plan-includes">{COPY.planIncludes}</p>
      {plan.id === 'daypass' ? null : (
        <p className="price-fee">
          <strong>{COPY.signupFeePrice}</strong>
          <span>{COPY.signupFeeLabel}</span>
        </p>
      )}
      <ul>
        {plan.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Link className="btn btn-solid" href={href('join', { plan: plan.id })}>
        {plan.id === 'daypass' ? 'Day Pass' : COPY.ctaJoin}
      </Link>
    </article>
  )
}

function TrialForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [interest, setInterest] = useState('MMA')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (name.trim().length < 2 || !email.includes('@') || phone.trim().length < 6) {
      setError(COPY.trialNeed)
      return
    }
    setPending(true)
    const honey = String(new FormData(event.currentTarget).get('company') ?? '')
    const result = await submitTrial({ name, email, phone, interest, note, company: honey })
    setPending(false)
    if (!result.ok) {
      setError(result.error === 'rate' ? COPY.rate : COPY.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <p className="trial-done" role="status">
        {COPY.trialDone}
      </p>
    )
  }

  return (
    <form className="trial-form" onSubmit={(event) => void onSubmit(event)} noValidate>
      <label>
        {COPY.trialName}
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label>
        {COPY.trialEmail}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>
        {COPY.trialPhone}
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
      </label>
      <label>
        {COPY.trialInterest}
        <select value={interest} onChange={(e) => setInterest(e.target.value)}>
          {COPY.trialInterests.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        {COPY.trialNote}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      <label className="honey" aria-hidden="true">
        Firma
        <input name="company" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-solid" type="submit" disabled={pending}>
        {pending ? COPY.trialPending : COPY.trialSubmit}
      </button>
    </form>
  )
}

function GymMap() {
  const [extras, setExtras] = useState(() => hasExtrasConsent())

  useEffect(() => onConsentChange((choice) => setExtras(choice.extras)), [])

  return (
    <div className="gym-map">
      {extras ? (
        <iframe
          title="KONNI MMA GYM, Wittenberger Straße 15, Leipzig"
          src={GYM.mapsEmbed}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <a className="btn btn-ghost" href={GYM.mapsUrl} target="_blank" rel="noreferrer">
        Karte
      </a>
    </div>
  )
}

function FighterInstagram({ url, handle }: { url: string; handle: string }) {
  return (
    <a className="fighter-ig" href={url} target="_blank" rel="noreferrer" aria-label={`${handle} auf Instagram`}>
      <span className="fighter-ig-icon">
        <InstagramIcon size={18} />
      </span>
      <span>{handle}</span>
    </a>
  )
}

function FaqList() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="faq-list">
      {FAQ.map((item, index) => {
        const isOpen = open === index
        return (
          <div key={item.q} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : index)}>
              {item.q}
            </button>
            {isOpen ? <p>{item.a}</p> : null}
          </div>
        )
      })}
    </div>
  )
}

export function Home() {
  useSiteMotion(true)

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      const behavior = wantsSmoothScroll() ? 'smooth' : 'auto'
      document.getElementById(hash)?.scrollIntoView({ behavior, block: 'start' })
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
      <section className="hero-slam" id="top">
        <div className="hero-flash" aria-hidden="true" />
        <div className="hero-slash" aria-hidden="true" />
        <div className="hero-poster">
          <div className="hero-logo-wrap">
            <img className="hero-logo ghost cyan" src={GYM.logo} alt="" width={1036} height={1125} />
            <img className="hero-logo ghost red" src={GYM.logo} alt="" width={1036} height={1125} />
            <img className="hero-logo" src={GYM.logo} alt={GYM.name} width={1036} height={1125} />
          </div>
          <p className="hero-stamp">{COPY.heroStamp}</p>
          <h1>
            <span className="sr-only">MMA Gym in Leipzig. {COPY.gymName}. </span>
            <span className="hero-name">{COPY.heroName}</span>
            <span className="hero-mma">
              {COPY.heroMma} <span className="hero-city">{COPY.heroCity}</span>
            </span>
          </h1>
        </div>
        <p className="hero-hit">{COPY.heroHit}</p>
        <div className="hero-actions">
          <Link className="btn btn-solid btn-xl" href={href('join')}>
            {COPY.ctaJoinNow}
          </Link>
          {TRIAL_OPEN ? (
            <Link className="btn btn-ghost btn-xl" href="/#probetraining">
              {COPY.ctaTrial}
            </Link>
          ) : null}
        </div>
      </section>

      <p className="tape" aria-hidden="true">
        <span>{COPY.tape}</span>
        <span>{COPY.tape}</span>
      </p>

      <section className="opening" id="studio" data-reveal>
        <p className="opening-kicker">{COPY.aboutKicker}</p>
        <p className="opening-date">{COPY.aboutDate}</p>
        <h2>
          {COPY.aboutTitleStart}
          <br />
          <span className="opening-when">{COPY.aboutTitleDate}</span> {COPY.aboutTitleEnd}
        </h2>
        <div className="opening-copy">
          {COPY.aboutParas.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
        <div className="opening-card">
          <p>
            <span>📍</span> {COPY.aboutPlace}
          </p>
          <p>
            {COPY.aboutStreet}
            <br />
            {COPY.aboutZip}
          </p>
          <p>
            <span>📅</span> <span className="opening-when">{COPY.aboutWhen}</span>
          </p>
        </div>
        <p className="opening-close">{COPY.aboutClose}</p>
        <div className="opening-actions">
          <Link className="btn btn-solid btn-xl" href={href('join')}>
            {COPY.ctaJoinNow}
          </Link>
          {TRIAL_OPEN ? (
            <Link className="btn btn-ghost btn-xl" href="/#probetraining">
              {COPY.ctaTrial}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="halle" aria-label="Die Halle">
        {(
          [
            [GYM.hall.cage, ''],
            [GYM.hall.floor, ''],
            [GYM.hall.depth, ''],
            [GYM.hall.marks, ''],
            [GYM.hall.ropes, ''],
          ] as const
        ).map(([src, alt]) => (
          <img key={src} src={src} alt={alt} width={640} height={426} />
        ))}
      </section>

      <section className="impact" id="training">
        <p className="impact-kicker">{COPY.trainTitle}</p>
        {COPY.disciplines.map((item, index) => (
          <article className="impact-row" key={item.name}>
            <span>{index + 1}.</span>
            <h3>
              {item.name} <span className="impact-place">{COPY.disciplinePlace}</span>
            </h3>
            <p className="impact-tagline">{item.tagline}</p>
            <p className="impact-text">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="duo" id="team">
        <article className="duo-card">
          <div className="duo-shot">
            <img src={GYM.konrad} alt={COPY.konradName} width={720} height={1520} />
          </div>
          <div className="duo-copy">
            <FighterInstagram url={GYM.konradInstagram} handle={GYM.konradInstagramHandle} />
            <p className="fighter-kicker">{COPY.konradRole}</p>
            <h2>
              KONRAD
              <br />
              DYRSCHKA
            </h2>
            <ul className="fighter-facts">
              {COPY.konradFacts.map(([value, label]) => (
                <li key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <p className="fighter-bio">{COPY.konradBio}</p>
          </div>
        </article>
        <article className="duo-card">
          <div className="duo-shot">
            <img src={GYM.mehmet} alt={COPY.mehmetName} width={1374} height={1206} />
          </div>
          <div className="duo-copy">
            <FighterInstagram url={GYM.mehmetInstagram} handle={GYM.mehmetInstagramHandle} />
            <p className="fighter-kicker">{COPY.mehmetRole}</p>
            <h2>
              MEHMET
              <br />
              CELIK
            </h2>
            <p>{COPY.mehmetBio}</p>
          </div>
        </article>
      </section>

      <section className="who" id="wer" data-reveal>
        <p className="who-kicker">{COPY.whoKicker}</p>
        <h2>{COPY.whoTitle}</h2>
        <p className="who-lead">{COPY.whoLead}</p>
        <ul className="who-grid">
          {COPY.whoPeople.map(([name, text]) => (
            <li key={name}>
              <h3>{name}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <div className="who-actions">
          <Link className="btn btn-solid" href={href('join')}>
            {COPY.ctaJoin}
          </Link>
          {TRIAL_OPEN ? (
            <Link className="btn btn-ghost" href="/#probetraining">
              {COPY.ctaTrial}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="block schedule" id="plan" data-reveal>
        <h2>{COPY.planTitle}</h2>
        <p className="lead">{COPY.planNote}</p>
        <div className="kursplan-legend" aria-hidden="true">
          <span className="kursplan-legend-all">{COPY.planLegendAll}</span>
          <span className="kursplan-legend-advanced">{COPY.planLegendAdvanced}</span>
        </div>
        <div className="schedule-frame">
          <div className="kursplan-scroll">
            <table className="kursplan-table">
              <thead>
                <tr>
                  <th scope="col">Zeit</th>
                  {KURSPLAN_DAYS.map((day) => (
                    <th key={day.id} scope="col">
                      <span className="kursplan-day-full">{day.label}</span>
                      <span className="kursplan-day-short">{day.short}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KURSPLAN_TIMES.map((time, rowIndex) => (
                  <tr key={time}>
                    <th scope="row">{time}</th>
                    {KURSPLAN[rowIndex].map((cell, dayIndex) => {
                      const day = KURSPLAN_DAYS[dayIndex]
                      if (!cell) {
                        return (
                          <td key={day.id} className="kursplan-empty">
                            <span>{COPY.planEmpty}</span>
                          </td>
                        )
                      }
                      return (
                        <td key={day.id} className={`kursplan-slot accent-${cell.accent}`}>
                          {cell.when ? <span className="kursplan-when">{cell.when}</span> : null}
                          <strong>{cell.title}</strong>
                          <span className={`kursplan-level is-${cell.level}`}>{kursLevelLabel(cell.level)}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="block pricing" id="preise" data-reveal>
        <h2>{COPY.priceTitle}</h2>
        <p className="lead">{COPY.priceLead}</p>
        <div className="price-grid">
          {PUBLIC_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
        <p className="price-foot">{COPY.priceFoot}</p>
      </section>

      {TRIAL_OPEN ? (
        <section className="block trial" id="probetraining" data-reveal>
          <h2>{COPY.trialTitle}</h2>
          <p className="lead">{COPY.trialLead}</p>
          <TrialForm />
        </section>
      ) : null}

      <section className="block faq" id="faq">
        <h2>{COPY.faqTitle}</h2>
        <FaqList />
      </section>

      <section className="block contact" id="kontakt">
        <h2>{COPY.contactTitle}</h2>
        <div className="contact-grid">
          <div>
            <p>
              {GYM_ADDRESS}
              <br />
              <a href={`mailto:${GYM.email}`}>{GYM.email}</a>
              <br />
              <a href={GYM.phoneHref}>{GYM.phone}</a>
              <br />
              <a href={GYM.whatsapp} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              {' · '}
              <a href={GYM.instagram} target="_blank" rel="noreferrer">
                {GYM.instagramHandle}
              </a>
            </p>
            <p>
              {COPY.locMail}: <a href={`mailto:${GYM.legalEmail}`}>{GYM.legalEmail}</a>
            </p>
            <GymMap />
          </div>
          <div>
            <h3>{COPY.hoursTitle}</h3>
            <p className="hours-soon">{GYM.hoursSoon}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
