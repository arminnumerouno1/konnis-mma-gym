import { useEffect, useState, type FormEvent } from 'react'
import { COPY, FAQ } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { KONRAD } from '../brand/konrad'
import { PRESS } from '../brand/press'
import { GOOGLE_REVIEWS } from '../brand/reviews'
import {
  KURSPLAN,
  KURSPLAN_DAYS,
  KURSPLAN_TIMES,
  kursLevelLabel,
  kursplanByDay,
  openingHoursFromKursplan,
  trialSlots,
} from '../brand/kursplan'
import { PUBLIC_PLANS, TRIAL_OPEN, termTotalLabel, type Plan } from '../brand/plans'
import { submitTrial } from '../contact/api'
import { honeypotInputProps, useFormStarted } from '../lib/formGuard'

const KURSPLAN_BY_DAY = kursplanByDay()
const OPENING_HOURS = openingHoursFromKursplan()
const TRIAL_SLOTS = trialSlots()
import { hasExtrasConsent, onConsentChange } from '../lib/consent'
import { Link } from '../lib/Link'
import { href } from '../lib/router'
import { ageFromIso, wantsSmoothScroll } from '../lib/motion'
import { useSiteMotion } from '../lib/useSiteMotion'
import { InstagramIcon } from '../components/InstagramIcon'

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`price-card accent-${plan.accent}${plan.featured ? ' is-featured' : ''}`}>
      {plan.featured ? <p className="price-featured">{COPY.priceFeatured}</p> : null}
      <p className="price-tag">{plan.tag}</p>
      <h3>{plan.name}</h3>
      <p className="price-term">{plan.term}</p>
      <p className="price-sum">
        <strong>{plan.price}€</strong>
        <span>{plan.unit}</span>
      </p>
      <p className="plan-includes">{plan.includes}</p>
      {plan.id === 'daypass' ? null : (
        <p className="price-fee">
          <strong>{COPY.signupFeePrice}</strong>
          <span>{COPY.signupFeeLabel}</span>
        </p>
      )}
      <p className="price-tax">{COPY.priceTaxNote}</p>
      {termTotalLabel(plan) ? (
        <p className="price-total">
          {COPY.termTotalLabel}: {termTotalLabel(plan)}
        </p>
      ) : null}
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
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelation, setGuardianRelation] = useState('Mutter')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianConsent, setGuardianConsent] = useState(false)
  const [slotId, setSlotId] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<'adult' | 'minor' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const formStarted = useFormStarted()

  const age = ageFromIso(birthDate)
  const minor = age != null && age < 18

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (name.trim().length < 2 || !email.includes('@') || phone.trim().length < 6 || !slotId || !birthDate) {
      setError(COPY.trialNeed)
      return
    }
    if (age == null || age < 6) {
      setError(COPY.trialBirthInvalid)
      return
    }
    if (
      minor &&
      (!guardianName.trim() ||
        !guardianEmail.includes('@') ||
        guardianPhone.trim().length < 6 ||
        !guardianConsent)
    ) {
      setError(COPY.trialNeedGuardian)
      return
    }
    setPending(true)
    const honey = String(new FormData(event.currentTarget).get('company') ?? '')
    const result = await submitTrial({
      name,
      email,
      phone,
      birthDate,
      slotId,
      note,
      company: honey,
      formStarted,
      ...(minor
        ? {
            guardianName,
            guardianRelation,
            guardianEmail,
            guardianPhone,
            guardianConsent: true,
          }
        : {}),
    })
    setPending(false)
    if (!result.ok) {
      setError(
        result.error === 'rate'
          ? COPY.rate
          : result.error === 'duplicate'
            ? COPY.trialDuplicate
            : result.error === 'slot'
              ? COPY.trialOneSlot
              : result.error === 'birth'
                ? COPY.trialBirthInvalid
                : result.error === 'guardian'
                  ? COPY.trialNeedGuardian
                  : COPY.error,
      )
      return
    }
    setDone(result.minor || minor ? 'minor' : 'adult')
  }

  if (done) {
    return (
      <p className="trial-done" role="status">
        {done === 'minor' ? COPY.trialDoneMinor : COPY.trialDone}
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
        {COPY.trialBirth}
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
        />
      </label>
      <p className="trial-hint wide">{COPY.trialBirthHint}</p>
      <label>
        {COPY.trialEmail}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>
        {COPY.trialPhone}
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
      </label>
      {minor ? (
        <div className="minor-block wide">
          <p className="minor-kicker">{COPY.trialGuardianTitle}</p>
          <p className="minor-lead">{COPY.trialGuardianLead}</p>
          <div className="form-grid">
            <label>
              {COPY.trialGuardianName}
              <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required />
            </label>
            <label>
              {COPY.trialGuardianRelation}
              <select value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} required>
                <option value="Mutter">Mutter</option>
                <option value="Vater">Vater</option>
                <option value="Beide Eltern">Beide Eltern</option>
                <option value="Vormund">Vormund</option>
                <option value="Andere">Andere</option>
              </select>
            </label>
            <label>
              {COPY.trialGuardianEmail}
              <input
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                required
              />
            </label>
            <label>
              {COPY.trialGuardianPhone}
              <input type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} required />
            </label>
            <label className="check wide">
              <input
                type="checkbox"
                checked={guardianConsent}
                onChange={(e) => setGuardianConsent(e.target.checked)}
              />
              <span>{COPY.trialGuardianConsent}</span>
            </label>
          </div>
        </div>
      ) : null}
      <label className="wide">
        {COPY.trialSlot}
        <select value={slotId} onChange={(e) => setSlotId(e.target.value)} required>
          <option value="">{COPY.trialSlotPick}</option>
          {TRIAL_SLOTS.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        {COPY.trialNote}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      <label className="honey" aria-hidden="true">
        Firma
        <input {...honeypotInputProps()} />
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
          title="KONNI MMA GYM, Wittenberger Straße 15, Aufgang B, Leipzig"
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

function EsnPartner() {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(GYM.esn.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="esn" id="esn" data-reveal aria-label="ESN Partner · Werbung">
      <div className="esn-glow" aria-hidden="true" />
      <div className="esn-inner">
        <a className="esn-brand" href={GYM.esn.url} target="_blank" rel="noopener noreferrer">
          <img src={GYM.esn.logo} alt="ESN · Elite Sports Nutrients" width={1024} height={724} />
        </a>
        <div className="esn-copy">
          <p className="esn-kicker">
            <span className="esn-ad-label">{COPY.esnAdLabel}</span>
            <span>{COPY.esnKicker}</span>
          </p>
          <h2>{COPY.esnTitle}</h2>
          <p className="esn-lead">{COPY.esnLead}</p>
          <div className="esn-deal">
            <p className="esn-off">
              <strong>{GYM.esn.discount}</strong>
              <span>Rabatt</span>
            </p>
            <div className="esn-code-wrap">
              <span className="esn-ad-label esn-ad-label-code">{COPY.esnAdLabel}</span>
              <span className="esn-code-label">{COPY.esnCodeLabel}</span>
              <p className="esn-code" aria-label={`Werbung · Rabattcode ${GYM.esn.code}`}>
                {GYM.esn.code}
              </p>
              <button className="btn btn-ghost esn-copy-btn" type="button" onClick={() => void copyCode()}>
                {copied ? COPY.esnCopied : COPY.esnCopy}
              </button>
            </div>
          </div>
          <div className="esn-actions">
            <a className="btn btn-solid btn-xl" href={GYM.esn.url} target="_blank" rel="noopener noreferrer">
              {COPY.esnCta}
            </a>
            <p className="esn-hint">{COPY.esnHint}</p>
          </div>
        </div>
      </div>
    </section>
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
          <p className="hero-stamp">
            <a href={GOOGLE_REVIEWS.reviewsUrl} target="_blank" rel="noopener noreferrer">
              <span className="hero-stamp-stars" aria-hidden="true">
                ★★★★★
              </span>
              <span className="hero-stamp-label">250+ Google Bewertungen</span>
            </a>
          </p>
          <h1>
            <span className="sr-only">MMA Gym in Leipzig. {COPY.gymName}. </span>
            <span className="hero-name">
              {COPY.heroName.split(/\s+/).map((part, index) => (
                <span key={part}>
                  {index > 0 ? <br /> : null}
                  {part}
                </span>
              ))}
            </span>
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

      <section className="halle" aria-label="Die Halle">
        {(
          [
            [GYM.hall.cageStrip, 'MMA-Käfig in der KONNI Arena'],
            [GYM.hall.floor, 'Trainingsfläche mit Hex-Licht'],
            [GYM.hall.depth, 'Blick durch die Halle'],
            [GYM.hall.marks, 'KONNI MMA Wandlogo'],
            [GYM.hall.ropes, 'MMA-Käfig frontal mit Hex-Licht'],
          ] as const
        ).map(([src, alt]) => (
          <img key={src} src={src} alt={alt} width={640} height={480} loading="lazy" />
        ))}
      </section>

      <section className="tour" id="tour" data-reveal aria-label={COPY.tourTitle}>
        <div className="tour-head">
          <p className="tour-kicker">{COPY.tourKicker}</p>
          <h2>{COPY.tourTitle}</h2>
          <p className="tour-lead">{COPY.tourLead}</p>
        </div>
        <div className="tour-phone">
          <video
            className="tour-video"
            controls
            playsInline
            preload="none"
            poster={GYM.tour.poster}
            width={720}
            height={1280}
          >
            <source src={GYM.tour.video} type="video/mp4" />
          </video>
        </div>
      </section>

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
          <Link className="btn btn-ghost btn-xl" href="/#preise">
            {COPY.aboutToPrices}
          </Link>
        </div>
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
          <Link className="btn btn-solid" href="/#preise">
            {COPY.whoToPrices}
          </Link>
        </div>
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

      <section className="block schedule" id="plan" data-reveal>
        <h2>{COPY.planTitle}</h2>
        <p className="lead">{COPY.planNote}</p>
        <p className="lead">{COPY.planNoteYouth}</p>
        <div className="kursplan-legend" aria-hidden="true">
          <span className="kursplan-legend-all">{COPY.planLegendAll}</span>
          <span className="kursplan-legend-advanced">{COPY.planLegendAdvanced}</span>
        </div>
        <div className="schedule-frame">
          <div className="kursplan-scroll kursplan-desktop">
            <table className="kursplan-table">
              <thead>
                <tr>
                  <th scope="col">Zeit</th>
                  {KURSPLAN_DAYS.map((day) => (
                    <th key={day.id} scope="col">
                      {day.label}
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
          <div className="kursplan-mobile">
            {KURSPLAN_BY_DAY.map(({ day, entries }) => (
              <article key={day.id} className={`kursplan-day day-${day.id}`}>
                <h3>{day.label}</h3>
                {entries.length ? (
                  <ul>
                    {entries.map((entry) => (
                      <li key={`${day.id}-${entry.time}-${entry.slot.title}`} className={`kursplan-slot accent-${entry.slot.accent}`}>
                        <span className="kursplan-when">{entry.time}</span>
                        <strong>{entry.slot.title}</strong>
                        <span className={`kursplan-level is-${entry.slot.level}`}>{kursLevelLabel(entry.slot.level)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="kursplan-empty">{COPY.planEmpty}</p>
                )}
              </article>
            ))}
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
        <div className="price-close">
          <p>{COPY.priceClose}</p>
          <Link className="btn btn-solid btn-xl" href={href('join')}>
            {COPY.ctaJoinNow}
          </Link>
        </div>
      </section>

      {TRIAL_OPEN ? (
        <section className="block trial" id="probetraining" data-reveal>
          <h2>{COPY.trialTitle}</h2>
          <p className="lead">{COPY.trialLead}</p>
          <TrialForm />
        </section>
      ) : null}

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

      <section
        className="konrad-profile"
        id="konrad-dyrschka"
        data-reveal
        aria-label="Konrad Dyrschka – MMA-Profi und Head Coach"
      >
        <div className="konrad-profile-media">
          <img
            src={GYM.konradCage}
            alt="Konrad Dyrschka im MMA-Käfig des KONNI MMA GYM Leipzig"
            width={1179}
            height={1329}
            loading="lazy"
          />
        </div>
        <div className="konrad-profile-copy">
          <p className="konrad-profile-kicker">{COPY.konradSectionKicker}</p>
          <h2>{COPY.konradSectionTitle}</h2>
          <p className="konrad-profile-lead">{COPY.konradSectionLead}</p>
          {COPY.konradSectionParas.map((para) => (
            <p key={para.slice(0, 32)}>{para}</p>
          ))}
          <p className="konrad-profile-stats" aria-label="Kampfrekord Konrad Dyrschka">
            <strong>{KONRAD.record}</strong>
            <span>Pro-Rekord · {KONRAD.recordNote}</span>
            <strong>{KONRAD.oktagonRecord}</strong>
            <span>OKTAGON</span>
            <strong>{KONRAD.currentStreak}</strong>
            <span>Siege in Folge</span>
          </p>
          <h3>{COPY.konradSectionMilestonesTitle}</h3>
          <ul className="konrad-milestones">
            {KONRAD.milestones.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="press" id="presse" data-reveal aria-label="Presse über Konrad Dyrschka">
        <div className="press-head">
          <p className="press-kicker">{COPY.pressKicker}</p>
          <h2>{COPY.pressTitle}</h2>
          <p className="press-lead">{COPY.pressLead}</p>
        </div>
        <ul className="press-grid">
          {PRESS.map((item) => (
            <li key={item.href}>
              <a className="press-item" href={item.href} target="_blank" rel="noopener noreferrer">
                <span className={`press-logo is-${item.outlet.toLowerCase()}`}>
                  <img src={item.logo} alt={item.logoAlt} width={160} height={160} loading="lazy" />
                </span>
                <strong>{item.title}</strong>
                <span className="press-line">{item.line}</span>
                <span className="press-go">{COPY.pressOpen}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="reviews" id="rezensionen" data-reveal aria-label="Google-Rezensionen">
        <div className="reviews-head">
          <p className="reviews-kicker">{COPY.reviewsKicker}</p>
          <h2>{COPY.reviewsTitle}</h2>
          <p className="reviews-lead">{COPY.reviewsLead}</p>
          <p className="reviews-score" aria-label={`${GOOGLE_REVIEWS.ratingLabel} von 5, ${GOOGLE_REVIEWS.countLabel}`}>
            <span className="reviews-stars" aria-hidden="true">
              {'★★★★★'}
            </span>
            <strong>{GOOGLE_REVIEWS.ratingLabel}</strong>
            <span>
              {COPY.reviewsOnGoogle} · {GOOGLE_REVIEWS.countLabel}
            </span>
          </p>
        </div>
        <ul className="reviews-grid">
          {GOOGLE_REVIEWS.quotes.map((item) => (
            <li key={item.name}>
              <figure className="review-card">
                <div className="review-meta">
                  <span className="review-stars" aria-hidden="true">
                    {'★★★★★'}
                  </span>
                  <figcaption>
                    <strong>{item.name}</strong>
                    <span>{COPY.reviewsSource}</span>
                  </figcaption>
                </div>
                <blockquote>
                  <p>{item.text}</p>
                </blockquote>
              </figure>
            </li>
          ))}
        </ul>
        <div className="reviews-actions">
          <a className="btn btn-solid" href={GYM.googleReviews} target="_blank" rel="noopener noreferrer">
            {COPY.reviewsReadAll}
          </a>
          <a className="btn btn-ghost" href={GYM.googleProfile} target="_blank" rel="noopener noreferrer">
            {COPY.reviewsWrite}
          </a>
        </div>
      </section>

      <section className="block faq" id="faq">
        <h2>{COPY.faqTitle}</h2>
        <FaqList />
      </section>

      <EsnPartner />

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
            <ul className="hours-list">
              {OPENING_HOURS.map((row) => (
                <li key={row.day.id}>
                  <span>{row.label}</span>
                  <strong>{row.hours}</strong>
                </li>
              ))}
              <li>
                <span>Sonntag</span>
                <strong>geschlossen</strong>
              </li>
            </ul>
            <p className="hours-note">{GYM.hoursNote}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
