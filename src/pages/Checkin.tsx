import { useEffect, useState, type FormEvent } from 'react'

type Slot = {
  id: string
  dayId?: string
  dayLabel?: string
  time: string
  title: string
  label: string
}

type Phase = 'loading' | 'ready' | 'done' | 'already' | 'error'

const ERRORS: Record<string, string> = {
  code: 'Code unbekannt. Bitte noch einmal prüfen.',
  slot: 'Gerade kein Kurs im Zeitfenster. Bitte den richtigen Slot wählen.',
  rate: 'Zu viele Versuche. Kurz warten und noch einmal.',
  network: 'Netzwerkfehler. Bitte noch einmal versuchen.',
  upstream: 'Check-in hat nicht geklappt. Bitte gleich noch einmal.',
}

const CHECKIN_GIFS = [
  'https://media1.tenor.com/m/nodNPlyjhbAAAAAd/khamzat-chimaev-dricus-du-plessis.gif',
  'https://media1.tenor.com/m/wVKEWs9Y1ZAAAAAd/ilia-topuria-shadowbox.gif',
  'https://media1.tenor.com/m/tTxzg59MqU4AAAAd/conor-mcgregor-ready-to-fight.gif',
  'https://media1.tenor.com/m/ai_gPtdLXw0AAAAC/alex-pereira-khaby-lame.gif',
  'https://media1.tenor.com/m/DEbkQHK7M_MAAAAC/baddy-paddy.gif',
]

function pickCheckinGif() {
  return CHECKIN_GIFS[Math.floor(Math.random() * CHECKIN_GIFS.length)]
}

export function Checkin() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [slot, setSlot] = useState<Slot | null>(null)
  const [todaySlots, setTodaySlots] = useState<Slot[]>([])
  const [slotId, setSlotId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [gif, setGif] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/checkin', { headers: { accept: 'application/json' } })
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || !data.ok) {
          setPhase('error')
          setError(ERRORS.upstream)
          return
        }
        const nextSlot = (data.slot as Slot | null) || null
        const slots = Array.isArray(data.todaySlots) ? (data.todaySlots as Slot[]) : []
        setSlot(nextSlot)
        setTodaySlots(slots)
        setSlotId(nextSlot?.id || slots[0]?.id || '')
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
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          slotId: slot?.id || slotId || undefined,
          company: '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) {
        setError(ERRORS[String(data.error)] || ERRORS.upstream)
        return
      }
      setName(String(data.name || ''))
      setSlot((data.slot as Slot) || slot)
      setGif(pickCheckinGif())
      setPhase(data.already ? 'already' : 'done')
    } catch {
      setError(ERRORS.network)
    } finally {
      setBusy(false)
    }
  }

  const activeLabel = slot?.label || todaySlots.find((row) => row.id === slotId)?.label || ''
  const success = phase === 'done' || phase === 'already'

  return (
    <main className="checkin-page">
      <p className="checkin-kicker">KONNI MMA GYM</p>
      <h1>Check-in</h1>

      {phase === 'loading' ? <p className="lead">Kurs wird erkannt…</p> : null}

      {phase === 'ready' ? (
        <>
          {slot ? (
            <p className="lead">
              Jetzt: <strong>{slot.label}</strong>
            </p>
          ) : (
            <>
              <p className="lead">Gerade kein Kurs im Zeitfenster — bitte Slot wählen.</p>
              {todaySlots.length ? (
                <label className="checkin-slot">
                  Heutiger Kurs
                  <select value={slotId} onChange={(event) => setSlotId(event.target.value)}>
                    {todaySlots.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="checkin-muted">Heute steht kein Kurs im Plan.</p>
              )}
            </>
          )}

          <form className="checkin-form" onSubmit={(event) => void onSubmit(event)}>
            <label>
              Dein Check-in-Code
              <input
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="z. B. K7M2QX"
                required
              />
            </label>
            <input className="checkin-hp" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {error ? <p className="checkin-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={busy || (!slot && !slotId)}>
              {busy ? 'Einen Moment…' : 'Einchecken'}
            </button>
          </form>
          <p className="checkin-legal">
            Der Check-in dient dem Trainingsbetrieb und der Zuordnung im Studio. Details in der{' '}
            <a href="/datenschutz">Datenschutzerklärung</a>.
          </p>
        </>
      ) : null}

      {success ? (
        <div className="checkin-success">
          <p className="lead checkin-ok">
            {phase === 'already' ? 'Schon da' : 'Eingecheckt'}
            {name ? ` — ${name}` : ''}.
            {activeLabel ? ` ${activeLabel}.` : ''} Bis gleich.
          </p>
          {gif ? (
            <figure className="checkin-gif">
              <img src={gif} alt="" />
            </figure>
          ) : null}
        </div>
      ) : null}

      {phase === 'error' && !busy ? <p className="checkin-error">{error || ERRORS.upstream}</p> : null}
    </main>
  )
}
