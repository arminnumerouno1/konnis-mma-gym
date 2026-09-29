import { useEffect, useState, type FormEvent } from 'react'
import { StreetInput } from '../components/StreetInput'

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
  source?: string
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
  bankMissing: boolean
  guardianMissing: boolean
  contractMissing: boolean
  stripeLinked: boolean
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
  guardian?: Guardian | null
  bank?: Bank | null
  stripe?: { customerId?: string } | null
  docs?: { contract?: DocMeta; sepa?: DocMeta }
  history?: { at: string; field: string; from: string; to: string }[]
  inviteSlot?: number | null
}

const FIELD_LABEL: Record<string, string> = {
  firstName: 'Vorname',
  lastName: 'Nachname',
  birthDate: 'Geburtstag',
  street: 'Straße',
  zip: 'PLZ',
  city: 'Ort',
  email: 'E-Mail',
  phone: 'Telefon',
  status: 'Status',
  startDate: 'Start',
  iban: 'IBAN',
}

function historyValue(field: string, value: string) {
  if (!value) return '—'
  if (field === 'birthDate' || field === 'startDate') return deDate(value)
  if (field === 'status') return STATUS_LABEL[value as MemberStatus] ?? value
  return value
}

function ProfileEditor({
  member,
  busy,
  onSave,
  onCancel,
}: {
  member: MemberDetail
  busy: boolean
  onSave: (profile: Record<string, string>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    birthDate: member.birthDate ?? '',
    street: member.street ?? '',
    zip: member.zip ?? '',
    city: member.city ?? '',
    email: member.email,
    phone: member.phone,
  })
  const set = (field: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <form
      className="admin-block"
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(form)
      }}
    >
      <h3>Daten ändern</h3>
      <div className="admin-grid">
        <label>
          Vorname
          <input value={form.firstName} onChange={(event) => set('firstName')(event.target.value)} required />
        </label>
        <label>
          Nachname
          <input value={form.lastName} onChange={(event) => set('lastName')(event.target.value)} required />
        </label>
        <label>
          Geburtstag
          <input type="date" value={form.birthDate} onChange={(event) => set('birthDate')(event.target.value)} required />
        </label>
        <label>
          Straße und Hausnummer
          <StreetInput
            value={form.street}
            onChange={set('street')}
            onPick={(pick) => setForm((prev) => ({ ...prev, street: pick.street, zip: pick.zip, city: pick.city }))}
          />
        </label>
        <label>
          PLZ
          <input value={form.zip} inputMode="numeric" onChange={(event) => set('zip')(event.target.value)} />
        </label>
        <label>
          Ort
          <input value={form.city} onChange={(event) => set('city')(event.target.value)} />
        </label>
        <label>
          E-Mail
          <input type="email" value={form.email} onChange={(event) => set('email')(event.target.value)} required />
        </label>
        <label>
          Telefon
          <input value={form.phone} onChange={(event) => set('phone')(event.target.value)} required />
        </label>
      </div>
      <div className="admin-inline">
        <button className="btn btn-solid" type="submit" disabled={busy}>
          Speichern
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

type Guardian = {
  name: string
  relation?: string
  email: string
  phone: string
  idChecked?: boolean
  signedAt?: string | null
  signedVia?: string | null
}

type Bank = {
  holder: string
  iban: string
  bic: string
  mandateRef: string
  mandateSignedAt: string | null
}

type BankForm = { holder: string; iban: string; bic: string; mandateSigned: boolean }
type GuardianForm = {
  name: string
  relation: string
  email: string
  phone: string
  idChecked: boolean
  signed: boolean
}

const EMPTY_BANK: BankForm = { holder: '', iban: '', bic: '', mandateSigned: false }
const EMPTY_GUARDIAN: GuardianForm = {
  name: '',
  relation: 'Mutter',
  email: '',
  phone: '',
  idChecked: false,
  signed: false,
}

