import { useEffect, useRef, useState, type FormEvent } from 'react'
import { GYM } from '../brand/gym'
import { InstagramIcon } from '../components/InstagramIcon'
import { Link } from '../lib/Link'
import { href } from '../lib/router'

const SPORTS = ['MMA', 'BOXEN', 'RINGEN', 'BJJ', 'K1', 'FITNESS BOXEN', 'SONSTIGES'] as const
const SOURCES = ['Instagram', 'Freunde und Bekannte', 'Tiktok', 'Google', 'Sonstiges'] as const
const OFFERS = [
  ['ja', 'Ja'],
  ['nein', 'Nein'],
  ['vielleicht', 'Vielleicht'],
] as const

type FieldKey =
  | 'name'
  | 'age'
  | 'email'
  | 'phone'
  | 'sports'
  | 'experience'
  | 'times'
  | 'offer'
  | 'sources'
  | 'notify'
  | 'goal'
  | 'consent'

const MESSAGES: Record<FieldKey, string> = {
  name: 'Bitte Vor- und Nachnamen eintragen.',
  age: 'Bitte dein Alter als Zahl eintragen.',
  email: 'Bitte eine gültige E-Mail-Adresse eintragen.',
  phone: 'Die Nummer sieht nicht ganz richtig aus. Du kannst das Feld auch leer lassen.',
  sports: 'Bitte mindestens eine Sportart wählen.',
  experience: 'Schreib kurz, wie viel Erfahrung du hast. „Keine“ ist völlig okay.',
  times: 'Wann passt es dir am besten? Zum Beispiel „abends ab 18 Uhr“.',
  offer: 'Bitte eine Antwort wählen.',
  sources: 'Bitte mindestens eine Antwort wählen.',
  notify: 'Bitte eine Antwort wählen.',
  goal: 'Was möchtest du erreichen? Ein Satz reicht.',
  consent: 'Bitte bestätige, dass wir deine Angaben speichern dürfen.',
}

