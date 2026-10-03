import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { COPY } from '../brand/copy'
import { StreetInput } from '../components/StreetInput'
import { GYM } from '../brand/gym'
import { FIRST50, PAYMENT_NOTE, PUBLIC_PLANS, SIGNUP_OPEN, isPublicPlanId, planById, type PlanId } from '../brand/plans'
import { Link } from '../lib/Link'
import { ageFromIso } from '../lib/motion'
import { href } from '../lib/router'
import { lookupInvite, submitMembership, type MembershipConsents, type MembershipError } from '../membership/api'

const ERRORS: Record<MembershipError, string> = {
  plan: 'Bitte einen Tarif wählen.',
  first50: 'Dieser Tarif ist nur mit persönlichem Link buchbar.',
  invite: COPY.inviteBad,
  expired: COPY.inviteExpired,
  name: COPY.invalid,
  birth: 'Bitte ein gültiges Geburtsdatum eintragen.',
  address: 'Bitte Straße, PLZ und Ort prüfen.',
  email: 'Bitte eine gültige E-Mail eintragen.',
  phone: 'Bitte eine Telefonnummer eintragen.',
  guardian: 'Unter 18 braucht die gesetzliche Vertretung inkl. Zustimmung.',
  consent: 'Bitte alle Pflicht-Häkchen setzen.',
  place: 'Bitte den Ort der Unterschrift eintragen.',
  signature: 'Bitte die Unterschrift eintragen.',
  visit: 'Bitte einen Tag für den Day Pass wählen.',
  pay: 'Banküberweisung gibt es für den Day Pass nicht. Bitte Karte oder Apple Pay wählen.',
  rate: COPY.rate,
  closed: COPY.joinClosedError,
  upstream: COPY.error,
  network: COPY.error,
  invalid: COPY.invalid,
}

type JoinProps = {
  plan: string | null
  invite: string | null
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

function scrollJoinStepIntoView(target: HTMLElement | null) {
  if (!target) return
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()
  target.scrollIntoView({ behavior: 'auto', block: 'start' })
  if (typeof target.focus === 'function') target.focus({ preventScroll: true })
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'auto', block: 'start' })
  })
}

function splitInviteName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' }
}

function JoinClosed({ invite }: { invite: string | null }) {
  return (
    <main className="page join-page">
      <p className="kicker">{COPY.joinClosedKicker}</p>
      <h1>{COPY.joinClosedTitle}</h1>
      <p className="lead">{COPY.joinClosedLead}</p>
      {invite ? <p className="lead">{COPY.joinClosedInvite}</p> : null}
      <div className="join-closed-actions">
        <Link className="btn btn-solid" href="/">
          {COPY.joinClosedHome}
        </Link>
        <Link className="btn btn-ghost" href="/#kontakt">
          {COPY.navContact}
        </Link>
      </div>
    </main>
  )
}

function paymentReturn() {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('zahlung')
  if (value === 'ok' || value === 'abgebrochen') return value
  return null
}

function beforeFirstCharge() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return today < '2026-11-01'
}

function JoinPayResult({ status }: { status: 'ok' | 'abgebrochen' }) {
  useEffect(() => {
    if (status !== 'ok') return
    const sessionId = new URLSearchParams(window.location.search).get('session_id') ?? ''
    if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) return
    void fetch('/api/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => undefined)
  }, [status])
  const lead = status === 'ok' ? (beforeFirstCharge() ? COPY.payReturnOk : COPY.payReturnOkNow) : COPY.payReturnCancel
  return (
    <main className="page join-page">
      <p className="kicker">{COPY.joinPageKicker}</p>
      <h1>{status === 'ok' ? 'Zahlung ist eingerichtet.' : 'Zahlung abgebrochen.'}</h1>
      <p className="lead">{lead}</p>
      <div className="join-closed-actions">
        <Link className="btn btn-solid" href="/">
          Zur Startseite
        </Link>
      </div>
    </main>
  )
}

