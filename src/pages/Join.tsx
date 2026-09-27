import { useMemo, useState, type FormEvent } from 'react'
import { COPY } from '../brand/copy'
import { GYM } from '../brand/gym'
import { PAYMENT_NOTE, PLANS, isPlanId, planById, type PlanId } from '../brand/plans'
import { Link } from '../lib/Link'
import { ageFromIso } from '../lib/motion'
import { href } from '../lib/router'
import { submitMembership, type MembershipConsents, type MembershipError } from '../membership/api'

const ERRORS: Record<MembershipError, string> = {
  plan: 'Bitte einen Tarif wählen.',
  first50: 'Dieser Tarif ist nicht mehr verfügbar.',
  name: COPY.invalid,
  birth: 'Bitte ein gültiges Geburtsdatum eintragen.',
  address: 'Bitte Straße, PLZ und Ort prüfen.',
  email: 'Bitte eine gültige E-Mail eintragen.',
  phone: 'Bitte eine Telefonnummer eintragen.',
  guardian: 'Unter 18 braucht die gesetzliche Vertretung inkl. Zustimmung.',
  consent: 'Bitte alle Pflicht-Häkchen setzen.',
  place: 'Bitte den Ort der Unterschrift eintragen.',
  signature: 'Die Unterschrift muss genau Vor- und Nachname sein.',
  visit: 'Bitte einen Tag für den Day Pass wählen.',
  rate: COPY.rate,
  upstream: COPY.error,
  network: COPY.error,
  invalid: COPY.invalid,
}

type JoinProps = {
  plan: string | null
}

const emptyConsents = (): MembershipConsents => ({
  agb: false,
  hausordnung: false,
  widerruf: false,
  privacy: false,
  health: false,
  sign: false,
  earlyStart: false,
  photos: false,
  newsletter: false,
})