const NAME_RE = /^[\p{L}][\p{L}\s.'-]{1,79}$/u
const PHONE_RE = /^[+0-9][0-9 ()/-]{5,24}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function Preregister() {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sports, setSports] = useState<string[]>([])
  const [sportsOther, setSportsOther] = useState('')
  const [experience, setExperience] = useState('')
  const [times, setTimes] = useState('')
  const [offer, setOffer] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [sourceOther, setSourceOther] = useState('')
  const [notify, setNotify] = useState<boolean | null>(null)
  const [goal, setGoal] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [done, setDone] = useState<{ repeat: boolean } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.title
    document.title = 'Voranmeldung · KONNI MMA GYM Leipzig'
    return () => {
      document.title = previous
    }
  }, [])

  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  function validate() {
    const next: Partial<Record<FieldKey, string>> = {}
    const trimmedName = name.trim().replace(/\s+/g, ' ')
    if (!NAME_RE.test(trimmedName) || !trimmedName.includes(' ')) next.name = MESSAGES.name
    const ageNumber = Number(age)
    if (!Number.isInteger(ageNumber) || ageNumber < 5 || ageNumber > 99) next.age = MESSAGES.age
    if (!EMAIL_RE.test(email.trim())) next.email = MESSAGES.email
    if (phone.trim() && !PHONE_RE.test(phone.trim())) next.phone = MESSAGES.phone
    if (!sports.length) next.sports = MESSAGES.sports
    if (!experience.trim()) next.experience = MESSAGES.experience
    if (!times.trim()) next.times = MESSAGES.times
    if (!offer) next.offer = MESSAGES.offer
    if (!sources.length) next.sources = MESSAGES.sources
    if (notify === null) next.notify = MESSAGES.notify
    if (!goal.trim()) next.goal = MESSAGES.goal
    if (!consent) next.consent = MESSAGES.consent
    return next
  }

  function focusFirstError(keys: FieldKey[]) {
    const first = keys[0]
    if (!first) return
    window.requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true })
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailed(null)
    const found = validate()
    setErrors(found)
    const keys = Object.keys(found) as FieldKey[]
    if (keys.length) {
      focusFirstError(keys)
      return
    }
    setPending(true)
    const honey = String(new FormData(event.currentTarget).get('company') ?? '')
    try {
      const response = await fetch('/api/voranmeldung', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          name,
          age,
          email,
          phone,
          sports,
          sportsOther,
          experience,
          times,
          offer,
          sources,
          sourceOther,
          notify,
          goal,
          message,
          consent,
          company: honey,
        }),
      })
      const data = (await response.json()) as { ok?: boolean; error?: string; repeat?: boolean }
      if (data.ok) {
        setDone({ repeat: Boolean(data.repeat) })
        window.scrollTo({ top: 0 })
        return
      }
      if (response.status === 429) {
        setFailed('Gerade kamen zu viele Anfragen von deinem Anschluss. Versuch es in ein paar Minuten nochmal.')
        return
      }
      const field = data.error as FieldKey | undefined
      if (field && field in MESSAGES) {
        setErrors({ [field]: MESSAGES[field] })
        focusFirstError([field])
        return
      }
      setFailed(`Das hat leider nicht geklappt. Versuch es bitte gleich nochmal oder schreib uns an ${GYM.email}.`)
    } catch {
      setFailed('Keine Verbindung. Prüf kurz dein Internet und schick das Formular dann nochmal ab.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    const first = name.trim().split(/\s+/)[0]
    return (
      <main className="page prereg-page">
        <div className="prereg-done" ref={doneRef} tabIndex={-1} role="status">
          <p className="kicker">Voranmeldung</p>
          <h1>Danke, {first}!</h1>
          <p className="lead">
            {done.repeat
              ? 'Wir hatten dich schon auf der Liste und haben deine Angaben jetzt aktualisiert.'
              : 'Du stehst auf unserer Liste. Sobald Probetrainings und Anmeldungen möglich sind, melden wir uns bei dir.'}
          </p>
          <p>Bis dahin gibt es auf Instagram Einblicke in den Aufbau, das Team und alles rund um die Eröffnung.</p>
          <div className="join-closed-actions">
            <a className="btn btn-solid prereg-ig" href={GYM.instagram} target="_blank" rel="noreferrer">
              <InstagramIcon size={18} />
              {GYM.instagramHandle}
            </a>
            <Link className="btn btn-ghost" href="/">
              Zur Startseite
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const fieldClass = (key: FieldKey, extra = '') => `prereg-q ${extra} ${errors[key] ? 'has-error' : ''}`.trim()
  const errorText = (key: FieldKey) =>
    errors[key] ? (
      <span className="prereg-error" id={`prereg-${key}-error`}>
        {errors[key]}
      </span>
    ) : null
  const described = (key: FieldKey) => (errors[key] ? `prereg-${key}-error` : undefined)

  return (
    <main className="page prereg-page">
      <header className="prereg-head">
        <p className="kicker">Voranmeldung</p>
        <h1>Sei von Anfang an dabei.</h1>
        <p className="lead">
          Wir bauen gerade mit viel Leidenschaft ein MMA-Gym auf, in dem jeder willkommen ist: vom kompletten Anfänger
          über Fortgeschrittene und Amateurkämpfer bis zu Profis.
        </p>
        <p>
          Egal, ob du kämpfen, technisch besser werden, fitter werden oder einfach Spaß am Kampfsport haben willst. Wir
          begleiten dich auf deinem Weg. Mit der unverbindlichen Voranmeldung erfährst du als Erstes von Eröffnung,
          Probetrainings und Eröffnungsangeboten.
        </p>
        <p className="prereg-meta">Dauert etwa zwei Minuten · unverbindlich · kostenlos</p>
      </header>

      <form ref={formRef} className="prereg-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="prereg-grid">
          <label className={fieldClass('name')} data-field="name">
            <span className="prereg-label">Vor- und Nachname</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={described('name')}
              required
            />
            {errorText('name')}
          </label>
          <label className={fieldClass('age')} data-field="age">
            <span className="prereg-label">Alter</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              inputMode="numeric"
              aria-invalid={Boolean(errors.age)}
              aria-describedby={described('age')}
              required
            />
            {errorText('age')}
          </label>
          <label className={fieldClass('email')} data-field="email">
            <span className="prereg-label">E-Mail-Adresse</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={described('email')}
              required
            />
            {errorText('email')}
          </label>
          <label className={fieldClass('phone')} data-field="phone">
            <span className="prereg-label">
              Telefonnummer <em>freiwillig</em>
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={described('phone')}
            />
            {errorText('phone')}
          </label>
        </div>

        <fieldset className={fieldClass('sports')} data-field="sports" aria-describedby={described('sports')}>
          <legend className="prereg-label">
            Welche Sportarten interessieren dich? <em>mehrere möglich</em>
          </legend>
          <div className="prereg-chips">
            {SPORTS.map((sport) => (
              <label key={sport} className="prereg-chip">
                <input
                  type="checkbox"
                  checked={sports.includes(sport)}
                  onChange={() => setSports((list) => toggle(list, sport))}
                />
                <span>{sport === 'SONSTIGES' ? 'Sonstiges' : sport === 'FITNESS BOXEN' ? 'Fitness-Boxen' : sport}</span>
              </label>
            ))}
          </div>
          {sports.includes('SONSTIGES') ? (
            <input
              className="prereg-other"
              value={sportsOther}
              onChange={(e) => setSportsOther(e.target.value)}
              placeholder="Welche Sportart?"
              aria-label="Sonstige Sportart"
              maxLength={80}
            />
          ) : null}
          {errorText('sports')}
        </fieldset>

        <label className={fieldClass('experience')} data-field="experience">
          <span className="prereg-label">Wie viel Erfahrung hast du im Kampfsport?</span>
          <textarea
            rows={2}
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="Zum Beispiel: keine, ein Jahr Boxen, früher Ringen im Verein …"
            aria-invalid={Boolean(errors.experience)}
            aria-describedby={described('experience')}
            maxLength={400}
          />
          {errorText('experience')}
        </label>

        <label className={fieldClass('times')} data-field="times">
          <span className="prereg-label">Welche Trainingszeiten passen dir am besten?</span>
          <textarea
            rows={2}
            value={times}
            onChange={(e) => setTimes(e.target.value)}
            placeholder="Zum Beispiel: morgens, abends ab 18 Uhr, am Wochenende …"
            aria-invalid={Boolean(errors.times)}
            aria-describedby={described('times')}
            maxLength={300}
          />
          {errorText('times')}
        </label>

        <fieldset className={fieldClass('offer')} data-field="offer" aria-describedby={described('offer')}>
          <legend className="prereg-label">Hättest du Interesse an einer Mitgliedschaft zum Eröffnungspreis?</legend>
          <div className="prereg-chips">
            {OFFERS.map(([value, label]) => (
              <label key={value} className="prereg-chip">
                <input type="radio" name="offer" checked={offer === value} onChange={() => setOffer(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {errorText('offer')}
        </fieldset>

        <fieldset className={fieldClass('sources')} data-field="sources" aria-describedby={described('sources')}>
          <legend className="prereg-label">
            Wie hast du von uns erfahren? <em>mehrere möglich</em>
          </legend>
          <div className="prereg-chips">
            {SOURCES.map((source) => (
              <label key={source} className="prereg-chip">
                <input
                  type="checkbox"
                  checked={sources.includes(source)}
                  onChange={() => setSources((list) => toggle(list, source))}
                />
                <span>{source === 'Tiktok' ? 'TikTok' : source}</span>
              </label>
            ))}
          </div>
          {sources.includes('Sonstiges') ? (
            <input
              className="prereg-other"
              value={sourceOther}
              onChange={(e) => setSourceOther(e.target.value)}
              placeholder="Wo hast du von uns gehört?"
              aria-label="Sonstige Quelle"
              maxLength={80}
            />
          ) : null}
          {errorText('sources')}
        </fieldset>

        <fieldset className={fieldClass('notify')} data-field="notify" aria-describedby={described('notify')}>
          <legend className="prereg-label">
            Möchtest du informiert werden, sobald Probetrainings und Anmeldungen möglich sind?
          </legend>
          <div className="prereg-chips">
            <label className="prereg-chip">
              <input type="radio" name="notify" checked={notify === true} onChange={() => setNotify(true)} />
              <span>Ja</span>
            </label>
            <label className="prereg-chip">
              <input type="radio" name="notify" checked={notify === false} onChange={() => setNotify(false)} />
              <span>Nein</span>
            </label>
          </div>
          {errorText('notify')}
        </fieldset>

        <label className={fieldClass('goal')} data-field="goal">
          <span className="prereg-label">Was ist dein persönliches Ziel?</span>
          <textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Fitter werden, abnehmen, Selbstverteidigung, den ersten Kampf bestreiten …"
            aria-invalid={Boolean(errors.goal)}
            aria-describedby={described('goal')}
            maxLength={600}
          />
          {errorText('goal')}
        </label>

        <label className="prereg-q">
          <span className="prereg-label">
            Noch Fragen, Wünsche oder ein anderes Anliegen? <em>freiwillig</em>
          </span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} />
        </label>

        <label className="honey" aria-hidden="true">
          Firma
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>

        <label className={`check prereg-consent ${errors.consent ? 'has-error' : ''}`} data-field="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Ihr dürft meine Angaben speichern und mich zur Eröffnung, zu Probetrainings und zur Mitgliedschaft
            kontaktieren. Das kann ich jederzeit per Mail an {GYM.email} widerrufen. Mehr dazu in der{' '}
            <Link href={href('datenschutz')}>Datenschutzerklärung</Link>.
          </span>
        </label>
        {errorText('consent')}

        {failed ? (
          <p className="form-error" role="alert">
            {failed}
          </p>
        ) : null}

        <button className="btn btn-solid btn-xl" type="submit" disabled={pending}>
          {pending ? 'Wird gesendet …' : 'Jetzt unverbindlich voranmelden'}
        </button>
        <p className="prereg-foot">
          Wir freuen uns darauf, dich vielleicht schon bald bei uns im Training zu sehen. Folge uns auf{' '}
          <a href={GYM.instagram} target="_blank" rel="noreferrer">
            Instagram {GYM.instagramHandle}
          </a>{' '}
          für Updates und Einblicke.
        </p>
      </form>
    </main>
  )
}
