import { useState, type FormEvent } from 'react'
import { COPY } from '../brand/copy'
import { submitWaitlist, type WaitlistConfirmation } from './api'

type WaitlistFormProps = {
  variant?: 'overlay' | 'page'
}

const successCopy: Record<WaitlistConfirmation, string> = {
  email: COPY.waitlistSuccessEmail,
  listed: COPY.waitlistSuccessListed,
  saved: COPY.waitlistSuccessSaved,
  duplicate: COPY.waitlistSuccessDuplicate,
}

const errorCopy = {
  email: COPY.waitlistInvalid,
  name: COPY.waitlistInvalid,
  consent: COPY.waitlistInvalid,
  rate: COPY.waitlistRate,
  upstream: COPY.waitlistError,
  network: COPY.waitlistError,
  invalid: COPY.waitlistError,
} as const

export function WaitlistForm({ variant = 'overlay' }: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState<WaitlistConfirmation | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (name.trim().length < 2 || !email.trim() || !consent) {
      setError(COPY.waitlistInvalid)
      return
    }
    setPending(true)
    const honey = String(new FormData(event.currentTarget).get('company') ?? '')
    const result = await submitWaitlist({ email, name, consent, company: honey })
    setPending(false)
    if (result.ok) {
      setSuccess(result.confirmation)
      return
    }
    setError(errorCopy[result.error])
  }

  if (success) {
    return (
      <div className={`waitlist waitlist-${variant} is-done`} role="status">
        <p className="waitlist-kicker">{COPY.waitlistKicker}</p>
        <p className="waitlist-success">{successCopy[success]}</p>
      </div>
    )
  }

  return (
    <form className={`waitlist waitlist-${variant}`} onSubmit={(event) => void onSubmit(event)} noValidate>
      <p className="waitlist-kicker">{COPY.waitlistKicker}</p>
      <p className="waitlist-lead">{COPY.waitlistLead}</p>

      <label className="waitlist-sr" htmlFor={`waitlist-email-${variant}`}>
        {COPY.waitlistEmail}
      </label>
      <label className="waitlist-sr" htmlFor={`waitlist-name-${variant}`}>
        {COPY.waitlistName}
      </label>
      <div className="waitlist-fields">
        <input
          id={`waitlist-email-${variant}`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={COPY.waitlistEmail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          id={`waitlist-name-${variant}`}
          name="name"
          type="text"
          autoComplete="given-name"
          placeholder={COPY.waitlistName}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          autoCapitalize="words"
        />
        <button type="submit" disabled={pending}>
          {pending ? COPY.waitlistPending : COPY.waitlistSubmit}
        </button>
      </div>

      <label className="waitlist-honey" aria-hidden="true">
        Firma
        <input name="company" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="waitlist-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
        />
        <span>
          {COPY.waitlistConsent}{' '}
          <a href="/impressum.html#warteliste" target="_blank" rel="noreferrer">
            {COPY.waitlistPrivacy}
          </a>
          .
        </span>
      </label>

      {error ? (
        <p className="waitlist-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