export function Join({ plan }: JoinProps) {
  const initial = plan && isPlanId(plan) ? plan : 'standard'
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<PlanId>(initial)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [street, setStreet] = useState('')
  const [zip, setZip] = useState('')
  const [city, setCity] = useState('Leipzig')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [visitDay, setVisitDay] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianConsent, setGuardianConsent] = useState(false)
  const [place, setPlace] = useState('Leipzig')
  const [signature, setSignature] = useState('')
  const [consents, setConsents] = useState(emptyConsents)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id?: string; at: string } | null>(null)

  const selected = planById(chosen)
  const age = ageFromIso(birthDate)
  const minor = age != null && age < 18

  const summary = useMemo(() => {
    if (!selected || !done) return null
    return {
      plan: selected,
      name: `${firstName} ${lastName}`,
      at: done.at,
    }
  }, [selected, done, firstName, lastName])

  function toggleConsent(key: keyof MembershipConsents) {
    setConsents((current) => ({ ...current, [key]: !current[key] }))
  }

  function goNext() {
    setError(null)
    if (step === 0) {
      setStep(1)
      return
    }
    if (step === 1) {
      if (firstName.trim().length < 2 || lastName.trim().length < 2) {
        setError(COPY.invalid)
        return
      }
      if (age == null || age < 6) {
        setError(ERRORS.birth)
        return
      }
      if (street.trim().length < 4 || zip.trim().length !== 5 || city.trim().length < 2) {
        setError(ERRORS.address)
        return
      }
      if (!email.includes('@') || phone.trim().length < 6) {
        setError(COPY.invalid)
        return
      }
      if (chosen === 'daypass' && !visitDay) {
        setError(ERRORS.visit)
        return
      }
      if (minor && (!guardianName.trim() || !guardianEmail.includes('@') || !guardianConsent)) {
        setError(ERRORS.guardian)
        return
      }
      setStep(2)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!selected) return
    if (!consents.agb || !consents.hausordnung || !consents.widerruf || !consents.privacy || !consents.health || !consents.sign) {
      setError(ERRORS.consent)
      return
    }
    if (signature.trim().toLocaleLowerCase('de-DE') !== `${firstName} ${lastName}`.trim().toLocaleLowerCase('de-DE')) {
      setError(ERRORS.signature)
      return
    }
    setPending(true)
    const honey = String(new FormData(event.currentTarget).get('company') ?? '')
    const result = await submitMembership({
      plan: chosen,
      firstName,
      lastName,
      birthDate,
      street,
      zip,
      city,
      email,
      phone,
      place,
      signature,
      visitDay: chosen === 'daypass' ? visitDay : undefined,
      guardianName: minor ? guardianName : undefined,
      guardianEmail: minor ? guardianEmail : undefined,
      guardianPhone: minor ? guardianPhone : undefined,
      guardianConsent: minor ? guardianConsent : undefined,
      consents,
      company: honey,
    })
    setPending(false)
    if (!result.ok) {
      setError(ERRORS[result.error])
      return
    }
    setDone({ id: result.id, at: new Date().toISOString() })
    window.scrollTo(0, 0)
  }

  if (done && summary) {
    return (
      <main className="page join-page">
        <p className="kicker">{COPY.joinPageKicker}</p>
        <h1>{COPY.successTitle}</h1>
        <p className="lead">{COPY.successLead}</p>
        <article className="contract-sheet">
          <h2>Mitgliedsvertrag · {summary.plan.name}</h2>
          <p>
            {GYM.legalName}, vertreten durch {GYM.partners.join(' und ')}, {GYM.street}, {GYM.zip} {GYM.city}
          </p>
          <dl>
            <div>
              <dt>Mitglied</dt>
              <dd>
                {summary.name}, geboren {birthDate}
              </dd>
            </div>
            <div>
              <dt>Anschrift</dt>
              <dd>
                {street}, {zip} {city}
              </dd>
            </div>
            <div>
              <dt>Kontakt</dt>
              <dd>
                {email} · {phone}
              </dd>
            </div>
            <div>
              <dt>Tarif</dt>
              <dd>
                {summary.plan.name} · {summary.plan.price}€ {summary.plan.unit} · {summary.plan.term}
              </dd>
            </div>
            <div>
              <dt>Aufnahmegebühr</dt>
              <dd>0,00 €</dd>
            </div>
            <div>
              <dt>Vertragsschluss</dt>
              <dd>{new Date(summary.at).toLocaleString('de-DE')}</dd>
            </div>
            {visitDay ? (
              <div>
                <dt>Day Pass</dt>
                <dd>{visitDay}</dd>
              </div>
            ) : null}
            <div>
              <dt>Unterschrift</dt>
              <dd>
                {signature}, {place}
              </dd>
            </div>
          </dl>
          <p>{PAYMENT_NOTE}</p>
          <p>
            AGB Stand {GYM.agbStand} und Hausordnung wurden vor Abschluss zur Verfügung gestellt. Widerruf: 14 Tage.
            {consents.earlyStart ? ' Vorzeitiger Leistungsbeginn wurde verlangt.' : ''}
          </p>
        </article>
        <div className="legal-downloads">
          <a href="/legal/widerrufsbelehrung.pdf">{COPY.withdrawPdf}</a>
        </div>
        <Link className="btn btn-ghost" href="/">
          Zur Startseite
        </Link>
      </main>
    )
  }

  return (
    <main className="page join-page">
      <p className="kicker">{COPY.joinPageKicker}</p>
      <h1>{COPY.joinPageTitle}</h1>
      <p className="lead">{COPY.joinPageLead}</p>

      <ol className="steps">
        <li className={step === 0 ? 'is-on' : ''}>{COPY.stepPlan}</li>
        <li className={step === 1 ? 'is-on' : ''}>{COPY.stepPerson}</li>
        <li className={step === 2 ? 'is-on' : ''}>{COPY.stepLegal}</li>
      </ol>

      <form className="join-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        {step === 0 ? (
          <fieldset className="plan-pick">
            <legend className="sr-only">{COPY.stepPlan}</legend>
            {PLANS.map((item) => (
              <label key={item.id} className={`plan-option accent-${item.accent}`}>
                <input
                  type="radio"
                  name="plan"
                  value={item.id}
                  checked={chosen === item.id}
                  onChange={() => setChosen(item.id)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <em>
                    {item.price}€ {item.unit}
                  </em>
                  <small>{item.term}</small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="form-grid">
            <label>
              {COPY.firstName}
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
            </label>
            <label>
              {COPY.lastName}
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
            </label>
            <label>
              {COPY.birth}
              <input
                type="date"
                name="birthDate"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </label>
            <label className="wide">
              {COPY.street}
              <input value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" required />
            </label>
            <label>
              {COPY.zip}
              <input value={zip} onChange={(e) => setZip(e.target.value)} autoComplete="postal-code" inputMode="numeric" required />
            </label>
            <label>
              {COPY.cityLabel}
              <input value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" required />
            </label>
            <label>
              {COPY.email}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label>
              {COPY.phone}
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
            </label>
            {chosen === 'daypass' ? (
              <label>
                {COPY.visitDay}
                <input type="date" value={visitDay} onChange={(e) => setVisitDay(e.target.value)} required />
              </label>
            ) : null}
            <label className="check wide">
              <input type="checkbox" checked={minor} readOnly />
              <span>{COPY.minor}</span>
            </label>
            {minor ? (
              <>
                <label>
                  {COPY.guardianName}
                  <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required />
                </label>
                <label>
                  {COPY.guardianEmail}
                  <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required />
                </label>
                <label>
                  {COPY.guardianPhone}
                  <input type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} required />
                </label>
                <label className="check wide">
                  <input type="checkbox" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} />
                  <span>{COPY.consentGuardian}</span>
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="legal-step">
            <p>{selected ? `${selected.name} · ${selected.price}€ ${selected.unit} · ${selected.term}` : ''}</p>
            <p>{PAYMENT_NOTE}</p>
            <label className="check">
              <input type="checkbox" checked={consents.agb} onChange={() => toggleConsent('agb')} />
              <span>
                {COPY.consentAgb} <Link href={href('agb')}>{COPY.agb}</Link>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.hausordnung} onChange={() => toggleConsent('hausordnung')} />
              <span>
                {COPY.consentHouse} <Link href={href('hausordnung')}>{COPY.house}</Link>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.widerruf} onChange={() => toggleConsent('widerruf')} />
              <span>
                {COPY.consentWithdraw} <Link href={href('widerruf')}>{COPY.withdraw}</Link>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.privacy} onChange={() => toggleConsent('privacy')} />
              <span>
                {COPY.consentPrivacy} <Link href={href('datenschutz')}>{COPY.privacy}</Link>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.health} onChange={() => toggleConsent('health')} />
              <span>{COPY.consentHealth}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.earlyStart} onChange={() => toggleConsent('earlyStart')} />
              <span>{COPY.consentEarly}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.photos} onChange={() => toggleConsent('photos')} />
              <span>{COPY.consentPhoto}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.newsletter} onChange={() => toggleConsent('newsletter')} />
              <span>{COPY.consentNews}</span>
            </label>
            <label>
              {COPY.place}
              <input value={place} onChange={(e) => setPlace(e.target.value)} required />
            </label>
            <label>
              {COPY.signature}
              <input value={signature} onChange={(e) => setSignature(e.target.value)} required />
            </label>
            <label className="check">
              <input type="checkbox" checked={consents.sign} onChange={() => toggleConsent('sign')} />
              <span>{COPY.consentSign}</span>
            </label>
          </div>
        ) : null}

        <label className="honey" aria-hidden="true">
          Firma
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="form-nav">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((n) => n - 1)}>
              {COPY.back}
            </button>
          ) : null}
          {step < 2 ? (
            <button type="button" className="btn btn-solid" onClick={goNext}>
              {COPY.next}
            </button>
          ) : (
            <button type="submit" className="btn btn-solid" disabled={pending}>
              {pending ? COPY.pending : COPY.submit}
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