const ERROR_TEXT: Record<string, string> = {
  iban: 'IBAN stimmt nicht. Bitte nochmal abtippen.',
  bic: 'BIC stimmt nicht. Bei deutscher IBAN einfach leer lassen.',
  holder: 'Kontoinhaber fehlt.',
  guardian: 'Unter 18: Name und Telefon der Erziehungsberechtigten fehlen.',
  photo: 'Foto ist zu groß oder kein Bild.',
  birth: 'Geburtstag prüfen.',
  name: 'Vor- und Nachname prüfen.',
  email: 'E-Mail prüfen.',
  phone: 'Telefon prüfen.',
  visit: 'Trainingstag fehlt.',
  stripe: 'Stripe-Kunden-ID beginnt mit cus_.',
  address: 'Adresse prüfen. PLZ hat 5 Ziffern.',
}

function errorText(code?: string) {
  return (code && ERROR_TEXT[code]) || 'Bitte Angaben prüfen.'
}

function ageFrom(birthDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) return null
  const now = new Date()
  let age = now.getFullYear() - Number(match[1])
  const month = now.getMonth() + 1
  if (month < Number(match[2]) || (month === Number(match[2]) && now.getDate() < Number(match[3]))) age -= 1
  return age
}

function spacedIban(iban: string) {
  return iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

function bankForm(bank?: Bank | null): BankForm {
  if (!bank) return EMPTY_BANK
  return { holder: bank.holder, iban: spacedIban(bank.iban), bic: bank.bic, mandateSigned: Boolean(bank.mandateSignedAt) }
}

function guardianForm(guardian?: Guardian | null): GuardianForm {
  if (!guardian) return EMPTY_GUARDIAN
  return {
    name: guardian.name,
    relation: guardian.relation ?? '',
    email: guardian.email ?? '',
    phone: guardian.phone ?? '',
    idChecked: Boolean(guardian.idChecked),
    signed: Boolean(guardian.signedAt),
  }
}

function BankFields({ value, onChange, holderHint }: { value: BankForm; onChange: (next: BankForm) => void; holderHint: string }) {
  return (
    <div className="admin-grid">
      <label>
        Kontoinhaber/in
        <input
          value={value.holder}
          placeholder={holderHint}
          onChange={(event) => onChange({ ...value, holder: event.target.value })}
        />
      </label>
      <label>
        IBAN
        <input
          value={value.iban}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="DE00 0000 0000 0000 0000 00"
          onChange={(event) => onChange({ ...value, iban: event.target.value.toUpperCase() })}
        />
      </label>
      <label>
        BIC (optional)
        <input
          value={value.bic}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...value, bic: event.target.value.toUpperCase() })}
        />
      </label>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={value.mandateSigned}
          onChange={(event) => onChange({ ...value, mandateSigned: event.target.checked })}
        />
        SEPA-Mandat auf Papier unterschrieben
      </label>
    </div>
  )
}

function GuardianFields({ value, onChange }: { value: GuardianForm; onChange: (next: GuardianForm) => void }) {
  return (
    <div className="admin-grid">
      <label>
        Name Erziehungsberechtigte/r
        <input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} required />
      </label>
      <label>
        Beziehung
        <select value={value.relation} onChange={(event) => onChange({ ...value, relation: event.target.value })}>
          <option>Mutter</option>
          <option>Vater</option>
          <option>Beide Eltern</option>
          <option>Vormund</option>
          <option>Andere</option>
        </select>
      </label>
      <label>
        Telefon
        <input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} required />
      </label>
      <label>
        E-Mail
        <input type="email" value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} />
      </label>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={value.idChecked}
          onChange={(event) => onChange({ ...value, idChecked: event.target.checked })}
        />
        Ausweis der Person vor Ort gesehen
      </label>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={value.signed}
          onChange={(event) => onChange({ ...value, signed: event.target.checked })}
        />
        Vertrag von Erziehungsberechtigten unterschrieben
      </label>
    </div>
  )
}

type Stats = {
  total: number
  active: number
  openPay: number
  canCancel: number
  daypass: number
  todo: number
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

function scanToJpeg(file: File) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, 2200 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/jpeg', 0.82)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    image.src = url
  })
}

const DOC_MAX = 4_000_000

type DocMeta = { name: string; type: string; size: number; uploadedAt: string }

