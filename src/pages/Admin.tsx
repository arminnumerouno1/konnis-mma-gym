import { useEffect, useState, type FormEvent } from 'react'

type PayStatus = 'paid' | 'open' | 'failed' | 'waived' | 'upcoming' | 'na'
type MemberStatus = 'received' | 'active' | 'paused' | 'cancelled' | 'expired'
type PlanId = 'standard' | 'flex' | 'daypass' | 'first50'

type CancelInfo = {
  kind: string
  canCancelNow: boolean
  deadline: string | null
  termEnd: string | null
  nextEnd: string | null
  hint: string
}

type Payment = {
  kind: 'month' | 'day' | string
  period: string
  amount: number
  status: PayStatus
  paidAt: string | null
  note?: string
}

type MemberList = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  plan: PlanId
  planName: string
  price: number
  status: MemberStatus
  startDate: string
  visitDay: string | null
  minor: boolean
  hasPhoto: boolean
  payThisMonth: PayStatus
  cancel: CancelInfo
  createdAt: string
  updatedAt: string
}

type MemberDetail = MemberList & {
  birthDate?: string
  age?: number
  street?: string
  zip?: string
  city?: string
  notes?: string
  photoData?: string | null
  payments?: Payment[]
  termMonths?: number | null
  fee?: number
  source?: string
  consents?: { photos?: boolean }
}

type Stats = {
  total: number
  active: number
  openPay: number
  canCancel: number
  daypass: number
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  received: 'Angemeldet',
  active: 'Aktiv',
  paused: 'Pausiert',
  cancelled: 'Gekündigt',
  expired: 'Beendet',
}

const PAY_LABEL: Record<PayStatus, string> = {
  paid: 'Gezahlt',
  open: 'Offen',
  failed: 'Nicht erhalten',
  waived: 'Erlassen',
  upcoming: 'Noch nicht fällig',
  na: '—',
}

function deDate(iso?: string | null) {
  if (!iso) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  return `${match[3]}.${match[2]}.${match[1]}`
}