export function Join({ plan, invite }: JoinProps) {
  const returned = paymentReturn()
  if (returned) return <JoinPayResult status={returned} />
  if (!SIGNUP_OPEN) return <JoinClosed invite={invite} />
  return <JoinForm plan={plan} invite={invite} />
}

function JoinForm({ plan, invite }: JoinProps) {
  const initial = plan && isPublicPlanId(plan) ? plan : 'standard'
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<PlanId>(initial)
  const [inviteReady, setInviteReady] = useState(!invite)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSlot, setInviteSlot] = useState<number | null>(null)
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
  const [payMethod, setPayMethod] = useState<'card' | 'transfer'>('card')
  const [done, setDone] = useState<{
    id?: string
    at: string
    payment?: 'checkout' | 'later' | 'unlinked' | 'transfer'
    transfer?: { iban: string; bic: string; holder: string; bank: string; amount: number }
  } | null>(null)
  const pageRef = useRef<HTMLElement>(null)
  const stepAnchorRef = useRef<HTMLOListElement>(null)
  const skipStepScroll = useRef(true)

  const selected = planById(chosen)
  const age = ageFromIso(birthDate)
  const minor = age != null && age < 18
  const inviteLocked = Boolean(invite) && chosen === 'first50'
  const visiblePlans = inviteLocked ? [FIRST50] : PUBLIC_PLANS

  useEffect(() => {
    if (!invite) return
    let alive = true
    void lookupInvite(invite).then((result) => {
      if (!alive) return
      if (!result.ok) {
        setInviteError(ERRORS[result.error] ?? COPY.inviteBad)
        setInviteReady(true)
        return
      }
      const names = splitInviteName(result.invite.name)
      setChosen('first50')
      setInviteSlot(result.invite.slot)
      setEmail(result.invite.email)
      setFirstName(names.firstName)
      setLastName(names.lastName)
      setStep(1)
      setInviteReady(true)
    })
    return () => {
      alive = false
    }
  }, [invite])

  useLayoutEffect(() => {
    if (done || !inviteReady) return
    if (skipStepScroll.current) {
      skipStepScroll.current = false
      return
    }
    scrollJoinStepIntoView(stepAnchorRef.current ?? pageRef.current)
  }, [step, inviteReady, done])

  const summary = useMemo(() => {
    if (!selected || !done) return null
    return {
      plan: selected,
      name: `${firstName} ${lastName}`,
      at: done.at,
      payment: done.payment,
      transfer: done.transfer,
    }
  }, [selected, done, firstName, lastName])

  function toggleConsent(key: keyof MembershipConsents) {
    setConsents((current) => ({ ...current, [key]: !current[key] }))
  }

  function goBack() {
    setError(null)
    if (inviteLocked && step <= 1) return
    setStep((n) => n - 1)
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
      if (
        minor &&
        (!guardianName.trim() || !guardianEmail.includes('@') || guardianPhone.trim().length < 6 || !guardianConsent)
      ) {
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
    if (signature.trim().replace(/\s+/g, ' ').length < 2) {
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
      invite: invite || undefined,
      company: honey,
      payMethod: chosen === 'daypass' ? 'card' : payMethod,
    })
    setPending(false)
    if (!result.ok) {
      setError(ERRORS[result.error])
      return
    }
    if (result.checkoutUrl?.startsWith('https://checkout.stripe.com/')) {
      window.location.assign(result.checkoutUrl)
      return
    }
    setDone({
      id: result.id,
      at: new Date().toISOString(),
      payment: result.payment,
      transfer: result.transfer,
    })
    window.scrollTo(0, 0)
  }

  if (done && summary) {
    return (
      <main className="page join-page">
        <p className="kicker">{COPY.joinPageKicker}</p>
        <h1>{COPY.successTitle}</h1>
        <p className="lead">{COPY.successLead}</p>
        {summary.payment === 'later' ? (
          <p className="lead">{summary.plan.id === 'daypass' ? COPY.payDayLater : COPY.payLater}</p>
        ) : null}
        {summary.payment === 'transfer' && summary.transfer ? (
          <div className="transfer-box">
            <p className="lead">{COPY.payTransferDone}</p>
            <dl>
              <div>
                <dt>Betrag</dt>
                <dd>{(summary.transfer.amount / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} im Monat</dd>
              </div>
              <div>
                <dt>Kontoinhaber</dt>
                <dd>{summary.transfer.holder}</dd>
              </div>
              <div>
                <dt>IBAN</dt>
                <dd>{summary.transfer.iban.replace(/(.{4})/g, '$1 ').trim()}</dd>
              </div>
              <div>
                <dt>BIC</dt>
                <dd>{summary.transfer.bic}</dd>
              </div>
              <div>
                <dt>Bank</dt>
                <dd>{summary.transfer.bank}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {summary.payment === 'unlinked' || !summary.payment ? <p className="lead">{COPY.payUnlinked}</p> : null}
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
            {summary.plan.id === 'daypass' ? null : (
              <div>
                <dt>Aufnahmegebühr</dt>
                <dd>0,00 €, nur bis zum 2. November 2026. Danach beträgt sie 49 €.</dd>
              </div>
            )}
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
            {minor ? (
              <div>
                <dt>Gesetzliche Vertretung</dt>
                <dd>
                  {guardianName} · {guardianEmail} · {guardianPhone}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Unterschrift</dt>
              <dd>
                {signature}, {place}
              </dd>
            </div>
            <div>
              <dt>{COPY.consentEarlyKicker}</dt>
              <dd>{consents.earlyStart ? COPY.earlyStartYes : COPY.earlyStartNo}</dd>
            </div>
          </dl>
          <p>{summary.plan.id === 'daypass' ? COPY.payDayNote : PAYMENT_NOTE}</p>
          <p>
            AGB Stand {GYM.agbStand} und Hausordnung wurden vor Abschluss zur Verfügung gestellt. Widerruf: 14 Tage.
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

  if (!inviteReady) {
    return (
      <main className="page join-page">
        <p className="kicker">{COPY.joinPageKicker}</p>
        <h1>{COPY.joinPageTitle}</h1>
        <p className="lead">{COPY.inviteChecking}</p>
      </main>
    )
  }

  return (
    <main className="page join-page" ref={pageRef}>
      <p className="kicker">{COPY.joinPageKicker}</p>
      <h1>{COPY.joinPageTitle}</h1>
      <p className="lead">{inviteLocked ? COPY.inviteLead : COPY.joinPageLead}</p>

      {inviteError ? (
        <p className="form-error" role="alert">
          {inviteError}
        </p>
      ) : null}

      {inviteLocked ? (
        <div className="invite-banner">
          <strong>
            First 50
            {inviteSlot != null ? ` · Platz ${inviteSlot} von 50` : ''} · 89,99€
          </strong>
          <p>{COPY.inviteLockedNote}</p>
        </div>
      ) : null}

      <ol className="steps" ref={stepAnchorRef} tabIndex={-1}>
        <li className={step === 0 ? 'is-on' : ''}>{COPY.stepPlan}</li>
        <li className={step === 1 ? 'is-on' : ''}>{COPY.stepPerson}</li>
        <li className={step === 2 ? 'is-on' : ''}>{COPY.stepLegal}</li>
      </ol>

      <form className="join-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        {step === 0 ? (
          <fieldset className="plan-pick">
            <legend className="sr-only">{COPY.stepPlan}</legend>
            {visiblePlans.map((item) => (
              <label key={item.id} className={`plan-option accent-${item.accent}`}>
                <input
                  type="radio"
                  name="plan"
                  value={item.id}
                  checked={chosen === item.id}
                  disabled={inviteLocked}
                  onChange={() => {
                    if (!inviteLocked) setChosen(item.id)
                  }}
                />
                <span>
                  <strong>{item.name}</strong>
                  <em>
                    {item.price}€ {item.unit}
                  </em>
                  <small>{item.term}</small>
                  {item.id === 'daypass' ? null : (
                    <small className="price-fee">
                      <strong>{COPY.signupFeePrice}</strong>
                      <span>{COPY.signupFeeLabel}</span>
                    </small>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="form-grid">
            <label>
              {COPY.firstName}
              <input
                value={firstName}
                onChange={(e) => {
                  if (!inviteLocked) setFirstName(e.target.value)
                }}
                autoComplete="given-name"
                readOnly={inviteLocked}
                className={inviteLocked ? 'is-locked' : undefined}
                required
              />
            </label>
            <label>
              {COPY.lastName}
              <input
                value={lastName}
                onChange={(e) => {
                  if (!inviteLocked) setLastName(e.target.value)
                }}
                autoComplete="family-name"
                readOnly={inviteLocked}
                className={inviteLocked ? 'is-locked' : undefined}
                required
              />
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
              <span className="field-hint">{COPY.birthHint}</span>
            </label>
            <label className="wide">
              {COPY.street}
              <StreetInput
                value={street}
                onChange={setStreet}
                onPick={(pick) => {
                  setStreet(pick.street)
                  setZip(pick.zip)
                  setCity(pick.city)
                }}
                required
              />
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
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  if (!inviteLocked) setEmail(e.target.value)
                }}
                autoComplete="email"
                readOnly={inviteLocked}
                className={inviteLocked ? 'is-locked' : undefined}
                required
              />
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
            {minor ? (
              <div className="minor-block wide">
                <p className="minor-kicker">{COPY.minorTitle}</p>
                <p className="minor-lead">{COPY.minorLead}</p>
                <div className="form-grid">
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
                    <input
                      type="checkbox"
                      checked={guardianConsent}
                      onChange={(e) => setGuardianConsent(e.target.checked)}
                    />
                    <span>{COPY.consentGuardian}</span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="legal-step">
            <p>{selected ? `${selected.name} · ${selected.price}€ ${selected.unit} · ${selected.term}` : ''}</p>
            {minor ? <p>{COPY.minorLegalNote}</p> : null}
            <fieldset className="pay-pick">
              <legend>Zahlungsweise</legend>
              <label className="check">
                <input
                  type="radio"
                  name="payMethod"
                  checked={payMethod === 'card' || chosen === 'daypass'}
                  onChange={() => setPayMethod('card')}
                />
                <span>{COPY.payCard}</span>
              </label>
              {chosen !== 'daypass' ? (
                <label className="check">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={payMethod === 'transfer'}
                    onChange={() => setPayMethod('transfer')}
                  />
                  <span>{COPY.payTransfer}</span>
                </label>
              ) : null}
            </fieldset>
            <p>{chosen === 'daypass' ? COPY.payDayNote : PAYMENT_NOTE}</p>
            {chosen !== 'daypass' && payMethod === 'transfer' ? <p>{COPY.payTransferNote}</p> : null}
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
                {' · '}
                <a href="/legal/widerrufsbelehrung.pdf">{COPY.withdrawPdf}</a>
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
            <div className="early-start">
              <p className="early-start-kicker">{COPY.consentEarlyKicker}</p>
              <p className="early-start-hint">{COPY.consentEarlyHint}</p>
              <label className="check">
                <input type="checkbox" checked={consents.earlyStart} onChange={() => toggleConsent('earlyStart')} />
                <span>
                  {COPY.consentEarly} <Link href={href('widerruf')}>{COPY.withdraw}</Link>
                </span>
              </label>
            </div>
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
          {step > 0 && !(inviteLocked && step === 1) ? (
            <button type="button" className="btn btn-ghost" onClick={goBack}>
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
