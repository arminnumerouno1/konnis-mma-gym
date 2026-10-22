import { useEffect, useState, type FormEvent } from 'react'
import { compressPhoto } from '../lib/photo'

type Phase = 'loading' | 'ready' | 'done' | 'error'

const ERRORS: Record<string, string> = {
  token: 'Dieser Link ist ungültig.',
  expired: 'Dieser Link ist abgelaufen. Melde dich kurz bei uns, dann schicken wir einen neuen.',
  missing: 'Wir finden dein Mitgliedschaftskonto nicht. Bitte schreib an info@mma-in-leipzig.de.',
  closed: 'Für dieses Konto ist kein Upload mehr nötig.',
  photo: 'Bitte ein Portraitfoto wählen, auf dem dein Gesicht klar zu erkennen ist.',
  network: 'Netzwerkfehler. Bitte noch einmal versuchen.',
  upstream: 'Upload hat nicht geklappt. Bitte gleich noch einmal.',
}

export function PortraitUpload({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [firstName, setFirstName] = useState('')
  const [hasPhoto, setHasPhoto] = useState(false)
  const [days, setDays] = useState(14)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setPhase('error')
      setError(ERRORS.token)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/portrait?t=${encodeURIComponent(token)}`, {
          headers: { accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || !data.ok) {
          setPhase('error')
          setError(ERRORS[String(data.error)] || ERRORS.token)
          return
        }
        setFirstName(String(data.firstName || ''))
        setHasPhoto(Boolean(data.hasPhoto))
        setDays(Number(data.days) || 14)
        setPhase('ready')
      } catch {
        if (!cancelled) {
          setPhase('error')
          setError(ERRORS.network)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      setPreview(await compressPhoto(file))
    } catch {
      setError(ERRORS.photo)
      setPreview(null)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !preview) {
      setError(ERRORS.photo)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/portrait', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token, photoData: preview }),
      })
      const data = await response.json().catch(() => ({}))
      setBusy(false)
      if (!response.ok || !data.ok) {
        setError(ERRORS[String(data.error)] || ERRORS.upstream)
        return
      }
      setPhase('done')
    } catch {
      setBusy(false)
      setError(ERRORS.network)
    }
  }

  const hi = firstName ? `Hi ${firstName},` : 'Hi,'

  return (
    <main className="page portrait-page">
      <p className="portrait-kicker">KONNI MMA GYM</p>
      <h1>Portraitfoto</h1>

      {phase === 'loading' ? <p className="admin-muted">Link wird geprüft…</p> : null}

      {phase === 'error' ? <p className="admin-error">{error}</p> : null}

      {phase === 'done' ? (
        <div className="portrait-card">
          <p>
            <strong>Danke{firstName ? `, ${firstName}` : ''}.</strong> Dein Portraitfoto ist gespeichert.
          </p>
          <p>Damit erkennen wir dich im Studio und wissen, dass wirklich du zum Training kommst.</p>
        </div>
      ) : null}

      {phase === 'ready' ? (
        <form className="portrait-card join-form" onSubmit={(event) => void onSubmit(event)}>
          <p>{hi}</p>
          <p>
            <strong>Bitte lade ein Gesichtsbild von dir hoch.</strong> Nicht irgendein Foto – ein Portrait, auf dem
            man dich klar erkennt.
          </p>

          <div className="portrait-why">
            <h2>Warum brauchen wir das?</h2>
            <p>
              Im Studio müssen wir wissen, wer wirklich Mitglied ist. Mit deinem Portraitfoto können wir dich an der
              Tür zuordnen und verhindern, dass sich jemand anderes mit deinem Namen ausgibt und gar kein Mitglied ist.
            </p>
          </div>

          <div className="portrait-rules">
            <h2>So soll das Foto aussehen</h2>
            <ul>
              <li>dein Gesicht klar und frontal erkennbar</li>
              <li>gut beleuchtet, ohne Sonnenbrille und ohne Maske</li>
              <li>aktuell, nur du auf dem Bild</li>
              <li>kein Gruppenfoto, kein Screenshot von weit weg</li>
            </ul>
          </div>

          {hasPhoto ? (
            <p className="field-hint">
              Bei uns liegt schon ein Foto. Wenn du hier ein neues hochlädst, ersetzt es das bisherige.
            </p>
          ) : null}

          <label className="admin-photo admin-photo-create portrait-picker">
            {preview ? <img src={preview} alt="Vorschau Portrait" /> : <span>Foto aufnehmen oder wählen</span>}
            <input
              type="file"
              accept="image/*"
              capture="user"
              disabled={busy}
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
          {preview ? <p className="field-hint">Passt das Gesicht klar? Sonst anderes Foto wählen.</p> : null}

          <p className="field-hint">Der Link gilt {days} Tage und ist nur für dich.</p>

          {error ? <p className="admin-error">{error}</p> : null}

          <button className="btn btn-solid" type="submit" disabled={busy || !preview}>
            {busy ? (
              <>
                <span className="admin-spinner" aria-hidden="true" />
                Speichert…
              </>
            ) : (
              'Portraitfoto speichern'
            )}
          </button>
        </form>
      ) : null}
    </main>
  )
}
