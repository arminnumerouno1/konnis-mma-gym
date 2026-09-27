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
      <section className="hero hero-logo-only" id="top">
        <img className="hero-logo" src={GYM.logo} alt={GYM.name} width={520} height={552} />
        <p className="hero-place">{COPY.heroPlace}</p>
        <p className="hero-line">{COPY.heroLine}</p>
        <div className="hero-actions">
          <Link className="btn btn-solid" href="/#probetraining">
            {COPY.ctaTrial}
          </Link>
          <Link className="btn btn-ghost" href={href('join')}>
            {COPY.ctaJoin}
          </Link>
        </div>
      </section>

      <section className="block about" id="studio">
        <h2>{COPY.aboutTitle}</h2>
        <p className="lead">{COPY.aboutBody}</p>
        <p>{COPY.aboutNote}</p>
      </section>

      <section className="block training" id="training">
        <h2>{COPY.trainTitle}</h2>
        <div className="train-rows">
          <div>
            <h3>{COPY.mma}</h3>
            <p>{COPY.mmaText}</p>
          </div>
          <div>
            <h3>{COPY.grappling}</h3>
            <p>{COPY.grapplingText}</p>
          </div>
          <div>
            <h3>{COPY.striking}</h3>
            <p>{COPY.strikingText}</p>
          </div>
        </div>
      </section>

      <section className="block team" id="team">
        <h2>{COPY.teamTitle}</h2>
        <p className="lead">{COPY.teamLead}</p>
        <div className="team-grid">
          <article className="team-card">
            <img src={GYM.konrad} alt={COPY.konradName} width={420} height={880} />
            <div>
              <h3>{COPY.konradName}</h3>
              <p className="role">{COPY.konradRole}</p>
              <p>{COPY.konradBio}</p>
            </div>
          </article>
          <article className="team-card team-card-empty">
            <div className="team-fallback" aria-hidden="true">
              MC
            </div>
            <div>
              <h3>{COPY.mehmetName}</h3>
              <p className="role">{COPY.mehmetRole}</p>
              <p>{COPY.mehmetBio}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="block schedule" id="plan">
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

      <section className="block pricing" id="preise">
        <h2>{COPY.priceTitle}</h2>
        <p className="lead">{COPY.priceLead}</p>
        <div className="price-grid">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} remaining={remaining} />
          ))}
        </div>
        <p className="price-foot">{COPY.priceFoot}</p>
      </section>

      <section className="block trial" id="probetraining">
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