function DocSlot({
  memberId,
  kind,
  label,
  hint,
  doc,
  busy,
  onChanged,
}: {
  memberId: string
  kind: 'contract' | 'sepa'
  label: string
  hint: string
  doc?: DocMeta
  busy: boolean
  onChanged: (member: MemberDetail) => void
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    setError(null)
    setWorking(true)
    try {
      let body: Blob = file
      let type = file.type
      let name = file.name
      if (type !== 'application/pdf') {
        body = await scanToJpeg(file)
        type = 'image/jpeg'
        name = name.replace(/\.[^.]+$/, '') + '.jpg'
      }
      if (body.size > DOC_MAX) {
        setError('Datei ist zu groß (max. 4 MB). PDF kleiner speichern oder als Foto hochladen.')
        return
      }
      const response = await fetch(`/api/admin?upload=${kind}&id=${encodeURIComponent(memberId)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': type, 'x-file-name': encodeURIComponent(name) },
        body,
      })
      const data = await response.json().catch(() => ({}))
      if (!data.ok) {
        setError(data.error === 'doctype' ? 'Nur PDF oder Foto (JPG, PNG).' : 'Hochladen hat nicht geklappt.')
        return
      }
      onChanged(data.member)
    } catch {
      setError('Datei konnte nicht gelesen werden. Als PDF oder JPG versuchen.')
    } finally {
      setWorking(false)
    }
  }

  async function remove() {
    if (!window.confirm(`${label} wirklich löschen?`)) return
    setWorking(true)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteDoc', id: memberId, kind }),
    })
    setWorking(false)
    if (data.ok) onChanged(data.member)
  }

  const disabled = busy || working

  return (
    <div className={`admin-doc ${doc ? 'is-done' : ''}`}>
      <div className="admin-doc-head">
        <strong>{label}</strong>
        <span className={`admin-pill ${doc ? 'pay-paid' : 'pay-open'}`}>{doc ? 'Liegt vor' : 'Fehlt'}</span>
      </div>
      {doc ? (
        <p className="admin-muted">
          {doc.name} · {deDate(doc.uploadedAt)} · {Math.max(1, Math.round(doc.size / 1024))} KB
        </p>
      ) : (
        <p className="admin-muted">{hint}</p>
      )}
      <div className="admin-inline">
        {doc ? (
          <a
            className="btn btn-ghost"
            href={`/api/admin?id=${encodeURIComponent(memberId)}&doc=${kind}`}
            target="_blank"
            rel="noreferrer"
          >
            Ansehen
          </a>
        ) : null}
        <label className={`btn ${doc ? 'btn-ghost' : 'btn-solid'} admin-upload ${disabled ? 'is-disabled' : ''}`}>
          {working ? 'Lädt…' : doc ? 'Ersetzen' : 'Hochladen / Foto'}
          <input
            type="file"
            accept="application/pdf,image/*"
            disabled={disabled}
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {doc ? (
          <button className="btn btn-ghost" type="button" disabled={disabled} onClick={() => void remove()}>
            Löschen
          </button>
        ) : null}
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
    </div>
  )
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
    if (!data.ok) return String(data.error ?? 'invalid')
    setDetail(data.member)
    await refreshList()
    return null
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
          <article className={stats.todo ? 'is-alert' : ''}>
            <strong>{stats.todo}</strong>
            <span>Unterlagen fehlen</span>
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
                {row.guardianMissing || row.bankMissing || row.contractMissing ? (
                  <span className="admin-flags">
                    {row.contractMissing ? <span className="admin-flag">Vertrag fehlt</span> : null}
                    {row.guardianMissing ? <span className="admin-flag">Eltern-Unterschrift fehlt</span> : null}
                    {row.bankMissing ? <span className="admin-flag">Kontodaten fehlen</span> : null}
                  </span>
                ) : null}
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
            key={`${detail.id}-${detail.updatedAt}`}
            member={detail}
            busy={busy}
            onClose={() => setOpenId(null)}
            onPatch={(payload) => patch(detail.id, payload)}
            onPay={(payment, next) => markPay(detail.id, payment, next)}
            onReplace={(next) => {
              setDetail(next)
              void refreshList()
            }}
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
  onReplace,
}: {
  member: MemberDetail
  busy: boolean
  onClose: () => void
  onPatch: (payload: Record<string, unknown>) => Promise<string | null>
  onPay: (payment: Payment, next: PayStatus) => Promise<void>
  onReplace: (member: MemberDetail) => void
}) {
  const [notes, setNotes] = useState(member.notes ?? '')
  const [bank, setBank] = useState<BankForm>(bankForm(member.bank))
  const [guardian, setGuardian] = useState<GuardianForm>(guardianForm(member.guardian))
  const [stripeId, setStripeId] = useState(member.stripe?.customerId ?? '')
  const [paneError, setPaneError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  async function save(payload: Record<string, unknown>) {
    setPaneError(null)
    const error = await onPatch(payload)
    if (error) setPaneError(errorText(error))
  }

  const holderHint = member.minor && member.guardian?.name ? member.guardian.name : `${member.firstName} ${member.lastName}`

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

      {editing ? (
        <>
          <ProfileEditor
            member={member}
            busy={busy}
            onSave={(profile) => save({ profile })}
            onCancel={() => {
              setEditing(false)
              setPaneError(null)
            }}
          />
          {paneError ? <p className="admin-error">{paneError}</p> : null}
        </>
      ) : (
        <button className="btn btn-ghost admin-print" type="button" onClick={() => setEditing(true)}>
          Daten ändern (Adresse, Mail, Telefon …)
        </button>
      )}

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
        {member.inviteSlot ? (
          <div>
            <dt>First 50</dt>
            <dd>Platz {member.inviteSlot}</dd>
          </div>
        ) : null}
        {member.plan !== 'daypass' ? (
          <div>
            <dt>Konto / SEPA</dt>
            <dd>
              {member.bank ? (
                <>
                  {member.bank.holder} · {spacedIban(member.bank.iban)}
                  <br />
                  Mandat {member.bank.mandateRef} ·{' '}
                  {member.bank.mandateSignedAt ? `unterschrieben ${deDate(member.bank.mandateSignedAt)}` : 'Unterschrift fehlt'}
                </>
              ) : (
                'Noch keine Kontodaten'
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      <a
        className="btn btn-ghost admin-print"
        href={`/api/admin?id=${encodeURIComponent(member.id)}&pdf=contract`}
        target="_blank"
        rel="noreferrer"
      >
        Vertrag{member.plan !== 'daypass' ? ' + SEPA-Mandat' : ''} zum Unterschreiben drucken
      </a>

      <section className="admin-block">
        <h3>Unterlagen</h3>
        <div className="admin-docs">
          <DocSlot
            memberId={member.id}
            kind="contract"
            label="Unterschriebener Vertrag"
            hint={
              member.source === 'admin'
                ? 'PDF-Scan oder Handyfoto vom unterschriebenen Vertrag.'
                : 'Online abgeschlossen. Upload nur, falls es eine Papierversion gibt.'
            }
            doc={member.docs?.contract}
            busy={busy}
            onChanged={onReplace}
          />
          <DocSlot
            memberId={member.id}
            kind="sepa"
            label="SEPA-Lastschriftmandat"
            hint="PDF-Scan oder Handyfoto vom unterschriebenen Mandat."
            doc={member.docs?.sepa}
            busy={busy}
            onChanged={onReplace}
          />
        </div>
      </section>

      {paneError ? <p className="admin-error">{paneError}</p> : null}

      {member.minor ? (
        <section className={`admin-block ${member.guardian?.signedAt ? '' : 'is-alert'}`}>
          <h3>Unter 18 · Erziehungsberechtigte</h3>
          <p className="admin-muted">
            {member.guardian?.signedAt
              ? `Zustimmung liegt vor (${member.guardian.signedVia === 'online' ? 'online bestätigt' : 'Papier'}, ${deDate(member.guardian.signedAt)}).`
              : 'Ohne Unterschrift der Eltern kein Training. Status bleibt „Angemeldet“, bis hier abgehakt ist.'}
          </p>
          <GuardianFields value={guardian} onChange={setGuardian} />
          <button className="btn btn-solid" type="button" disabled={busy} onClick={() => void save({ guardian })}>
            Erziehungsberechtigte speichern
          </button>
        </section>
      ) : null}

      {member.plan !== 'daypass' ? (
        <section className={`admin-block ${member.bank?.iban && member.bank.mandateSignedAt ? '' : 'is-alert'}`}>
          <h3>Kontodaten für Lastschrift</h3>
          <BankFields value={bank} onChange={setBank} holderHint={holderHint} />
          <button className="btn btn-solid" type="button" disabled={busy} onClick={() => void save({ bank })}>
            Kontodaten speichern
          </button>
        </section>
      ) : null}

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
            <small>
              {euro(row.amount)}
              {row.source === 'stripe' ? ' · Stripe' : ''}
            </small>
          </button>
        ))}
      </div>

      {member.plan !== 'daypass' ? (
        <section className="admin-block">
          <h3>Stripe</h3>
          <p className="admin-muted">
            Sobald Stripe läuft, färben sich die Monate von selbst grün oder rot. Die Kunden-ID verknüpft das Mitglied, falls
            die Mail bei Stripe anders ist.
          </p>
          <div className="admin-inline">
            <input value={stripeId} placeholder="cus_…" onChange={(event) => setStripeId(event.target.value.trim())} />
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => void save({ stripeCustomerId: stripeId })}
            >
              Verknüpfen
            </button>
            {member.stripe?.customerId ? (
              <a
                className="btn btn-ghost"
                href={`https://dashboard.stripe.com/customers/${member.stripe.customerId}`}
                target="_blank"
                rel="noreferrer"
              >
                In Stripe öffnen
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <label className="admin-notes">
        Notizen
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
      </label>
      <button className="btn btn-solid" type="button" disabled={busy} onClick={() => void save({ notes })}>
        Notiz speichern
      </button>

      {member.history?.length ? (
        <section className="admin-block">
          <h3>Änderungen</h3>
          <ul className="admin-history">
            {[...member.history].reverse().slice(0, 30).map((row, index) => (
              <li key={`${row.at}-${row.field}-${index}`}>
                <small>{new Date(row.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small>
                <span>
                  <strong>{FIELD_LABEL[row.field] ?? row.field}:</strong> {historyValue(row.field, row.from)} →{' '}
                  {historyValue(row.field, row.to)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [bank, setBank] = useState<BankForm>(EMPTY_BANK)
  const [guardian, setGuardian] = useState<GuardianForm>(EMPTY_GUARDIAN)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const age = ageFrom(birthDate)
  const minor = age != null && age < 18
  const holderHint = minor && guardian.name ? guardian.name : `${firstName} ${lastName}`.trim() || 'Name wie auf der Karte'

  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      setPhotoData(await compressPhoto(file))
    } catch {
      setError(errorText('photo'))
    }
  }

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
        photoData,
        bank: plan === 'daypass' ? undefined : bank,
        guardian: minor ? guardian : undefined,
      }),
    })
    setBusy(false)
    if (!data.ok) {
      setError(errorText(data.error))
      return
    }
    await onDone(data.member.id)
  }

  return (
    <form className="admin-card admin-create" onSubmit={(event) => void onSubmit(event)}>
      <h2>Neues Mitglied</h2>
      <label className="admin-photo admin-photo-create">
        {photoData ? <img src={photoData} alt="" /> : <span>Foto aufnehmen</span>}
        <input type="file" accept="image/*" capture="user" onChange={(event) => void onPhoto(event.target.files?.[0])} />
      </label>
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
          <StreetInput
            value={street}
            onChange={setStreet}
            onPick={(pick) => {
              setStreet(pick.street)
              setZip(pick.zip)
              setCity(pick.city)
            }}
          />
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

      {minor ? (
        <section className="admin-block is-alert">
          <h3>Unter 18 ({age} Jahre)</h3>
          <p className="admin-muted">
            Eine erziehungsberechtigte Person muss zustimmen. Am besten ist sie direkt dabei, zeigt den Ausweis und
            unterschreibt den gedruckten Vertrag. Ist niemand da: trotzdem anlegen, Vertrag mitgeben. Das Mitglied bleibt
            „Angemeldet“ und trainiert erst, wenn die Unterschrift da ist und hier abgehakt wurde.
          </p>
          <GuardianFields value={guardian} onChange={setGuardian} />
        </section>
      ) : null}

      {plan !== 'daypass' ? (
        <section className="admin-block">
          <h3>Kontodaten für Lastschrift</h3>
          <p className="admin-muted">
            {minor ? 'Bei unter 18 zahlt meist ein Elternteil: dann dessen Namen als Kontoinhaber. ' : ''}
            Kann auch später nachgetragen werden. Nach dem Anlegen den Vertrag mit SEPA-Mandat drucken und unterschreiben
            lassen.
          </p>
          <BankFields value={bank} onChange={setBank} holderHint={holderHint} />
        </section>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        Anlegen
      </button>
    </form>
  )
}
