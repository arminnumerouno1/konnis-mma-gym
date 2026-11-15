import { useState, type FormEvent } from 'react'
import { COPY } from '../brand/copy'
import { GYM } from '../brand/gym'
import { honeypotInputProps, useFormStarted } from '../lib/formGuard'
import { Link } from '../lib/Link'
import { href } from '../lib/router'
import { submitCancellation, type CancelKind, type CancelOk } from '../membership/cancel-api'

const KINDS: { id: CancelKind; label: string; help: string }[] = [
  {
    id: 'ordentlich',
    label: 'Ordentliche Kündigung',
    help: 'Zum Ende der Mindestlaufzeit bzw. danach mit einem Monat Frist.',
  },
  {
    id: 'widerruf',
    label: 'Widerruf (14 Tage)',
    help: 'Nur innerhalb der gesetzlichen Widerrufsfrist nach Online-Abschluss.',
  },
  {
    id: 'umzug',
    label: 'Kündigung wegen Umzug (> 50 km)',
    help: 'Hauptwohnsitz mehr als 50 km Luftlinie vom Studio. Meldebescheinigung nachreichen.',
  },
  {
    id: 'ausserordentlich',
    label: 'Außerordentliche Kündigung',
    help: 'Aus wichtigem Grund. Bitte kurz begründen.',
  },
]

const ERRORS: Record<string, string> = {
  name: 'Bitte Vor- und Nachname eintragen.',
  email: 'Bitte eine gültige E-Mail eintragen.',
  kind: 'Bitte die Art der Erklärung wählen.',
  confirm: 'Bitte die Bestätigung setzen.',
  rate: COPY.rate,
  invalid: COPY.invalid,
  upstream: COPY.error,
  network: COPY.error,
}

export function Cancel() {
  const [phase, setPhase] = useState<'gate' | 'form' | 'done'>('gate')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [memberId, setMemberId] = useState('')
  const [kind, setKind] = useState<CancelKind>('ordentlich')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CancelOk | null>(null)
  const formStarted = useFormStarted()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    const honey = String(new FormData(event.currentTarget as HTMLFormElement).get('company') ?? '')
    const response = await submitCancellation({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      memberId: memberId || undefined,
      kind,
      note: note || undefined,
      confirm: true,
      company: honey,
      formStarted,
    })
    setPending(false)
    if (!response.ok) {
      setError(ERRORS[response.error] || COPY.error)
      return
    }
    setResult(response)
    setPhase('done')
    window.scrollTo(0, 0)
  }

  if (phase === 'done' && result) {
    return (
      <main className="page legal-page cancel-page">
        <p className="kicker">Kündigung · § 312k BGB</p>
        <h1>Eingangsbestätigung</h1>
        <p className="lead">
          Deine Erklärung ist eingegangen. Das ist die Bestätigung auf einem dauerhaften Medium (diese Seite und
          E-Mail).
        </p>
        <article className="contract-sheet">
          <h2>{result.kindLabel}</h2>
          <dl>
            <div>
              <dt>Referenz</dt>
              <dd>{result.id}</dd>
            </div>
            <div>
              <dt>Eingang</dt>
              <dd>
                {new Date(result.receivedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
              </dd>
            </div>
            <div>
              <dt>Mitglied</dt>
              <dd>
                {firstName} {lastName} · {email}
              </dd>
            </div>
            {result.suggestedEnd ? (
              <div>
                <dt>Voraussichtliches Ende (Berechnung)</dt>
                <dd>{new Date(`${result.suggestedEnd}T12:00:00`).toLocaleDateString('de-DE')}</dd>
              </div>
            ) : null}
          </dl>
          <p>
            Wir prüfen die Erklärung und setzen sie um. Eine Kopie geht an {email}. Bei Fragen:{' '}
            <a href={`mailto:${GYM.legalEmail}`}>{GYM.legalEmail}</a>
          </p>
        </article>
        <p className="legal-back">
          <Link href="/">Zur Startseite</Link>
          {' · '}
          <Link href={href('widerruf')}>{COPY.withdraw}</Link>
        </p>
      </main>
    )
  }

  if (phase === 'gate') {
    return (
      <main className="page legal-page cancel-page">
        <p className="kicker">Dauerschuldverhältnis · Online</p>
        <h1>Verträge kündigen</h1>
        <p className="lead">
          Hier kannst du eine online abgeschlossene Mitgliedschaft kündigen oder widerrufen — gesetzliche
          Kündigungsschaltfläche nach § 312k BGB.
        </p>
        <p>
          Nach dem Klick öffnet sich die Bestätigungsseite. Dort gibst du die nötigen Angaben ein und erklärst die
          Kündigung verbindlich.
        </p>
        <button type="button" className="btn btn-solid btn-xl" onClick={() => setPhase('form')}>
          Verträge hier kündigen
        </button>
        <p className="field-hint" style={{ marginTop: '1.25rem' }}>
          Alternativ per E-Mail an <a href={`mailto:${GYM.legalEmail}`}>{GYM.legalEmail}</a>. Widerruf innerhalb von 14
          Tagen: siehe <Link href={href('widerruf')}>{COPY.withdraw}</Link>.
        </p>
        <p className="legal-back">
          <Link href="/">Zur Startseite</Link>
          {' · '}
          <Link href={href('agb')}>{COPY.agb}</Link>
        </p>
      </main>
    )
  }

  return (
    <main className="page legal-page cancel-page">
      <p className="kicker">Bestätigungsseite · § 312k BGB</p>
      <h1>Kündigung bestätigen</h1>
      <p className="lead">
        Bitte alle Felder ausfüllen und absenden. Mit dem Absenden erklärst du die Kündigung bzw. den Widerruf
        verbindlich.
      </p>

      <form className="join-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="form-grid">
          <label>
            Vorname
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
          </label>
          <label>
            Nachname
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
          </label>
          <label>
            E-Mail (Vertrags-Mail)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Telefon (optional)
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </label>
          <label className="wide">
            Vertrags- / Mitglieder-ID (optional)
            <input value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Falls bekannt" />
          </label>
        </div>

        <fieldset className="pay-pick" style={{ marginTop: '1.25rem' }}>
          <legend>Art der Erklärung</legend>
          {KINDS.map((item) => (
            <label key={item.id} className="check">
              <input
                type="radio"
                name="cancelKind"
                checked={kind === item.id}
                onChange={() => setKind(item.id)}
              />
              <span>
                <strong>{item.label}</strong>
                <br />
                <span className="field-hint">{item.help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="wide" style={{ display: 'block', marginTop: '1rem' }}>
          Nachricht / Begründung (optional, bei außerordentlich empfohlen)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        </label>

        <label className="check" style={{ marginTop: '1rem' }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} required />
          <span>
            Ich bestätige diese Erklärung verbindlich. Ich habe die{' '}
            <Link href={href('agb')}>AGB</Link> zur Laufzeit und Kündigung zur Kenntnis genommen.
          </span>
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

        <div className="form-nav">
          <button type="button" className="btn btn-ghost" onClick={() => setPhase('gate')}>
            Zurück
          </button>
          <button type="submit" className="btn btn-solid" disabled={pending || !confirm}>
            {pending ? 'Wird gesendet…' : 'Kündigung verbindlich erklären'}
          </button>
        </div>
      </form>
    </main>
  )
}