function euro(value?: number) {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(2).replace('.', ',')}€`
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const data = await response.json().catch(() => ({}))
  return { status: response.status, data }
}

function compressPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, 420 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    image.src = url
  })
}

function PayPill({ status }: { status: PayStatus }) {
  return <span className={`admin-pill pay-${status}`}>{PAY_LABEL[status] ?? status}</span>
}

export function Admin() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [store, setStore] = useState('')
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [pay, setPay] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [members, setMembers] = useState<MemberList[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    document.title = 'Verwaltung · KONNI MMA GYM'
    return () => robots.remove()
  }, [])

  async function refreshList() {
    const query = new URLSearchParams()
    if (q.trim()) query.set('q', q.trim())
    if (plan) query.set('plan', plan)
    if (status) query.set('status', status)
    if (pay) query.set('pay', pay)
    const suffix = query.toString() ? `?${query}` : ''
    const { status: code, data } = await api(`/api/admin${suffix}`)
    if (code === 401) {
      setAuthed(false)
      return
    }
    if (data.ok) {
      setAuthed(true)
      setMembers(data.members ?? [])
      setStats(data.stats ?? null)
      setStore(data.store ?? '')
    }
  }

  async function refreshDetail(id: string) {
    const { status: code, data } = await api(`/api/admin?id=${encodeURIComponent(id)}`)
    if (code === 401) {
      setAuthed(false)
      return
    }
    if (data.ok) setDetail(data.member)
  }

  useEffect(() => {
    void (async () => {
      const { data } = await api('/api/admin?ping=1')
      setAuthed(Boolean(data.auth))
      setStore(String(data.store ?? ''))
      setReady(true)
      if (data.auth) await refreshList()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!authed) return
    const timer = window.setTimeout(() => {
      void refreshList()
    }, 180)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, plan, status, pay, authed])

  useEffect(() => {
    if (openId) void refreshDetail(openId)
    else setDetail(null)
  }, [openId])

  async function onLogin(event: FormEvent) {
    event.preventDefault()
    setLoginError(null)
    setBusy(true)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', password }),
    })
    setBusy(false)
    if (!data.ok) {
      setLoginError('Passwort stimmt nicht.')
      return
    }
    setPassword('')
    setAuthed(true)
    setStore(String(data.store ?? ''))
    await refreshList()
  }

  async function onLogout() {
    await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'logout' }) })
    setAuthed(false)
    setMembers([])
    setDetail(null)
    setOpenId(null)
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusy(true)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', id, ...payload }),
    })
    setBusy(false)
    if (data.ok) {
      setDetail(data.member)
      await refreshList()
    }
  }

  async function markPay(id: string, payment: Payment, next: PayStatus) {
    setBusy(true)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({
        action: 'pay',
        id,
        period: payment.period,
        kind: payment.kind,
        status: next,
      }),
    })
    setBusy(false)
    if (data.ok) {
      setDetail(data.member)
      await refreshList()
    }
  }

  if (!ready) {
    return (
      <main className="admin">
        <p className="admin-muted">Laden…</p>
      </main>
    )
  }

  if (!authed) {
    return (
      <main className="admin admin-login">
        <p className="admin-kicker">KONNI MMA GYM</p>
        <h1>Verwaltung</h1>
        <p>Mitglieder, Tarife, Laufzeiten, Kündigungen, Zahlungen. Nicht öffentlich verlinkt.</p>
        <form className="admin-card" onSubmit={(event) => void onLogin(event)}>
          <label>
            Passwort
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {loginError ? <p className="admin-error">{loginError}</p> : null}
          <button className="btn btn-solid" type="submit" disabled={busy}>
            Rein
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="admin">
      <header className="admin-top">
        <div>
          <p className="admin-kicker">KONNI MMA GYM</p>
          <h1>Mitglieder</h1>
        </div>
        <div className="admin-top-actions">
          <button className="btn btn-ghost" type="button" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Abbrechen' : 'Neu anlegen'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => void onLogout()}>
            Raus
          </button>
        </div>
      </header>

      {store === 'ephemeral' ? (
        <p className="admin-warn">
          Speicher auf dem Live-Server ist noch nicht dauerhaft. Lokal bleibt alles in der Datei. Für Vercel später
          Blob-Token setzen, sonst gehen Daten nach dem Neustart verloren.
        </p>
      ) : null}

      {stats ? (
        <section className="admin-stats">
          <article>
            <strong>{stats.total}</strong>
            <span>Gesamt</span>
          </article>
          <article>
            <strong>{stats.active}</strong>
            <span>Aktiv / angemeldet</span>
          </article>
          <article>
            <strong>{stats.openPay}</strong>
            <span>Zahlung offen / nicht da</span>
          </article>
          <article>
            <strong>{stats.canCancel}</strong>
            <span>Jetzt kündbar</span>
          </article>
          <article>
            <strong>{stats.daypass}</strong>
            <span>Tageskarten</span>
          </article>
        </section>
      ) : null}

      {creating ? <CreateMember onDone={async (id) => {
        setCreating(false)
        setOpenId(id)
        await refreshList()
      }} /> : null}

      <section className="admin-filters">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name, Mail, Telefon" />
        <select value={plan} onChange={(event) => setPlan(event.target.value)}>
          <option value="">Alle Tarife</option>
          <option value="standard">Standard</option>
          <option value="flex">Flex</option>
          <option value="first50">First 50</option>
          <option value="daypass">Day Pass</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Jeder Status</option>
          <option value="active">Aktiv</option>
          <option value="received">Angemeldet</option>
          <option value="paused">Pausiert</option>
          <option value="cancelled">Gekündigt</option>
        </select>
        <select value={pay} onChange={(event) => setPay(event.target.value)}>
          <option value="">Zahlung alle</option>
          <option value="paid">Beitrag gezahlt</option>
          <option value="open">Offen</option>
          <option value="failed">Nicht erhalten</option>
          <option value="upcoming">Noch nicht fällig</option>
        </select>
      </section>

      <div className="admin-split">
        <section className="admin-list">
          {members.length === 0 ? <p className="admin-muted">Noch keine Mitglieder.</p> : null}
          {members.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`admin-row ${openId === row.id ? 'is-open' : ''}`}
              onClick={() => setOpenId(row.id)}
            >
              <span className={`admin-face ${row.hasPhoto ? 'has-photo' : ''}`}>{row.firstName[0]}{row.lastName[0]}</span>
              <span className="admin-row-copy">
                <strong>
                  {row.firstName} {row.lastName}
                  {row.minor ? <em> U18</em> : null}
                </strong>
                <small>
                  {STATUS_LABEL[row.status]} · {row.planName} · {euro(row.price)} · Start {deDate(row.startDate)}
                </small>
              </span>
              <span className="admin-row-meta">
                <PayPill status={row.payThisMonth} />
                <small>{row.cancel?.canCancelNow ? `Kündbar zum ${deDate(row.cancel.nextEnd)}` : `Laufzeit bis ${deDate(row.cancel?.termEnd)}`}</small>
              </span>
            </button>
          ))}
        </section>

        {detail ? (
          <MemberPane
            member={detail}
            busy={busy}
            onClose={() => setOpenId(null)}
            onPatch={(payload) => patch(detail.id, payload)}
            onPay={(payment, next) => markPay(detail.id, payment, next)}
          />
        ) : (
          <p className="admin-muted admin-empty">Mitglied antippen.</p>
        )}
      </div>
    </main>
  )
}

function MemberPane({
  member,
  busy,
  onClose,
  onPatch,
  onPay,
}: {
  member: MemberDetail
  busy: boolean
  onClose: () => void
  onPatch: (payload: Record<string, unknown>) => Promise<void>
  onPay: (payment: Payment, next: PayStatus) => Promise<void>
}) {
  const [notes, setNotes] = useState(member.notes ?? '')
  useEffect(() => setNotes(member.notes ?? ''), [member.id, member.notes])

  async function onPhoto(file: File | undefined) {
    if (!file) return
    const photoData = await compressPhoto(file)
    await onPatch({ photoData })
  }

  return (
    <section className="admin-pane">
      <header className="admin-pane-top">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Schließen
        </button>
        <select
          value={member.status}
          disabled={busy}
          onChange={(event) => void onPatch({ status: event.target.value })}
        >
          <option value="active">Aktiv</option>
          <option value="received">Angemeldet</option>
          <option value="paused">Pausiert</option>
          <option value="cancelled">Gekündigt</option>
          <option value="expired">Beendet</option>
        </select>
      </header>

      <div className="admin-id">
        <label className="admin-photo">
          {member.photoData ? <img src={member.photoData} alt="" /> : <span>Foto</span>}
          <input
            type="file"
            accept="image/*"
            capture="user"
            onChange={(event) => void onPhoto(event.target.files?.[0])}
          />
        </label>
        <div>
          <h2>
            {member.firstName} {member.lastName}
          </h2>
          <p>
            {member.planName} · {euro(member.price)} {member.termMonths ? `· ${member.termMonths} Monate` : ''}
          </p>
          <PayPill status={member.payThisMonth} />
        </div>
      </div>

      <dl className="admin-dl">
        <div>
          <dt>Mail / Telefon</dt>
          <dd>
            {member.email}
            <br />
            {member.phone}
          </dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>
            {[member.street, [member.zip, member.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}
          </dd>
        </div>
        <div>
          <dt>Geboren</dt>
          <dd>
            {deDate(member.birthDate)} {member.age != null ? `· ${member.age}` : ''}
            {member.minor ? ' · unter 18' : ''}
          </dd>
        </div>
        <div>
          <dt>Start / Laufzeitende</dt>
          <dd>
            {deDate(member.startDate)}
            {member.visitDay ? ` · Tag ${deDate(member.visitDay)}` : ''}
            <br />
            {deDate(member.cancel?.termEnd)}
          </dd>
        </div>
        <div>
          <dt>Kündigung</dt>
          <dd>
            {member.cancel?.canCancelNow ? 'Jetzt möglich' : 'Gerade nicht zum Wunschtermin'}
            <br />
            Nächstes Ende: {deDate(member.cancel?.nextEnd)}
            {member.cancel?.deadline ? ` · Frist ${deDate(member.cancel.deadline)}` : ''}
            <br />
            <small>{member.cancel?.hint}</small>
          </dd>
        </div>
      </dl>

      <h3>Zahlungen</h3>
      <p className="admin-muted">Grün = abgebucht / da. Rot = offen oder nicht erhalten. Klick setzt den Status.</p>
      <div className="admin-pays">
        {(member.payments ?? []).map((row) => (
          <button
            key={`${row.kind}-${row.period}`}
            type="button"
            className={`admin-pay pay-${row.status}`}
            disabled={busy}
            onClick={() => {
              const order: PayStatus[] = ['open', 'paid', 'failed', 'waived']
              const current = order.includes(row.status) ? row.status : 'open'
              const next = order[(order.indexOf(current) + 1) % order.length]
              void onPay(row, next)
            }}
          >
            <strong>{row.kind === 'day' ? deDate(row.period) : row.period}</strong>
            <span>{PAY_LABEL[row.status]}</span>
            <small>{euro(row.amount)}</small>
          </button>
        ))}
      </div>

      <label className="admin-notes">
        Notizen
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
      </label>
      <button className="btn btn-solid" type="button" disabled={busy} onClick={() => void onPatch({ notes })}>
        Notiz speichern
      </button>
    </section>
  )
}

function CreateMember({ onDone }: { onDone: (id: string) => Promise<void> }) {
  const [plan, setPlan] = useState<PlanId>('standard')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [zip, setZip] = useState('04129')
  const [city, setCity] = useState('Leipzig')
  const [visitDay, setVisitDay] = useState('')
  const [startDate, setStartDate] = useState('2026-11-02')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        plan,
        firstName,
        lastName,
        birthDate,
        email,
        phone,
        street,
        zip,
        city,
        visitDay,
        startDate,
      }),
    })
    setBusy(false)
    if (!data.ok) {
      setError('Bitte Angaben prüfen.')
      return
    }
    await onDone(data.member.id)
  }

  return (
    <form className="admin-card admin-create" onSubmit={(event) => void onSubmit(event)}>
      <h2>Neues Mitglied</h2>
      <div className="admin-grid">
        <label>
          Tarif
          <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
            <option value="standard">Standard 24 Monate</option>
            <option value="flex">Flex 12 Monate</option>
            <option value="first50">First 50</option>
            <option value="daypass">Day Pass</option>
          </select>
        </label>
        <label>
          Start
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          Vorname
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
        </label>
        <label>
          Nachname
          <input value={lastName} onChange={(event) => setLastName(event.target.value)} required />
        </label>
        <label>
          Geburtstag
          <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
        </label>
        <label>
          E-Mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Telefon
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label>
          Straße
          <input value={street} onChange={(event) => setStreet(event.target.value)} />
        </label>
        <label>
          PLZ
          <input value={zip} onChange={(event) => setZip(event.target.value)} />
        </label>
        <label>
          Ort
          <input value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        {plan === 'daypass' ? (
          <label>
            Trainingstag
            <input type="date" value={visitDay} onChange={(event) => setVisitDay(event.target.value)} required />
          </label>
        ) : null}
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        Anlegen
      </button>
    </form>
  )
}
