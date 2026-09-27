import { useEffect, useState, type FormEvent } from 'react'
import { COPY, FAQ } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { PLANS, type Plan } from '../brand/plans'
import { submitTrial } from '../contact/api'
import { Link } from '../lib/Link'
import { href } from '../lib/router'
import { useSiteMotion } from '../lib/useSiteMotion'
import { fetchFirst50 } from '../membership/api'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const SLOTS = [
  ['16:00 MMA', '16:00 Grappling', '16:00 Striking', '16:00 MMA', '16:00 Grappling', '10:00 Open'],
  ['17:30 Grappling', '17:30 MMA', '17:30 Grappling', '17:30 Striking', '17:30 MMA', '11:30 MMA'],
  ['19:00 Striking', '19:00 Advanced', '19:00 MMA', '19:00 Grappling', '19:00 Sparring', '—'],
]

function PlanCard({ plan, remaining }: { plan: Plan; remaining: number }) {
  const soldOut = plan.id === 'first50' && remaining <= 0
  return (
    <article className={`price-card accent-${plan.accent} ${soldOut ? 'is-sold' : ''}`}>
      <p className="price-tag">{plan.tag}</p>
      <h3>{plan.name}</h3>
      <p className="price-sum">
        <strong>{plan.price}€</strong>
        <span>{plan.unit}</span>
      </p>
      <p className="price-term">{plan.term}</p>
      {plan.limited ? (
        <p className="price-limit">{soldOut ? 'First 50 ist voll' : `${remaining} ${COPY.slotsLeft}`}</p>
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
          {plan.id === 'daypass' ? 'Day Pass' : COPY.ctaJoin}
        </Link>
      )}
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
          <option>MMA</option>
          <option>Grappling</option>
          <option>Striking</option>
          <option>Weiß noch nicht</option>
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
      <section className="hero-slam" id="top">
        <div className="hero-flash" aria-hidden="true" />
        <div className="hero-slash" aria-hidden="true" />
        <div className="hero-poster">
          <div className="hero-logo-wrap">
            <img className="hero-logo ghost cyan" src={GYM.logo} alt="" width={640} height={680} />
            <img className="hero-logo ghost red" src={GYM.logo} alt="" width={640} height={680} />
            <img className="hero-logo" src={GYM.logo} alt={GYM.name} width={640} height={680} />
          </div>
          <p className="hero-stamp">{COPY.heroStamp}</p>
          <h1>
            <span className="hero-name">{COPY.heroName}</span>
            <span className="hero-mma">{COPY.heroMma}</span>
          </h1>
        </div>
        <p className="hero-hit">{COPY.heroHit}</p>
        <div className="hero-actions">
          <Link className="btn btn-solid btn-xl" href="/#probetraining">
            {COPY.ctaTrial}
          </Link>
          <Link className="btn btn-ghost btn-xl" href={href('join')}>
            {COPY.ctaJoin}
          </Link>
        </div>
      </section>

      <p className="tape" aria-hidden="true">
        <span>KONRAD DYRSCHKA · MMA PRO · LEIPZIG · CAGE · MATS · NO MERCY · </span>
        <span>KONRAD DYRSCHKA · MMA PRO · LEIPZIG · CAGE · MATS · NO MERCY · </span>
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
          <Link className="btn btn-ghost btn-xl" href="/#probetraining">
            {COPY.ctaTrial}
          </Link>
        </div>
      </section>

      <section className="impact" id="training">
        <p className="impact-kicker">{COPY.trainTitle}</p>
        <article className="impact-row">
          <span>1.</span>
          <h3>{COPY.mma}</h3>
          <p>{COPY.mmaText}</p>
        </article>
        <article className="impact-row">
          <span>2.</span>
          <h3>{COPY.grappling}</h3>
          <p>{COPY.grapplingText}</p>
        </article>
        <article className="impact-row">
          <span>3.</span>
          <h3>{COPY.striking}</h3>
          <p>{COPY.strikingText}</p>
        </article>
      </section>

      <section className="fighter" id="team">
        <div className="fighter-shot" data-parallax="-8">
          <img src={GYM.konrad} alt={COPY.konradName} width={720} height={1520} />
        </div>
        <div className="fighter-copy">
          <p className="fighter-kicker">{COPY.konradRole}</p>
          <h2>
            KONRAD
            <br />
            DYRSCHKA
          </h2>
          <p className="fighter-bio">{COPY.konradBio}</p>
          <div className="mehmet-strip">
            <div className="team-fallback" aria-hidden="true">
              MC
            </div>
            <div>
              <h3>{COPY.mehmetName}</h3>
              <p className="role">{COPY.mehmetRole}</p>
              <p>{COPY.mehmetBio}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="block schedule" id="plan" data-reveal>
        <h2>{COPY.planTitle}</h2>
        <p className="lead">{COPY.planNote}</p>
        <div className="schedule-frame">
          <div className="schedule-pixel" aria-hidden="true">
            <table>
              <thead>
                <tr>
                  <th>Zeit</th>
                  {DAYS.map((day) => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((row, i) => (
                  <tr key={i}>
                    <td>{['16:00', '17:30', '19:00'][i]}</td>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="schedule-soon">{COPY.planSoon}</p>
        </div>
      </section>

      <section className="block pricing" id="preise" data-reveal>
        <h2>{COPY.priceTitle}</h2>
        <p className="lead">{COPY.priceLead}</p>
        <div className="price-grid">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} remaining={remaining} />
          ))}
        </div>
        <p className="price-foot">{COPY.priceFoot}</p>
      </section>

      <section className="block trial" id="probetraining" data-reveal>
        <h2>{COPY.trialTitle}</h2>
        <p className="lead">{COPY.trialLead}</p>
        <TrialForm />
      </section>

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
            <a className="btn btn-ghost" href={GYM.mapsUrl} target="_blank" rel="noreferrer">
              Karte
            </a>
          </div>
          <div>
            <h3>{COPY.hoursTitle}</h3>
            <dl className="hours">
              {GYM.hours.map((row) => (
                <div key={row.days}>
                  <dt>{row.days}</dt>
                  <dd>{row.time}</dd>
                </div>
              ))}
            </dl>
            <p className="hours-note">{GYM.hoursNote}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
