import { useEffect, useState, type FormEvent } from 'react'
import { StreetInput } from '../components/StreetInput'
import { snapshotMonth } from '../admin/snapshot.ts'
import { compressPhoto } from '../lib/photo'

type PayStatus = 'paid' | 'open' | 'failed' | 'waived' | 'upcoming' | 'na'
type MemberStatus = 'received' | 'active' | 'paused' | 'cancelled' | 'withdrawn' | 'expired'
type PlanId = 'slowstart' | 'standard' | 'flex' | 'plus' | 'daypass' | 'first50'

type CancelInfo = {
  kind: string
  canCancelNow: boolean
  deadline: string | null
  termEnd: string | null
  nextEnd: string | null
  hint: string
}

type Payment = {
  kind: 'month' | 'day' | 'fee' | string
  period: string
  amount: number
  status: PayStatus
  paidAt: string | null
  note?: string
  source?: string
  receiptNumber?: string
  receiptAt?: string
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
  payMethod?: 'transfer' | 'card' | null
  isNew: boolean
  stripeLinked: boolean
  payThisMonth: PayStatus
  openCount?: number
  openAmount?: number
  lastReminderAt?: string | null
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
  place?: string
  signature?: string
  gymSignature?: string
  secondGuardianSignature?: string
  contractMail?: string
  contractMailAt?: string | null
  photoData?: string | null
  payments?: Payment[]
  termMonths?: number | null
  fee?: number
  source?: string
  consents?: { photos?: boolean }
  guardian?: Guardian | null
  bank?: Bank | null
  stripe?: {
    customerId?: string
    subscriptionId?: string
    checkoutSessionId?: string
    billingStart?: string | null
    chargeNow?: boolean
    delay?: string
    payMethod?: string
    transfer?: { iban?: string; bic?: string; holder?: string; bank?: string; amount?: number }
  } | null
  payMethod?: string
  transfer?: { iban?: string; bic?: string; holder?: string; bank?: string }
  docs?: { contract?: DocMeta; sepa?: DocMeta; payment?: DocMeta }
  history?: { at: string; field: string; from: string; to: string }[]
  reminders?: ReminderEntry[]
  inviteSlot?: number | null
  reviewedAt?: string | null
  priceNoteAt?: string | null
  payLinkAt?: string | null
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
  signature?: string
  idChecked?: boolean
  signedAt?: string | null
  signedVia?: string | null
}

type Bank = {
  holder: string
  iban: string
  bic: string
  mandateRef: string
  mandateSignature?: string
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
  photo: 'Portraitfoto fehlt oder ist ungültig. Gesicht muss klar zu erkennen sein.',
  birth: 'Geburtstag prüfen.',
  name: 'Vor- und Nachname prüfen.',
  email: 'E-Mail prüfen.',
  duplicate: 'Mit dieser E-Mail gibt es schon eine Anmeldung.',
  phone: 'Telefon prüfen.',
  visit: 'Trainingstag fehlt.',
  stripe: 'Stripe-Kunden-ID beginnt mit cus_.',
  stripe_off: 'Stripe ist noch nicht verbunden. Der Zahlungslink geht, sobald der Schlüssel hinterlegt ist.',
  stripe_exists: 'Für dieses Mitglied läuft schon ein Stripe-Abo.',
  stripe_early: 'Der Day Pass wird erst ab dem 1. November abgebucht.',
  stripe_fail: 'Stripe hat den Link nicht angenommen. Bitte später noch einmal.',
  address: 'Adresse prüfen. PLZ hat 5 Ziffern.',
  signature: 'Unterschrift fehlt. Mitglied und Studio müssen unterschreiben, bei unter 18 auch die Eltern.',
  place: 'Ort der Unterschrift prüfen.',
  mail: 'Die Mail ist nicht rausgegangen. Bitte noch einmal versuchen.',
  mail_off: 'Der Mailversand ist nicht eingerichtet.',
  invite_open: 'An diese E-Mail ist schon ein First-50-Link raus, der noch gilt.',
  full: 'Gerade ist kein weiterer First-50-Platz frei.',
  no_open: 'Keine offenen Beiträge bei diesem Mitglied.',
  cooldown: 'In den letzten fünf Tagen ging schon eine Mahnung raus. Mit Bestätigung trotzdem senden.',
  period: 'Bitte einen Monat wählen (JJJJ-MM).',
  pay: 'Passt nicht zur Zahlungsart dieses Mitglieds.',
  missing: 'Mitglied nicht gefunden.',
  columns: 'CSV braucht eine Betrag-Spalte (Sparkasse-Export).',
  empty: 'Keine Treffer oder leere Datei.',
  receipt: 'Quittung nur für bezahlte Beiträge. Bitte erst als gezahlt markieren.',
  subject: 'Betreff fehlt oder ist zu lang (max. 140 Zeichen).',
  body: 'Text fehlt oder ist zu lang (max. 8000 Zeichen).',
  audience: 'Empfängerkreis prüfen.',
  confirm: 'Zur Bestätigung bitte genau „an-alle-mitglieder“ tippen.',
  no_recipients: 'Keine Empfänger mit diesem Filter.',
  has_photo: 'Dieses Mitglied hat schon ein Portraitfoto.',
  closed: 'Für dieses Mitglied ist kein Foto-Link nötig.',
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

type DeskSignatures = {
  place: string
  signature: string
  gymSignature: string
  guardianSignature: string
  secondGuardianSignature: string
  mandateSignature: string
}

function SignatureFields({
  value,
  onChange,
  minor,
  mandate,
  required,
}: {
  value: DeskSignatures
  onChange: (next: DeskSignatures) => void
  minor: boolean
  mandate: boolean
  required?: boolean
}) {
  const set = (field: keyof DeskSignatures) => (next: string) => onChange({ ...value, [field]: next })
  return (
    <div className="admin-grid">
      <label>
        Ort
        <input value={value.place} onChange={(event) => set('place')(event.target.value)} required={required} />
      </label>
      <label>
        Unterschrift Mitglied
        <input value={value.signature} onChange={(event) => set('signature')(event.target.value)} required={required} />
      </label>
      {minor ? (
        <label>
          Unterschrift gesetzliche Vertretung
          <input
            value={value.guardianSignature}
            onChange={(event) => set('guardianSignature')(event.target.value)}
            required={required}
          />
        </label>
      ) : null}
      {minor ? (
        <label>
          Unterschrift zweite sorgeberechtigte Person
          <input
            value={value.secondGuardianSignature}
            onChange={(event) => set('secondGuardianSignature')(event.target.value)}
            placeholder="Nur bei gemeinsamem Sorgerecht"
          />
        </label>
      ) : null}
      <label>
        Unterschrift für KONNI MMA GYM
        <input value={value.gymSignature} onChange={(event) => set('gymSignature')(event.target.value)} required={required} />
      </label>
      {mandate ? (
        <label>
          Unterschrift Kontoinhaber/in
          <input
            value={value.mandateSignature}
            onChange={(event) => set('mandateSignature')(event.target.value)}
            required={required}
          />
        </label>
      ) : null}
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
  openDebt?: number
  openDebtAmount?: number
  canCancel: number
  daypass: number
  todo: number
  fresh: number
  noPhoto?: number
}

type ReminderEntry = {
  at: string
  stage: string
  periods: string[]
  amount: number
  email?: string
  mail?: string
}

type DuesRow = {
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
  payMethod: 'transfer' | 'card' | null
  openCount: number
  openAmount: number
  openPeriods: string[]
  openRows: { kind: string; period: string; amount: number; status: PayStatus }[]
  lastReminderAt: string | null
  reminderCount: number
  reminders?: ReminderEntry[]
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  received: 'Angemeldet',
  active: 'Aktiv',
  paused: 'Pausiert',
  cancelled: 'Gekündigt',
  withdrawn: 'Widerruf',
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
  kind: 'contract' | 'sepa' | 'payment'
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

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function monthLabel(ym: string) {
  const [year, month] = ym.split('-')
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`
}

type ReportMonth = {
  ym: string
  signups: number
  online: number
  desk: number
  minors: number
  byPlan: { slowstart: number; standard: number; flex: number; plus: number; first50: number }
  daypasses: number
  dayRevenue: number
  cancellations: number
  endings: number
  stock?: number
  paused?: number
  expected?: number
  due: number
  paid: number
  open: number
  openCount: number
}

type Report = { year: number; today: string; months: ReportMonth[]; totals: ReportMonth; years: number[] }

const REMINDER_STAGE_LABEL: Record<string, string> = {
  reminder: 'Erinnerung',
  mahnung1: '1. Mahnung',
  mahnung2: '2. Mahnung',
}

function periodLabel(period: string) {
  if (period === 'fee') return 'Aufnahmegebühr'
  if (/^\d{4}-\d{2}$/.test(period)) return monthLabel(period)
  return deDate(period)
}

function DuesPanel({
  onOpenMember,
  initialPeriod = '',
}: {
  onOpenMember: (id: string) => void
  initialPeriod?: string
}) {
  const [q, setQ] = useState('')
  const [payMethod, setPayMethod] = useState('')
  const [period, setPeriod] = useState(initialPeriod)
  const [dues, setDues] = useState<DuesRow[]>([])
  const [totals, setTotals] = useState({ people: 0, amount: 0, count: 0 })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stageById, setStageById] = useState<Record<string, string>>({})
  const [bankMatches, setBankMatches] = useState<
    {
      txnIndex: number
      date: string
      amount: number
      name: string
      purpose: string
      iban?: string
      memberId: string
      memberName: string
      email: string
      period: string
      kind: string
      score: number
      selected?: boolean
    }[]
  >([])
  const [bankUnmatched, setBankUnmatched] = useState<{ txnIndex: number; amount: number; name: string; purpose: string }[]>(
    [],
  )
  const [bankBusy, setBankBusy] = useState(false)

  useEffect(() => {
    setPeriod(initialPeriod)
  }, [initialPeriod])

  async function refresh() {
    const query = new URLSearchParams({ dues: '1' })
    if (q.trim()) query.set('q', q.trim())
    if (payMethod) query.set('payMethod', payMethod)
    if (period) query.set('period', period)
    const { status, data } = await api(`/api/admin?${query}`)
    if (status === 401) return
    if (data.ok) {
      setDues(data.dues ?? [])
      setTotals(data.totals ?? { people: 0, amount: 0, count: 0 })
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 180)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, payMethod, period])

  async function sendReminder(id: string, force = false) {
    setBusyId(id)
    setError(null)
    setNote(null)
    const stage = stageById[id] || 'reminder'
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendReminder', id, stage, force }),
    })
    setBusyId(null)
    if (!data.ok) {
      if (data.error === 'cooldown') {
        if (window.confirm('In den letzten fünf Tagen ging schon eine Mahnung raus. Trotzdem noch einmal senden?')) {
          await sendReminder(id, true)
        }
        return
      }
      setError(errorText(String(data.error ?? '')))
      return
    }
    setNote(`${REMINDER_STAGE_LABEL[stage] || 'Mahnung'} raus.`)
    await refresh()
  }

  async function markPaid(id: string) {
    if (!window.confirm('Alle offenen Beiträge dieses Mitglieds als gezahlt markieren?')) return
    setBusyId(id)
    setError(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'payOpen', id }),
    })
    setBusyId(null)
    if (!data.ok) {
      setError(errorText(String(data.error ?? '')))
      return
    }
    setNote(`${data.marked ?? 0} Beitrag(e) auf gezahlt gesetzt.`)
    await refresh()
  }

  async function bulkPay() {
    if (!period) {
      setError(errorText('period'))
      return
    }
    const methodLabel =
      payMethod === 'transfer' ? 'Überweiser' : payMethod === 'card' ? 'Kartenmitglieder' : 'alle mit offenem Beitrag'
    if (
      !window.confirm(
        `${periodLabel(period)} für ${methodLabel} als gezahlt markieren? Betroffen laut Liste: ${totals.people} · ${euro(totals.amount)}.`,
      )
    ) {
      return
    }
    setBulkBusy(true)
    setError(null)
    setNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({
        action: 'payBulk',
        period,
        payMethod: payMethod || undefined,
      }),
    })
    setBulkBusy(false)
    if (!data.ok) {
      setError(errorText(String(data.error ?? '')))
      return
    }
    setNote(`Sammelausgleich ${periodLabel(period)}: ${data.people ?? 0} Personen, ${data.marked ?? 0} Beiträge.`)
    await refresh()
  }

  async function onBankFile(file: File | undefined) {
    if (!file) return
    setBankBusy(true)
    setError(null)
    setNote(null)
    const csv = await file.text()
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'bankImportPreview', csv }),
    })
    setBankBusy(false)
    if (!data.ok) {
      setError(errorText(String(data.error ?? '')))
      setBankMatches([])
      setBankUnmatched([])
      return
    }
    setBankMatches((data.matches ?? []).map((row: { selected?: boolean }) => ({ ...row, selected: row.selected !== false })))
    setBankUnmatched(data.unmatched ?? [])
    setNote(`${data.parsed ?? 0} Eingänge gelesen · ${data.matches?.length ?? 0} Treffer · ${data.unmatched?.length ?? 0} offen`)
  }

  async function applyBankMatches() {
    const picked = bankMatches.filter((row) => row.selected)
    if (!picked.length) {
      setError('Bitte mindestens einen Treffer anwählen.')
      return
    }
    if (!window.confirm(`${picked.length} ausgewählte Treffer als gezahlt verbuchen?`)) return
    setBankBusy(true)
    setError(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'bankImportApply', matches: picked }),
    })
    setBankBusy(false)
    if (!data.ok) {
      setError(errorText(String(data.error ?? '')))
      return
    }
    setNote(`${data.applied ?? 0} Buchungen übernommen.`)
    setBankMatches([])
    setBankUnmatched([])
    await refresh()
  }

  async function runReminders() {
    if (
      !window.confirm(
        'Mahnungen an Überweiser mit offenen Beiträgen senden? Die Stufe steigt automatisch (Erinnerung → 1. → 2.), Cooldown 5 Tage.',
      )
    ) {
      return
    }
    setBulkBusy(true)
    setError(null)
    setNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'runDueReminders', stage: 'auto', payMethod: 'transfer' }),
    })
    setBulkBusy(false)
    if (!data.ok) {
      setError(errorText(String(data.error ?? 'mail')))
      return
    }
    if (data.skipped) {
      setNote('Noch vor dem ersten Abbuchungstag — keine Erinnerungen.')
      return
    }
    const stages = data.byStage || {}
    setNote(
      `Fälligkeits-Lauf: ${data.sent ?? 0} von ${data.candidates ?? 0} · Erinnerung ${stages.reminder ?? 0} · 1. Mahnung ${stages.mahnung1 ?? 0} · 2. Mahnung ${stages.mahnung2 ?? 0}`,
    )
    await refresh()
  }

  return (
    <section className="admin-dues">
      <p className="admin-muted">
        Alle offenen und nicht erhaltenen Beiträge. Mahnung geht per Mail raus und wird beim Mitglied gespeichert.
        Täglich um 8 Uhr (Berlin) laufen Mahnungen für Überweiser mit automatischer Stufen-Erhöhung.
      </p>
      <div className="admin-stats">
        <article className={totals.people ? 'is-alert' : ''}>
          <strong>{totals.people}</strong>
          <span>Mit offenen Beiträgen</span>
        </article>
        <article className={totals.amount ? 'is-alert' : ''}>
          <strong>{euro(totals.amount)}</strong>
          <span>Offene Summe</span>
        </article>
        <article>
          <strong>{totals.count}</strong>
          <span>Offene Monate / Tage</span>
        </article>
      </div>
      <div className="admin-filters">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name, Mail, Telefon" />
        <select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
          <option value="">Alle Zahlungsarten</option>
          <option value="transfer">Banküberweisung</option>
          <option value="card">Karte / Apple Pay</option>
        </select>
        <label className="admin-month">
          <span>Monat</span>
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        {period ? (
          <button className="btn btn-ghost" type="button" onClick={() => setPeriod('')}>
            {monthLabel(period)} ✕
          </button>
        ) : null}
        <button className="btn btn-solid" type="button" disabled={bulkBusy || !period || !totals.people} onClick={() => void bulkPay()}>
          Monat als gezahlt (Sammel)
        </button>
        <button className="btn btn-ghost" type="button" disabled={bulkBusy} onClick={() => void runReminders()}>
          Fälligkeits-Mails jetzt
        </button>
        <label className="btn btn-ghost admin-file-btn">
          Kontoauszug CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            disabled={bankBusy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void onBankFile(file)
            }}
          />
        </label>
      </div>
      {note ? <p className="admin-ok">{note}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      {bankMatches.length ? (
        <div className="admin-block">
          <h3>Kontoauszug-Treffer</h3>
          <p className="admin-muted">
            Treffer über IBAN, E-Mail/ID im Verwendungszweck, Name und Betrag. Einzelne Zeilen an- oder abwählen.
          </p>
          <div className="admin-inline" style={{ marginBottom: 8 }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setBankMatches((rows) => rows.map((row) => ({ ...row, selected: true })))}
            >
              Alle an
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setBankMatches((rows) => rows.map((row) => ({ ...row, selected: false })))}
            >
              Alle aus
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Buchung</th>
                  <th>Mitglied</th>
                  <th>Posten</th>
                  <th>Betrag</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {bankMatches.map((row, index) => (
                  <tr key={`${row.txnIndex}-${row.memberId}-${row.period}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(row.selected)}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setBankMatches((rows) =>
                            rows.map((item, i) => (i === index ? { ...item, selected: checked } : item)),
                          )
                        }}
                      />
                    </td>
                    <td>
                      <small>
                        {row.date || '—'} · {row.name || row.purpose || '—'}
                        {row.iban ? ` · ${row.iban}` : ''}
                      </small>
                    </td>
                    <td>
                      <button type="button" className="admin-linkish" onClick={() => onOpenMember(row.memberId)}>
                        <strong>{row.memberName}</strong>
                      </button>
                    </td>
                    <td>{periodLabel(row.period)}</td>
                    <td>{euro(row.amount)}</td>
                    <td>
                      <small>{row.score}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-solid" type="button" disabled={bankBusy} onClick={() => void applyBankMatches()}>
            Ausgewählte als gezahlt verbuchen
          </button>
          {bankUnmatched.length ? (
            <p className="admin-muted">{bankUnmatched.length} Eingänge ohne sicheren Treffer — manuell prüfen.</p>
          ) : null}
        </div>
      ) : null}
      {dues.length === 0 ? <p className="admin-muted">Gerade nichts offen.</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mitglied</th>
              <th>Offen</th>
              <th>Summe</th>
              <th>Zahlung</th>
              <th>Letzte Mahnung</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {dues.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className="admin-linkish" onClick={() => onOpenMember(row.id)}>
                    <strong>
                      {row.firstName} {row.lastName}
                    </strong>
                  </button>
                  <br />
                  <small>
                    {row.planName} · {STATUS_LABEL[row.status]}
                  </small>
                </td>
                <td className="is-bad">
                  {row.openPeriods.map((period) => periodLabel(period)).join(', ')}
                </td>
                <td className="is-bad">{euro(row.openAmount)}</td>
                <td>
                  {row.payMethod === 'transfer' ? 'Überweisung' : row.payMethod === 'card' ? 'Karte' : '—'}
                </td>
                <td>
                  {row.lastReminderAt ? (
                    <>
                      {new Date(row.lastReminderAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                      <br />
                      <small>{row.reminderCount}×</small>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <div className="admin-inline">
                    <select
                      value={stageById[row.id] || 'reminder'}
                      onChange={(event) => setStageById((prev) => ({ ...prev, [row.id]: event.target.value }))}
                      disabled={busyId === row.id}
                    >
                      <option value="reminder">Erinnerung</option>
                      <option value="mahnung1">1. Mahnung</option>
                      <option value="mahnung2">2. Mahnung</option>
                    </select>
                    <button
                      className="btn btn-solid"
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void sendReminder(row.id)}
                    >
                      Senden
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void markPaid(row.id)}
                    >
                      Gezahlt
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Report({
  onShowList,
  onShowDues,
}: {
  onShowList: (ym: string) => void
  onShowDues: (ym: string) => void
}) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [month, setMonth] = useState('')
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => {
    let alive = true
    void api(`/api/admin?report=${year}`).then(({ data }) => {
      if (alive && data.ok) setReport(data.report)
    })
    return () => {
      alive = false
    }
  }, [year])

  if (!report) return <p className="admin-muted">Laden…</p>

  const picked = month ? report.months.find((row) => row.ym === month) : null
  const view = picked ?? report.totals
  const nowYm = report.today.slice(0, 7)
  const stockRow = picked ?? snapshotMonth(report.months, report.today)
  const stockLabel = `${MONTH_NAMES[Number(stockRow.ym.slice(5)) - 1]}${stockRow.ym > nowYm ? ', geplant' : ''}`
  const peak = Math.max(1, ...report.months.map((row) => Math.max(row.signups, row.cancellations)))
  const scope = picked ? monthLabel(picked.ym) : `Jahr ${report.year}`

  return (
    <section className="admin-report">
      <div className="admin-filters admin-report-filters">
        <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {report.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={month} onChange={(event) => setMonth(event.target.value)}>
          <option value="">Ganzes Jahr</option>
          {report.months.map((row) => (
            <option key={row.ym} value={row.ym}>
              {MONTH_NAMES[Number(row.ym.slice(5)) - 1]}
            </option>
          ))}
        </select>
        {picked ? (
          <>
            <button className="btn btn-ghost" type="button" onClick={() => onShowList(picked.ym)}>
              Anmeldungen {monthLabel(picked.ym)} in der Liste
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => onShowDues(picked.ym)}>
              Offene Beiträge {monthLabel(picked.ym)}
            </button>
          </>
        ) : null}
      </div>

      <h2 className="admin-report-scope">{scope}</h2>
      <div className="admin-stats">
        <article className="is-new">
          <strong>{view.signups}</strong>
          <span>Neue Verträge</span>
        </article>
        <article>
          <strong>
            {view.online} / {view.desk}
          </strong>
          <span>Online / Tresen</span>
        </article>
        <article className={view.cancellations ? 'is-alert' : ''}>
          <strong>{view.cancellations}</strong>
          <span>Kündigungen eingegangen</span>
        </article>
        <article>
          <strong>{view.endings}</strong>
          <span>Verträge beendet</span>
        </article>
        <article>
          <strong>{stockRow.stock ?? 0}</strong>
          <span>Mitglieder Ende {stockLabel}</span>
        </article>
        <article>
          <strong>{view.daypasses}</strong>
          <span>Tageskarten · {euro(view.dayRevenue)}</span>
        </article>
      </div>
      <div className="admin-stats">
        <article>
          <strong>{euro(stockRow.expected ?? 0)}</strong>
          <span>Beiträge laut Bestand ({stockLabel})</span>
        </article>
        <article className="is-new">
          <strong>{euro(view.paid)}</strong>
          <span>Beiträge eingegangen</span>
        </article>
        <article
          className={view.open ? 'is-alert' : ''}
          role="button"
          tabIndex={0}
          onClick={() => onShowDues(picked?.ym || stockRow.ym)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onShowDues(picked?.ym || stockRow.ym)
          }}
        >
          <strong>{euro(view.open)}</strong>
          <span>Offen / nicht erhalten ({view.openCount})</span>
        </article>
        <article>
          <strong>
            {view.byPlan.slowstart ?? 0} · {view.byPlan.standard} · {view.byPlan.flex} · {view.byPlan.plus} ·{' '}
            {view.byPlan.first50}
          </strong>
          <span>Slow Start · Standard · Flex · Plus · First 50</span>
        </article>
        <article>
          <strong>{view.minors}</strong>
          <span>Davon unter 18</span>
        </article>
      </div>

      <h3>Anmeldungen und Kündigungen {report.year}</h3>
      <div className="admin-chart" role="img" aria-label={`Neue Verträge und Kündigungen pro Monat ${report.year}`}>
        {report.months.map((row) => (
          <button
            key={row.ym}
            type="button"
            className={`admin-chart-col ${row.ym === month ? 'is-on' : ''}`}
            onClick={() => setMonth(row.ym === month ? '' : row.ym)}
          >
            <span className="admin-chart-bars">
              <span className="bar-in" style={{ height: `${(row.signups / peak) * 100}%` }}>
                {row.signups || ''}
              </span>
              <span className="bar-out" style={{ height: `${(row.cancellations / peak) * 100}%` }}>
                {row.cancellations || ''}
              </span>
            </span>
            <small>{MONTH_NAMES[Number(row.ym.slice(5)) - 1].slice(0, 3)}</small>
          </button>
        ))}
      </div>
      <p className="admin-muted">
        <span className="legend-in" /> Neue Verträge <span className="legend-out" /> Kündigungen. Monat antippen zum Filtern.
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Monat</th>
              <th>Neu</th>
              <th>Online</th>
              <th>Tresen</th>
              <th>Kündig.</th>
              <th>Bestand</th>
              <th>Tageskarten</th>
              <th>Soll</th>
              <th>Eingang</th>
              <th>Offen</th>
            </tr>
          </thead>
          <tbody>
            {report.months.map((row) => (
              <tr key={row.ym} className={row.ym === month ? 'is-on' : ''} onClick={() => setMonth(row.ym)}>
                <td>{MONTH_NAMES[Number(row.ym.slice(5)) - 1]}</td>
                <td>{row.signups}</td>
                <td>{row.online}</td>
                <td>{row.desk}</td>
                <td>{row.cancellations}</td>
                <td>{row.stock}</td>
                <td>{row.daypasses}</td>
                <td>{euro(row.expected)}</td>
                <td>{euro(row.paid)}</td>
                <td className={row.open ? 'is-bad' : ''}>{euro(row.open)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Summe</td>
              <td>{report.totals.signups}</td>
              <td>{report.totals.online}</td>
              <td>{report.totals.desk}</td>
              <td>{report.totals.cancellations}</td>
              <td>—</td>
              <td>{report.totals.daypasses}</td>
              <td>—</td>
              <td>{euro(report.totals.paid)}</td>
              <td>{euro(report.totals.open)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="admin-muted">
        Neue Verträge nach Anmeldedatum. Bestand = laufende Verträge am Monatsende (ohne wartende U18-Anmeldungen).
        Soll = Monatsbeiträge dieser Verträge ohne Pausen. Eingang und Offen kommen aus den Zahlungsmonaten.
      </p>
    </section>
  )
}

type PreregStatus = 'neu' | 'kontaktiert' | 'mitglied' | 'abgesagt'

type Prereg = {
  id: string
  name: string
  age: number | null
  email: string
  phone: string
  sports: string[]
  sportsOther: string
  experience: string
  times: string
  offer: 'ja' | 'nein' | 'vielleicht' | ''
  sources: string[]
  sourceOther: string
  notify: boolean | null
  goal: string
  message: string
  status: PreregStatus
  note: string
  submissions: number
  createdAt: string | null
  updatedAt: string
  listNo?: number | null
  price?: number | null
  remarks?: string[]
  extraEmails?: string[]
  first50?: boolean
  openingMail?: boolean
}

type PreregStats = {
  total: number
  fresh: number
  offerYes: number
  offerMaybe: number
  notify: number
  minors: number
  members: number
  fromList: number
  fromWebsite: number
  first50: number
  bySport: Record<string, number>
  bySource: Record<string, number>
}

const PREREG_STATUS_LABEL: Record<PreregStatus, string> = {
  neu: 'Neu',
  kontaktiert: 'Kontaktiert',
  mitglied: 'Ist Mitglied',
  abgesagt: 'Kein Interesse',
}

const OFFER_LABEL: Record<Prereg['offer'], string> = { ja: 'Ja', nein: 'Nein', vielleicht: 'Vielleicht', '': '—' }

const isMinor = (entry: Prereg) => typeof entry.age === 'number' && entry.age < 18

function preregSummary(row: Prereg) {
  const parts: string[] = []
  if (row.age != null) parts.push(`${row.age} J.`)
  if (row.sports.length) parts.push(row.sports.map(sportLabel).join(', '))
  if (row.offer) parts.push(`Eröffnungspreis ${OFFER_LABEL[row.offer]}`)
  if (row.listNo != null) {
    parts.push(`Google-Liste Nr. ${row.listNo}${row.first50 ? ' · First 50' : ''}`)
  }
  return parts.join(' · ')
}

const SPORT_LABEL: Record<string, string> = {
  BOXEN: 'Boxen',
  RINGEN: 'Ringen',
  'FITNESS BOXEN': 'Fitness-Boxen',
  SONSTIGES: 'Sonstiges',
}

function sportLabel(sport: string) {
  return SPORT_LABEL[sport] ?? sport
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase()
}

function deDateTime(iso?: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PreregPane({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: Prereg
  onClose: () => void
  onSaved: (entry: Prereg) => void
  onDeleted: (id: string) => void
}) {
  const [note, setNote] = useState(entry.note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(payload: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const { data } = await api('/api/admin', { method: 'POST', body: JSON.stringify({ id: entry.id, ...payload }) })
    setBusy(false)
    if (!data.ok) {
      setError('Hat nicht geklappt. Bitte nochmal versuchen.')
      return null
    }
    return data
  }

  async function update(payload: Record<string, unknown>) {
    const data = await send({ action: 'preregUpdate', ...payload })
    if (data?.entry) onSaved(data.entry)
  }

  async function remove() {
    if (!window.confirm(`Voranmeldung von ${entry.name} wirklich löschen?`)) return
    const data = await send({ action: 'preregDelete' })
    if (data) onDeleted(entry.id)
  }

  const sports = entry.sports.map((sport) =>
    sport === 'SONSTIGES' && entry.sportsOther ? `Sonstiges (${entry.sportsOther})` : sportLabel(sport),
  )
  const sources = entry.sources.map((source) =>
    source === 'Sonstiges' && entry.sourceOther ? `Sonstiges (${entry.sourceOther})` : source,
  )

  return (
    <section className="admin-pane">
      <header className="admin-pane-top">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Schließen
        </button>
        <select value={entry.status} disabled={busy} onChange={(event) => void update({ status: event.target.value })}>
          {(Object.keys(PREREG_STATUS_LABEL) as PreregStatus[]).map((key) => (
            <option key={key} value={key}>
              {PREREG_STATUS_LABEL[key]}
            </option>
          ))}
        </select>
      </header>

      <div>
        <h2>
          {entry.name || entry.email}
          {isMinor(entry) ? <em className="admin-u18"> U18</em> : null}
        </h2>
        <p className="admin-muted">
          {[
            entry.age != null ? `${entry.age} Jahre` : null,
            entry.createdAt ? `über die Website am ${deDateTime(entry.createdAt)}` : null,
            entry.submissions > 1 ? `${entry.submissions}× abgeschickt, zuletzt ${deDateTime(entry.updatedAt)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <dl className="admin-dl">
        <div>
          <dt>Mail / Telefon</dt>
          <dd>
            <a href={`mailto:${entry.email}`}>{entry.email}</a>
            {entry.phone ? (
              <>
                <br />
                <a href={`tel:${entry.phone.replace(/[^+0-9]/g, '')}`}>{entry.phone}</a>
              </>
            ) : null}
          </dd>
        </div>
        {entry.listNo != null ? (
          <div>
            <dt>Google-Voranmeldung (Excel-Liste)</dt>
            <dd>
              Nr. {entry.listNo}
              {entry.first50 ? ' · First 50' : ' · Warteliste'}
              {entry.price != null ? ` · ${euro(entry.price)}` : ''}
              {entry.openingMail ? ' · Eröffnungsmail verschickt' : ''}
            </dd>
          </div>
        ) : null}
        {entry.remarks?.length || entry.extraEmails?.length ? (
          <div>
            <dt>Hinweise aus der Liste</dt>
            <dd>
              {[...(entry.remarks ?? []), ...(entry.extraEmails ?? []).map((mail) => `weitere Mail: ${mail}`)].join(' · ')}
            </dd>
          </div>
        ) : null}
        {sports.length ? (
          <div>
            <dt>Sportarten</dt>
            <dd>{sports.join(', ')}</dd>
          </div>
        ) : null}
        {entry.experience ? (
          <div>
            <dt>Erfahrung</dt>
            <dd className="admin-pre">{entry.experience}</dd>
          </div>
        ) : null}
        {entry.times ? (
          <div>
            <dt>Trainingszeiten</dt>
            <dd className="admin-pre">{entry.times}</dd>
          </div>
        ) : null}
        {entry.offer ? (
          <div>
            <dt>Mitgliedschaft zum Eröffnungspreis</dt>
            <dd>{OFFER_LABEL[entry.offer]}</dd>
          </div>
        ) : null}
        {entry.notify != null ? (
          <div>
            <dt>Infos zu Probetraining und Anmeldung</dt>
            <dd>{entry.notify ? 'Ja, gern informieren' : 'Nein'}</dd>
          </div>
        ) : null}
        {sources.length ? (
          <div>
            <dt>Erfahren über</dt>
            <dd>{sources.join(', ')}</dd>
          </div>
        ) : null}
        {entry.goal ? (
          <div>
            <dt>Persönliches Ziel</dt>
            <dd className="admin-pre">{entry.goal}</dd>
          </div>
        ) : null}
        {!entry.createdAt ? (
          <div>
            <dt>Antworten zum Formular</dt>
            <dd className="admin-muted">
              Nicht in der Excel-Liste enthalten. Füllt die Person das neue Formular aus, erscheinen die Antworten hier.
            </dd>
          </div>
        ) : null}
        {entry.message ? (
          <div>
            <dt>Nachricht</dt>
            <dd className="admin-pre">{entry.message}</dd>
          </div>
        ) : null}
      </dl>

      <label className="admin-notes">
        <span>Interne Notiz</span>
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="admin-pane-actions">
        <button
          className="btn btn-solid"
          type="button"
          disabled={busy || note === entry.note}
          onClick={() => void update({ note })}
        >
          Notiz speichern
        </button>
        <button className="btn btn-ghost admin-danger" type="button" disabled={busy} onClick={() => void remove()}>
          Löschen
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
    </section>
  )
}

function Preregs({ onFresh }: { onFresh: (count: number) => void }) {
  const [entries, setEntries] = useState<Prereg[]>([])
  const [stats, setStats] = useState<PreregStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sport, setSport] = useState('')
  const [offer, setOffer] = useState('')
  const [origin, setOrigin] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    const { data } = await api('/api/admin?prereg=1')
    if (data.ok) {
      setEntries(data.entries ?? [])
      setStats(data.stats ?? null)
      onFresh(data.stats?.fresh ?? 0)
    }
    setLoaded(true)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const needle = q.trim().toLowerCase()
  const shown = entries.filter(
    (row) =>
      (!needle || [row.name, row.email, row.phone].some((value) => value.toLowerCase().includes(needle))) &&
      (!status || row.status === status) &&
      (!sport || row.sports.includes(sport)) &&
      (!offer || row.offer === offer) &&
      (!origin ||
        (origin === 'website' && Boolean(row.createdAt)) ||
        (origin === 'liste' && row.listNo != null) ||
        (origin === 'first50' && row.first50 === true) ||
        (origin === 'warteliste' && row.listNo != null && !row.first50)),
  )
  const open = openId ? entries.find((row) => row.id === openId) ?? null : null

  if (!loaded) return <p className="admin-muted">Laden…</p>

  return (
    <>
      {stats ? (
        <>
          <section className="admin-stats">
            <article className={stats.fresh ? 'is-new' : ''}>
              <strong>{stats.fresh}</strong>
              <span>Neu, noch nicht kontaktiert</span>
            </article>
            <article>
              <strong>{stats.total}</strong>
              <span>Voranmeldungen gesamt</span>
            </article>
            <article>
              <strong>
                {stats.fromWebsite} / {stats.fromList}
              </strong>
              <span>Website / Google-Liste ({stats.first50} First 50)</span>
            </article>
            <article>
              <strong>
                {stats.offerYes} / {stats.offerMaybe}
              </strong>
              <span>Eröffnungspreis: Ja / Vielleicht</span>
            </article>
            <article>
              <strong>{stats.notify}</strong>
              <span>Wollen informiert werden</span>
            </article>
            <article>
              <strong>{stats.minors}</strong>
              <span>Unter 18</span>
            </article>
            <article>
              <strong>{stats.members}</strong>
              <span>Schon Mitglied</span>
            </article>
          </section>
          {stats.fromWebsite ? (
            <section className="admin-interest">
              <div>
                <h3>Interesse</h3>
                <div className="admin-flags">
                  {Object.entries(stats.bySport)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, count]) => (
                      <button
                        key={key}
                        type="button"
                        className={`admin-chip ${sport === key ? 'is-on' : ''}`}
                        onClick={() => setSport(sport === key ? '' : key)}
                      >
                        {sportLabel(key)} <strong>{count}</strong>
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <h3>Erfahren über</h3>
                <div className="admin-flags">
                  {Object.entries(stats.bySource)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, count]) => (
                      <span key={key} className="admin-chip">
                        {key} <strong>{count}</strong>
                      </span>
                    ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="admin-filters">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name, Mail, Telefon" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Jeder Status</option>
          {(Object.keys(PREREG_STATUS_LABEL) as PreregStatus[]).map((key) => (
            <option key={key} value={key}>
              {PREREG_STATUS_LABEL[key]}
            </option>
          ))}
        </select>
        <select value={sport} onChange={(event) => setSport(event.target.value)}>
          <option value="">Alle Sportarten</option>
          {stats
            ? Object.keys(stats.bySport).map((key) => (
                <option key={key} value={key}>
                  {sportLabel(key)}
                </option>
              ))
            : null}
        </select>
        <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
          <option value="">Alle Herkünfte</option>
          <option value="website">Über die Website</option>
          <option value="liste">Google-Liste (Excel)</option>
          <option value="first50">First 50</option>
          <option value="warteliste">Warteliste</option>
        </select>
        <select value={offer} onChange={(event) => setOffer(event.target.value)}>
          <option value="">Eröffnungspreis egal</option>
          <option value="ja">Eröffnungspreis: Ja</option>
          <option value="vielleicht">Eröffnungspreis: Vielleicht</option>
          <option value="nein">Eröffnungspreis: Nein</option>
        </select>
        <a className="btn btn-ghost" href="/api/admin?prereg=csv">
          Als Excel-Liste (CSV)
        </a>
      </section>

      <div className="admin-split">
        <section className="admin-list">
          {shown.length === 0 ? (
            <p className="admin-muted">
              {entries.length ? 'Keine Voranmeldung passt zum Filter.' : 'Noch keine Voranmeldungen über die Website.'}
            </p>
          ) : null}
          {shown.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`admin-row ${openId === row.id ? 'is-open' : ''}`}
              onClick={() => setOpenId(row.id)}
            >
              <span className="admin-face">{initials(row.name || row.email)}</span>
              <span className="admin-row-copy">
                <strong>
                  {row.name || row.email}
                  {isMinor(row) ? <em> U18</em> : null}
                </strong>
                <small>{preregSummary(row) || row.email}</small>
              </span>
              <span className="admin-row-meta">
                <span className={`admin-pill prereg-${row.status}`}>{PREREG_STATUS_LABEL[row.status]}</span>
                <small>{row.createdAt ? deDate(row.createdAt) : row.listNo != null ? `Liste Nr. ${row.listNo}` : ''}</small>
              </span>
            </button>
          ))}
        </section>

        {open ? (
          <PreregPane
            key={`${open.id}-${open.updatedAt}`}
            entry={open}
            onClose={() => setOpenId(null)}
            onSaved={(next) => {
              setEntries((list) => list.map((row) => (row.id === next.id ? next : row)))
              void load()
            }}
            onDeleted={(id) => {
              setOpenId(null)
              setEntries((list) => list.filter((row) => row.id !== id))
              void load()
            }}
          />
        ) : (
          <p className="admin-muted admin-empty">Voranmeldung links antippen, dann siehst du alle Antworten.</p>
        )}
      </div>
    </>
  )
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
  const [payMethod, setPayMethod] = useState('')
  const [photo, setPhoto] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [members, setMembers] = useState<MemberList[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'members' | 'dues' | 'mail' | 'prereg' | 'report'>('members')
  const [preregFresh, setPreregFresh] = useState(0)
  const [joined, setJoined] = useState('')
  const [duesPeriod, setDuesPeriod] = useState('')

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
    if (payMethod) query.set('payMethod', payMethod)
    if (joined) query.set('joined', joined)
    if (photo) query.set('photo', photo)
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
    if (!data.ok) return
    setDetail(data.member)
    if (data.member.source === 'online' && !data.member.reviewedAt) {
      const marked = await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', id, reviewed: true }),
      })
      if (marked.data.ok) {
        setDetail(marked.data.member)
        await refreshList()
      }
    }
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
    void api('/api/admin?prereg=1').then(({ data }) => {
      if (data.ok) setPreregFresh(data.stats?.fresh ?? 0)
    })
  }, [authed])

  useEffect(() => {
    if (!authed) return
    const timer = window.setTimeout(() => {
      void refreshList()
    }, 180)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, plan, status, pay, payMethod, joined, photo, authed, tab])

  useEffect(() => {
    if (openId) void refreshDetail(openId)
    else setDetail(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function stripeLink(id: string) {
    setBusy(true)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'stripeLink', id }),
    })
    setBusy(false)
    if (!data.ok) return { error: String(data.error ?? 'stripe_fail') }
    if (data.member) setDetail(data.member)
    await refreshList()
    return { url: String(data.checkoutUrl ?? '') }
  }

  async function removeMember(id: string) {
    setBusy(true)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id }),
    })
    setBusy(false)
    if (!data.ok) return String(data.error ?? 'invalid')
    setOpenId(null)
    setDetail(null)
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
          <h1>
            {tab === 'report'
              ? 'Auswertung'
              : tab === 'prereg'
                ? 'Voranmeldungen'
                : tab === 'dues'
                  ? 'Beiträge'
                  : tab === 'mail'
                    ? 'Mail'
                    : 'Mitglieder'}
          </h1>
          <nav className="admin-tabs" aria-label="Bereiche">
            <button type="button" className={tab === 'members' ? 'is-on' : ''} onClick={() => setTab('members')}>
              Mitglieder
            </button>
            <button type="button" className={tab === 'dues' ? 'is-on' : ''} onClick={() => setTab('dues')}>
              Beiträge
              {stats?.openDebt ? <span className="admin-tab-count">{stats.openDebt}</span> : null}
            </button>
            <button type="button" className={tab === 'mail' ? 'is-on' : ''} onClick={() => setTab('mail')}>
              Mail
            </button>
            <button type="button" className={tab === 'prereg' ? 'is-on' : ''} onClick={() => setTab('prereg')}>
              Voranmeldungen
              {preregFresh ? <span className="admin-tab-count">{preregFresh}</span> : null}
            </button>
            <button type="button" className={tab === 'report' ? 'is-on' : ''} onClick={() => setTab('report')}>
              Auswertung
            </button>
          </nav>
        </div>
        <div className="admin-top-actions">
          {tab === 'members' ? (
            <button className="btn btn-ghost" type="button" onClick={() => setCreating((v) => !v)}>
              {creating ? 'Abbrechen' : 'Neu anlegen'}
            </button>
          ) : null}
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

      {tab === 'prereg' ? <Preregs onFresh={setPreregFresh} /> : null}

      {tab === 'dues' ? (
        <DuesPanel
          initialPeriod={duesPeriod}
          onOpenMember={(id) => {
            setOpenId(id)
            setTab('members')
          }}
        />
      ) : null}

      {tab === 'report' ? (
        <Report
          onShowList={(ym) => {
            setJoined(ym)
            setTab('members')
          }}
          onShowDues={(ym) => {
            setDuesPeriod(ym)
            setTab('dues')
          }}
        />
      ) : null}

      {tab === 'members' && stats ? (
        <section className="admin-stats">
          <article className={stats.fresh ? 'is-new' : ''}>
            <strong>{stats.fresh}</strong>
            <span>Neu online</span>
          </article>
          <article>
            <strong>{stats.total}</strong>
            <span>Gesamt</span>
          </article>
          <article>
            <strong>{stats.active}</strong>
            <span>Aktiv / angemeldet</span>
          </article>
          <article
            className={stats.openDebt || stats.openPay ? 'is-alert' : ''}
            role="button"
            tabIndex={0}
            onClick={() => setTab('dues')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') setTab('dues')
            }}
          >
            <strong>{stats.openDebt ?? stats.openPay}</strong>
            <span>
              Offene Beiträge
              {stats.openDebtAmount ? ` · ${euro(stats.openDebtAmount)}` : ''}
            </span>
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
          <article
            className={stats.noPhoto ? 'is-alert' : ''}
            role="button"
            tabIndex={0}
            onClick={() => setPhoto('missing')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') setPhoto('missing')
            }}
          >
            <strong>{stats.noPhoto ?? 0}</strong>
            <span>Portrait fehlt</span>
          </article>
        </section>
      ) : null}

      {tab === 'mail' ? <BroadcastMailer /> : null}
      {tab === 'members' ? <PhotoRequestBulk missing={stats?.noPhoto ?? 0} onDone={() => void refreshList()} /> : null}
      {tab === 'members' ? <First50Sender /> : null}

      {tab === 'members' && creating ? <CreateMember onDone={async (id) => {
        setCreating(false)
        setOpenId(id)
        await refreshList()
      }} /> : null}

      {tab === 'members' ? (
      <>
      <section className="admin-filters">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name, Mail, Telefon" />
        <select value={plan} onChange={(event) => setPlan(event.target.value)}>
          <option value="">Alle Tarife</option>
          <option value="slowstart">Slow Start Tarif</option>
          <option value="standard">Standard</option>
          <option value="flex">Flex</option>
          <option value="plus">Plus</option>
          <option value="first50">First 50</option>
          <option value="daypass">Day Pass</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Jeder Status</option>
          <option value="active">Aktiv</option>
          <option value="received">Angemeldet</option>
          <option value="paused">Pausiert</option>
          <option value="cancelled">Gekündigt</option>
          <option value="withdrawn">Widerruf</option>
        </select>
        <select value={pay} onChange={(event) => setPay(event.target.value)}>
          <option value="">Zahlung alle</option>
          <option value="paid">Beitrag gezahlt</option>
          <option value="open">Offen</option>
          <option value="failed">Nicht erhalten</option>
          <option value="upcoming">Noch nicht fällig</option>
        </select>
        <select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
          <option value="">Alle Zahlungsarten</option>
          <option value="transfer">Banküberweisung</option>
          <option value="card">Karte / Apple Pay</option>
        </select>
        <select value={photo} onChange={(event) => setPhoto(event.target.value)}>
          <option value="">Foto alle</option>
          <option value="missing">Portrait fehlt</option>
          <option value="has">Portrait da</option>
        </select>
        <label className="admin-month">
          <span>Angemeldet im</span>
          <input type="month" value={joined} onChange={(event) => setJoined(event.target.value)} />
        </label>
        {joined ? (
          <button className="btn btn-ghost" type="button" onClick={() => setJoined('')}>
            {monthLabel(joined)} ✕
          </button>
        ) : null}
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
                  {row.isNew ? <span className="admin-new">Neu online</span> : null}
                </strong>
                {row.payMethod === 'transfer' ||
                row.payMethod === 'card' ||
                row.guardianMissing ||
                row.bankMissing ||
                row.contractMissing ||
                (!row.hasPhoto && row.plan !== 'daypass') ||
                (row.openCount ?? 0) > 0 ? (
                  <span className="admin-flags">
                    {row.payMethod === 'transfer' ? <span className="admin-flag is-ok">Banküberweisung</span> : null}
                    {row.payMethod === 'card' && !row.bankMissing ? (
                      <span className="admin-flag is-ok">Karte / Apple Pay</span>
                    ) : null}
                    {(row.openCount ?? 0) > 0 ? (
                      <span className="admin-flag">
                        {row.openCount} offen · {euro(row.openAmount)}
                      </span>
                    ) : null}
                    {row.contractMissing ? <span className="admin-flag">Vertrag fehlt</span> : null}
                    {row.guardianMissing ? <span className="admin-flag">Eltern-Unterschrift fehlt</span> : null}
                    {row.bankMissing ? <span className="admin-flag">Kontodaten fehlen</span> : null}
                    {!row.hasPhoto && row.plan !== 'daypass' ? <span className="admin-flag">Portrait fehlt</span> : null}
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
            onStripeLink={() => stripeLink(detail.id)}
            onDelete={() => removeMember(detail.id)}
            onReplace={(next) => {
              setDetail(next)
              void refreshList()
            }}
          />
        ) : (
          <p className="admin-muted admin-empty">Mitglied antippen.</p>
        )}
      </div>
      </>
      ) : null}
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
  onStripeLink,
  onDelete,
}: {
  member: MemberDetail
  busy: boolean
  onClose: () => void
  onPatch: (payload: Record<string, unknown>) => Promise<string | null>
  onPay: (payment: Payment, next: PayStatus) => Promise<void>
  onReplace: (member: MemberDetail) => void
  onStripeLink: () => Promise<{ error?: string; url?: string }>
  onDelete: () => Promise<string | null>
}) {
  const [notes, setNotes] = useState(member.notes ?? '')
  const [bank, setBank] = useState<BankForm>(bankForm(member.bank))
  const [guardian, setGuardian] = useState<GuardianForm>(guardianForm(member.guardian))
  const [signatures, setSignatures] = useState<DeskSignatures>({
    place: member.place || 'Leipzig',
    signature: member.signature || `${member.firstName} ${member.lastName}`.trim(),
    gymSignature: member.gymSignature || '',
    guardianSignature: member.guardian?.signature || '',
    secondGuardianSignature: member.secondGuardianSignature || '',
    mandateSignature: member.bank?.mandateSignature || '',
  })
  const [sending, setSending] = useState(false)
  const [stripeId, setStripeId] = useState(member.stripe?.customerId ?? '')
  const [payLink, setPayLink] = useState('')
  const [paneError, setPaneError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [reminderStage, setReminderStage] = useState('reminder')
  const [reminderNote, setReminderNote] = useState<string | null>(null)

  async function save(payload: Record<string, unknown>) {
    setPaneError(null)
    const error = await onPatch(payload)
    if (error) setPaneError(errorText(error))
  }

  async function sendContract() {
    setSending(true)
    setPaneError(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendContract', id: member.id, signatures }),
    })
    setSending(false)
    if (!data.ok) {
      setPaneError(errorText(data.error))
      return
    }
    onReplace(data.member)
  }

  async function sendReminder(force = false) {
    setSending(true)
    setPaneError(null)
    setReminderNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendReminder', id: member.id, stage: reminderStage, force }),
    })
    setSending(false)
    if (!data.ok) {
      if (data.error === 'cooldown') {
        if (window.confirm('In den letzten fünf Tagen ging schon eine Mahnung raus. Trotzdem noch einmal senden?')) {
          await sendReminder(true)
        }
        return
      }
      setPaneError(errorText(String(data.error ?? '')))
      return
    }
    setReminderNote(`${REMINDER_STAGE_LABEL[reminderStage] || 'Mahnung'} raus an ${member.email}.`)
    onReplace(data.member)
  }

  async function markOpenPaid() {
    if (!window.confirm('Alle offenen Beiträge als gezahlt markieren?')) return
    setSending(true)
    setPaneError(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'payOpen', id: member.id }),
    })
    setSending(false)
    if (!data.ok) {
      setPaneError(errorText(String(data.error ?? '')))
      return
    }
    setReminderNote(`${data.marked ?? 0} Beitrag(e) auf gezahlt gesetzt.`)
    onReplace(data.member)
  }

  async function issueReceipt(payment: Payment) {
    setSending(true)
    setPaneError(null)
    setReminderNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({
        action: 'issueReceipt',
        id: member.id,
        period: payment.period,
        kind: payment.kind,
      }),
    })
    setSending(false)
    if (!data.ok) {
      setPaneError(errorText(String(data.error ?? 'receipt')))
      return
    }
    if (data.member) onReplace(data.member)
    setReminderNote(`Quittung ${data.number} erstellt.`)
    if (data.pdfUrl) window.open(data.pdfUrl, '_blank', 'noopener,noreferrer')
  }

  async function sendPriceNote() {
    setSending(true)
    setPaneError(null)
    setReminderNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendPriceNote', id: member.id }),
    })
    setSending(false)
    if (!data.ok) {
      setPaneError(errorText(String(data.error ?? '')))
      return
    }
    setReminderNote(`Preis-Hinweis raus an ${data.email}.`)
    if (data.member) onReplace(data.member)
  }

  async function sendPayLinkMail() {
    setSending(true)
    setPaneError(null)
    setReminderNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendPayLink', id: member.id }),
    })
    setSending(false)
    if (!data.ok) {
      setPaneError(errorText(String(data.error ?? '')))
      return
    }
    setReminderNote(`Zahlungslink-Mail raus an ${data.email || member.email}.`)
    if (data.member) onReplace(data.member)
    else if (data.checkoutUrl) setPayLink(String(data.checkoutUrl))
  }

  const holderHint = member.minor && member.guardian?.name ? member.guardian.name : `${member.firstName} ${member.lastName}`

  async function onPhoto(file: File | undefined) {
    if (!file) return
    const photoData = await compressPhoto(file)
    await onPatch({ photoData })
  }

  async function sendPhotoRequest() {
    setSending(true)
    setPaneError(null)
    setReminderNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendPhotoRequest', id: member.id }),
    })
    setSending(false)
    if (!data.ok) {
      setPaneError(errorText(String(data.error ?? '')))
      return
    }
    setReminderNote(`Foto-Link raus an ${data.email || member.email}.`)
    if (data.member) onReplace(data.member)
  }

  async function remove() {
    const name = `${member.firstName} ${member.lastName}`.trim()
    const stripe = Boolean(member.stripe?.customerId || member.stripe?.subscriptionId)
    const stripeNote = stripe
      ? '\n\nDas Stripe-Abo wird nicht beendet. Die Abbuchung läuft weiter, bis du es in Stripe stoppst.'
      : ''
    if (!window.confirm(`${name} wirklich aus der Verwaltung löschen? Die Person und die hochgeladenen Unterlagen sind danach weg.${stripeNote}`)) {
      return
    }
    setPaneError(null)
    const error = await onDelete()
    if (error) setPaneError(errorText(error))
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
          onChange={(event) => {
            const next = event.target.value
            if (
              next === 'paused' &&
              !window.confirm(
                'Mitglied pausieren? Alle künftigen Monatsbeiträge (noch nicht fällig) werden auf „erlassen“ gesetzt. Bereits offene Monate bleiben offen.',
              )
            ) {
              event.target.value = member.status
              return
            }
            void onPatch({ status: next })
          }}
        >
          <option value="active">Aktiv</option>
          <option value="received">Angemeldet</option>
          <option value="paused">Pausiert</option>
          <option value="cancelled">Gekündigt</option>
          <option value="withdrawn">Widerruf</option>
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
          {!member.photoData && member.plan !== 'daypass' ? (
            <p className="admin-muted">Portrait fehlt – bitte per Link anfordern oder hier nachpflegen.</p>
          ) : null}
        </div>
      </div>
      {!member.photoData && member.plan !== 'daypass' ? (
        <section className="admin-block">
          <h3>Portrait anfordern</h3>
          <p className="admin-muted">
            Schickt eine Mail mit persönlichem Upload-Link. Darin steht klar, dass es ein Gesichtsbild sein muss und
            warum.
          </p>
          <button
            className="btn btn-solid"
            type="button"
            disabled={busy || sending}
            onClick={() => void sendPhotoRequest()}
          >
            Foto-Link senden
          </button>
        </section>
      ) : null}

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
          <dt>{member.status === 'withdrawn' ? 'Widerruf' : 'Kündigung'}</dt>
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
            <dt>Zahlung</dt>
            <dd>
              {member.payMethod === 'transfer' ? (
                <>
                  Banküberweisung
                  <br />
                  {member.transfer?.holder || 'KONNI MMA GYM GbR'}
                  {member.transfer?.iban ? ` · ${spacedIban(member.transfer.iban)}` : ''}
                  <br />
                  {[member.transfer?.bic, member.transfer?.bank].filter(Boolean).join(' · ')}
                  <br />
                  <small>Beitrag jeweils zum 1. des Monats. Erste Überweisung am 1. November 2026.</small>
                </>
              ) : (
                <>
                  Karte, Apple Pay oder Google Pay
                  <br />
                  <small>Über Stripe. Erste Abbuchung am 1. November 2026. Eine IBAN ist dafür nicht nötig.</small>
                  {member.bank?.iban ? (
                    <>
                      <br />
                      {member.bank.holder} · {spacedIban(member.bank.iban)}
                      <br />
                      Mandat {member.bank.mandateRef} ·{' '}
                      {member.bank.mandateSignedAt ? `unterschrieben ${deDate(member.bank.mandateSignedAt)}` : 'Unterschrift fehlt'}
                    </>
                  ) : null}
                </>
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="admin-inline">
        {member.docs?.contract ? (
          <a
            className="btn btn-ghost admin-print"
            href={`/api/admin?id=${encodeURIComponent(member.id)}&doc=contract`}
            target="_blank"
            rel="noreferrer"
          >
            Unterschriebenen Vertrag öffnen
          </a>
        ) : (
          <a
            className="btn btn-ghost admin-print"
            href={`/api/admin?id=${encodeURIComponent(member.id)}&pdf=contract`}
            target="_blank"
            rel="noreferrer"
          >
            Vertrag{member.plan !== 'daypass' && member.payMethod !== 'transfer' ? ' + SEPA-Mandat' : ''} zum Unterschreiben drucken
          </a>
        )}
        {member.payMethod === 'transfer' && member.docs?.payment ? (
          <a
            className="btn btn-ghost admin-print"
            href={`/api/admin?id=${encodeURIComponent(member.id)}&doc=payment`}
            target="_blank"
            rel="noreferrer"
          >
            Hinweis Banküberweisung öffnen
          </a>
        ) : null}
      </div>

      <section className="admin-block">
        <h3>Vertragsmail</h3>
        <p className="admin-muted">
          Die Mail mit den Daten und dem Vertrag geht nur raus, wenn du sie hier auslöst. Beim Anlegen passiert das
          nicht. Das Mitglied bekommt den Vertrag mit diesen Unterschriften und die Widerrufsbelehrung. Eine Kopie geht
          an das Studio.
          {member.docs?.contract ? ' Der hochgeladene Scan liegt zusätzlich bei.' : ''}
        </p>
        <SignatureFields
          value={signatures}
          onChange={setSignatures}
          minor={member.minor}
          mandate={Boolean(member.bank?.iban)}
        />
        {member.contractMailAt ? (
          <p className="admin-muted">Zuletzt raus am {new Date(member.contractMailAt).toLocaleString('de-DE')}.</p>
        ) : (
          <p className="admin-muted">Noch keine Vertragsmail.</p>
        )}
        <div className="admin-inline">
          <button className="btn btn-ghost" type="button" disabled={busy || sending} onClick={() => void save({ signatures })}>
            Unterschriften speichern
          </button>
          <button className="btn btn-solid" type="button" disabled={busy || sending} onClick={() => void sendContract()}>
            Mail mit Vertrag senden
          </button>
        </div>
      </section>

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
          {member.payMethod === 'transfer' ? (
            <DocSlot
              memberId={member.id}
              kind="payment"
              label="Zahlungsart Banküberweisung"
              hint="Bei der Anmeldung wurde Banküberweisung als Zahlung genommen."
              doc={member.docs?.payment}
              busy={busy}
              onChanged={onReplace}
            />
          ) : (
            <DocSlot
              memberId={member.id}
              kind="sepa"
              label="SEPA-Lastschriftmandat"
              hint="PDF-Scan oder Handyfoto vom unterschriebenen Mandat."
              doc={member.docs?.sepa}
              busy={busy}
              onChanged={onReplace}
            />
          )}
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

      {member.plan !== 'daypass' && member.payMethod === 'transfer' ? (
        <section className="admin-block is-pay">
          <h3>Zahlung: Banküberweisung</h3>
          <p className="admin-muted">
            Bei der Anmeldung wurde Banküberweisung als Zahlung genommen. Es gibt kein SEPA-Lastschriftmandat. Der
            Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Die erste Überweisung ist am 1. November 2026 fällig.
            Das Mitglied überweist selbst auf das Konto der KONNI MMA GYM GbR.
          </p>
          {member.transfer?.iban ? (
            <p>
              {member.transfer.holder || 'KONNI MMA GYM GbR'}
              <br />
              {spacedIban(member.transfer.iban)}
              {member.transfer.bic ? ` · ${member.transfer.bic}` : ''}
              {member.transfer.bank ? ` · ${member.transfer.bank}` : ''}
            </p>
          ) : null}
          <div className="admin-inline">
            <button className="btn btn-ghost" type="button" disabled={sending || busy} onClick={() => void sendPriceNote()}>
              Preis-Hinweis per Mail
            </button>
          </div>
          {member.priceNoteAt ? (
            <p className="admin-muted">
              Zuletzt Preis-Hinweis am{' '}
              {new Date(member.priceNoteAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.
            </p>
          ) : null}
        </section>
      ) : member.plan !== 'daypass' ? (
        <section className={`admin-block ${member.bank?.iban && !member.bank.mandateSignedAt ? 'is-alert' : ''}`}>
          <h3>{member.bank?.iban ? 'Kontodaten für Lastschrift' : 'Zahlung: Karte / Apple Pay'}</h3>
          <p className="admin-muted">
            {member.bank?.iban
              ? 'SEPA-Lastschrift kommt später. Das Mandat ist nur vollständig, wenn die Unterschrift da ist.'
              : 'Das Mitglied zahlt mit Karte, Apple Pay oder Google Pay über Stripe. Eine IBAN ist dafür nicht nötig. SEPA-Lastschrift kommt später und kann hier erfasst werden, sobald sie vereinbart ist.'}
          </p>
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
          <div key={`${row.kind}-${row.period}`} className="admin-pay-wrap">
            <button
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
              <strong>
                {row.kind === 'fee' ? 'Aufnahmegebühr' : row.kind === 'day' ? deDate(row.period) : row.period}
              </strong>
              <span>{PAY_LABEL[row.status]}</span>
              <small>
                {euro(row.amount)}
                {row.source === 'stripe' ? ' · Stripe' : row.source === 'bank_csv' ? ' · Kontoauszug' : ''}
                {row.receiptNumber ? ` · ${row.receiptNumber}` : ''}
              </small>
            </button>
            {row.status === 'paid' ? (
              row.receiptNumber ? (
                <a
                  className="btn btn-ghost"
                  href={`/api/admin?id=${encodeURIComponent(member.id)}&pdf=receipt&period=${encodeURIComponent(row.period)}&kind=${encodeURIComponent(row.kind)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Quittung
                </a>
              ) : (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy || sending}
                  onClick={() => void issueReceipt(row)}
                >
                  Quittung erstellen
                </button>
              )
            ) : null}
          </div>
        ))}
      </div>

      {(member.payments ?? []).some((row) => row.status === 'open' || row.status === 'failed') ? (
        <section className="admin-block is-alert">
          <h3>Mahnung / Ausgleich</h3>
          <p className="admin-muted">
            Mail mit offenen Monaten und Betrag. Verlauf bleibt beim Mitglied. Fünf Tage Abstand, außer du bestätigst
            erneut.
          </p>
          <div className="admin-inline">
            <select value={reminderStage} onChange={(event) => setReminderStage(event.target.value)} disabled={sending || busy}>
              <option value="reminder">Erinnerung</option>
              <option value="mahnung1">1. Mahnung</option>
              <option value="mahnung2">2. Mahnung</option>
            </select>
            <button className="btn btn-solid" type="button" disabled={sending || busy} onClick={() => void sendReminder()}>
              Mahnung senden
            </button>
            <button className="btn btn-ghost" type="button" disabled={sending || busy} onClick={() => void markOpenPaid()}>
              Alles offen als gezahlt
            </button>
          </div>
          {reminderNote ? <p className="admin-ok">{reminderNote}</p> : null}
          {member.reminders?.length ? (
            <ul className="admin-history">
              {[...member.reminders].reverse().slice(0, 8).map((row, index) => (
                <li key={`${row.at}-${index}`}>
                  <small>{new Date(row.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small>
                  <span>
                    <strong>{REMINDER_STAGE_LABEL[row.stage] ?? row.stage}</strong>
                    {' · '}
                    {euro(row.amount)} · {(row.periods ?? []).map(periodLabel).join(', ')}
                    {row.mail ? ` · ${row.mail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {member.plan !== 'daypass' && member.payMethod !== 'transfer' ? (
        <section className="admin-block">
          <h3>Stripe</h3>
          <p className="admin-muted">
            {member.stripe?.chargeNow && member.stripe.delay === 'prorate'
              ? `Anteiliger Beitrag jetzt, volle Monate ab ${deDate(member.stripe.billingStart)}.`
              : `Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Erste Abbuchung ${deDate(member.stripe?.billingStart || '2026-11-01')}. Vorher wird nichts eingezogen.`}
            {member.stripe?.subscriptionId
              ? ' Das Abo ist verknüpft. Die Monate färben sich, sobald die Rechnung kommt.'
              : ' Das Mitglied zahlt auf der Stripe-Seite mit Karte oder Apple Pay. Banküberweisung ist die andere Möglichkeit. SEPA-Lastschrift kommt später und wird im Checkout nicht angezeigt. Der Link gilt 24 Stunden.'}
          </p>
          {member.stripe?.subscriptionId ? null : (
            <div className="admin-inline">
              <button
                className="btn btn-solid"
                type="button"
                disabled={busy || sending}
                onClick={() => {
                  void (async () => {
                    const result = await onStripeLink()
                    if (result.error) {
                      setPaneError(errorText(result.error))
                      setPayLink('')
                      return
                    }
                    setPaneError(null)
                    setPayLink(result.url || '')
                  })()
                }}
              >
                Zahlungslink erzeugen
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={busy || sending}
                onClick={() => void sendPayLinkMail()}
              >
                Link per Mail senden
              </button>
            </div>
          )}
          {member.payLinkAt ? (
            <p className="admin-muted">
              Zuletzt Zahlungslink-Mail am{' '}
              {new Date(member.payLinkAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.
            </p>
          ) : null}
          {payLink ? (
            <div className="admin-inline">
              <input readOnly value={payLink} onFocus={(event) => event.currentTarget.select()} />
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void navigator.clipboard.writeText(payLink)}
              >
                Kopieren
              </button>
            </div>
          ) : null}
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

      <section className="admin-block is-alert">
        <h3>Mitglied löschen</h3>
        <p className="admin-muted">
          Entfernt {member.firstName} {member.lastName} aus der Verwaltung, inklusive hochgeladener Unterlagen.
          {member.stripe?.customerId || member.stripe?.subscriptionId
            ? ' Das Stripe-Abo läuft danach weiter, bis es in Stripe beendet wird.'
            : ''}
        </p>
        <button className="btn btn-ghost admin-danger" type="button" disabled={busy} onClick={() => void remove()}>
          Mitglied löschen
        </button>
      </section>
    </section>
  )
}

function PhotoRequestBulk({ missing, onDone }: { missing: number; onDone: () => void }) {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSend(event: FormEvent) {
    event.preventDefault()
    if (
      !window.confirm(
        `Foto-Link an ${missing} Mitglied${missing === 1 ? '' : 'er'} ohne Portrait senden? Jede Person bekommt eine persönliche Mail.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendPhotoRequestBulk', confirm }),
    })
    setBusy(false)
    if (!data.ok) {
      setError(errorText(String(data.error)))
      return
    }
    setNote(`Raus: ${data.sent ?? 0} von ${data.total ?? 0}.`)
    setConfirm('')
    onDone()
  }

  if (!missing) return null

  return (
    <form className="admin-card" onSubmit={(event) => void onSend(event)}>
      <h2>Portraitfotos anfordern</h2>
      <p className="admin-muted">
        {missing} Mitglied{missing === 1 ? '' : 'er'} ohne Portrait. Jede Person bekommt einen persönlichen Link und
        eine klare Erklärung, warum ein Gesichtsbild nötig ist.
      </p>
      <label>
        Bestätigung
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="foto-anfordern"
          autoComplete="off"
          disabled={busy}
        />
      </label>
      {error ? <p className="admin-error">{error}</p> : null}
      {note ? <p className="admin-muted">{note}</p> : null}
      {busy ? (
        <p className="admin-broadcast-loading" role="status">
          <span className="admin-spinner" aria-hidden="true" />
          Mails werden gesendet…
        </p>
      ) : null}
      <button
        className="btn btn-solid"
        type="submit"
        disabled={busy || confirm.trim() !== 'foto-anfordern'}
      >
        {busy ? 'Sendet…' : `Foto-Links an ${missing} senden`}
      </button>
    </form>
  )
}

function BroadcastMailer() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'active' | 'current' | 'all'>('active')
  const [plan, setPlan] = useState('')
  const [includeDaypass, setIncludeDaypass] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [preview, setPreview] = useState<{ total: number; sample: { name: string; email: string; plan: string }[] } | null>(
    null,
  )
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState<'test' | 'all' | null>(null)

  async function onPreview() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const { data } = await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'broadcastPreview', audience, plan, includeDaypass }),
      })
      if (!data.ok) {
        setError(errorText(String(data.error)))
        setPreview(null)
        return
      }
      setPreview({ total: data.total ?? 0, sample: data.sample ?? [] })
      setNote(`${data.total ?? 0} Empfänger mit diesem Filter.`)
    } finally {
      setBusy(false)
    }
  }

  async function onTest() {
    if (!testEmail.trim()) {
      setError('Für den Test eine E-Mail eintragen.')
      return
    }
    setBusy(true)
    setSending('test')
    setError(null)
    setNote(null)
    try {
      const { data } = await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'broadcastSend',
          subject,
          body,
          audience,
          plan,
          includeDaypass,
          testEmail: testEmail.trim(),
        }),
      })
      if (!data.ok) {
        setError(errorText(String(data.error)))
        return
      }
      setNote(`Testmail raus an ${testEmail.trim()}.`)
    } finally {
      setBusy(false)
      setSending(null)
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault()
    const total = preview?.total
    if (total == null) {
      setError('Zuerst Empfänger zählen.')
      return
    }
    if (
      !window.confirm(
        `Wirklich an ${total} Mitglied${total === 1 ? '' : 'er'} senden? Das geht nicht zurück.`,
      )
    ) {
      return
    }
    setBusy(true)
    setSending('all')
    setError(null)
    setNote(null)
    try {
      const { data } = await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'broadcastSend',
          subject,
          body,
          audience,
          plan,
          includeDaypass,
          confirm,
        }),
      })
      if (!data.ok) {
        setError(errorText(String(data.error)))
        return
      }
      setNote(`Raus: ${data.sent ?? 0} von ${data.total ?? 0}${data.failed ? ` · Fehler nach ${data.failed}` : ''}.`)
      setConfirm('')
    } finally {
      setBusy(false)
      setSending(null)
    }
  }

  return (
    <form className="admin-card" aria-busy={busy} onSubmit={(event) => void onSend(event)}>
      <h2>Rundmail an den Bestand</h2>
      <p className="admin-muted">
        Infos an Mitglieder. Jede Mail beginnt mit „Hi Vorname,“ und endet mit Konrad und Mehmet. Gekündigte und
        Widerrufe bekommen nichts.
      </p>
      <label>
        Betreff
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={140}
          required
          disabled={busy}
        />
      </label>
      <label>
        Text
        <textarea
          className="admin-broadcast-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          maxLength={8000}
          required
          disabled={busy}
          placeholder={'z. B.\n\nAm Montag entfällt die 18-Uhr-Einheit.\nStattdessen Open Mat ab 19 Uhr.'}
        />
      </label>
      <div className="admin-grid">
        <label>
          Empfänger
          <select
            value={audience}
            disabled={busy}
            onChange={(event) => {
              setAudience(event.target.value as 'active' | 'current' | 'all')
              setPreview(null)
            }}
          >
            <option value="active">Nur aktive</option>
            <option value="current">Aktiv + pausiert</option>
            <option value="all">Alle aktuellen (ohne Gekündigte)</option>
          </select>
        </label>
        <label>
          Tarif (optional)
          <select
            value={plan}
            disabled={busy}
            onChange={(event) => {
              setPlan(event.target.value)
              setPreview(null)
            }}
          >
            <option value="">Alle Tarife</option>
            <option value="slowstart">Slow Start Tarif</option>
            <option value="standard">Standard</option>
            <option value="flex">Flex</option>
            <option value="plus">Plus</option>
            <option value="first50">First 50</option>
            <option value="daypass">Day Pass</option>
          </select>
        </label>
      </div>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={includeDaypass}
          disabled={busy}
          onChange={(event) => {
            setIncludeDaypass(event.target.checked)
            setPreview(null)
          }}
        />
        Day-Pass-Gäste mitnehmen
      </label>
      <div className="admin-broadcast-actions">
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void onPreview()}>
          Empfänger zählen
        </button>
        {preview ? (
          <span className="admin-muted">
            {preview.total} Empfänger
            {preview.sample.length
              ? ` · z. B. ${preview.sample
                  .slice(0, 3)
                  .map((row) => row.name)
                  .join(', ')}`
              : ''}
          </span>
        ) : null}
      </div>
      <div className="admin-grid">
        <label>
          Test an eine Adresse
          <input
            type="email"
            value={testEmail}
            disabled={busy}
            onChange={(event) => setTestEmail(event.target.value)}
            placeholder="deine@mail.de"
          />
        </label>
        <div className="admin-broadcast-test">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={busy || !subject.trim() || !body.trim()}
            onClick={() => void onTest()}
          >
            {sending === 'test' ? (
              <>
                <span className="admin-spinner" aria-hidden="true" />
                Sendet Test…
              </>
            ) : (
              'Nur Test senden'
            )}
          </button>
        </div>
      </div>
      <label>
        Bestätigung für den Versand an alle
        <input
          value={confirm}
          disabled={busy}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="an-alle-mitglieder"
          autoComplete="off"
        />
      </label>
      {sending ? (
        <p className="admin-broadcast-loading" role="status" aria-live="polite">
          <span className="admin-spinner" aria-hidden="true" />
          {sending === 'test' ? 'Testmail wird gesendet…' : 'Mails werden gesendet… Bitte warten.'}
        </p>
      ) : null}
      {error ? <p className="admin-error">{error}</p> : null}
      {note ? <p className="admin-muted">{note}</p> : null}
      <button
        className="btn btn-solid"
        type="submit"
        disabled={busy || !subject.trim() || !body.trim() || confirm.trim() !== 'an-alle-mitglieder'}
      >
        {sending === 'all' ? (
          <>
            <span className="admin-spinner" aria-hidden="true" />
            Sendet…
          </>
        ) : (
          'An alle Empfänger senden'
        )}
      </button>
    </form>
  )
}

function First50Sender() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNote(null)
    const { data } = await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendFirst50', name, email }),
    })
    setBusy(false)
    if (!data.ok) {
      setError(errorText(data.error))
      return
    }
    setNote(`First-50-Link raus an ${data.email}. 89,99€, 48 Stunden, Name fest.`)
    setName('')
    setEmail('')
  }

  return (
    <form className="admin-card" onSubmit={(event) => void onSubmit(event)}>
      <h2>First-50-Link</h2>
      <p className="admin-muted">
        89,99€, 24 Monate. Name und E-Mail sind fest, der Link gilt 48 Stunden. Die Mail geht nur raus, wenn du hier auf
        Senden klickst.
      </p>
      <div className="admin-grid">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          E-Mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {note ? <p className="admin-muted">{note}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        Link senden
      </button>
    </form>
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
  const [payMethod, setPayMethod] = useState<'card' | 'transfer'>('card')
  const [signatures, setSignatures] = useState<DeskSignatures>({
    place: 'Leipzig',
    signature: '',
    gymSignature: '',
    guardianSignature: '',
    secondGuardianSignature: '',
    mandateSignature: '',
  })
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
    if (!photoData) {
      setError(errorText('photo'))
      return
    }
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
        payMethod: plan === 'daypass' ? 'card' : payMethod,
        place: signatures.place,
        signature: signatures.signature,
        gymSignature: signatures.gymSignature,
        secondGuardianSignature: signatures.secondGuardianSignature,
        bank:
          plan === 'daypass' || payMethod === 'transfer'
            ? undefined
            : { ...bank, mandateSignature: signatures.mandateSignature },
        guardian: minor ? { ...guardian, signature: signatures.guardianSignature } : undefined,
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
        {photoData ? <img src={photoData} alt="" /> : <span>Portraitfoto · Pflicht</span>}
        <input type="file" accept="image/*" capture="user" onChange={(event) => void onPhoto(event.target.files?.[0])} />
      </label>
      <p className="field-hint">Portrait mit klarem Gesicht. So erkennt ihr später, wer zum Training kommt.</p>
      <div className="admin-grid">
        <label>
          Tarif
          <select value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
            <option value="slowstart">Slow Start Tarif 12 Monate · 2×/Woche</option>
            <option value="standard">Standard 24 Monate</option>
            <option value="flex">Flex 12 Monate</option>
            <option value="plus">Plus 6 Monate</option>
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
          <h3>Zahlungsweise</h3>
          <fieldset className="pay-pick">
            <label className="check">
              <input
                type="radio"
                name="deskPay"
                checked={payMethod === 'card'}
                onChange={() => setPayMethod('card')}
              />
              <span>Karte oder Apple Pay</span>
            </label>
            <label className="check">
              <input
                type="radio"
                name="deskPay"
                checked={payMethod === 'transfer'}
                onChange={() => setPayMethod('transfer')}
              />
              <span>Banküberweisung, das Mitglied überweist selbst</span>
            </label>
          </fieldset>
          <p className="admin-muted">
            Banküberweisung ist möglich. SEPA-Lastschrift kommt später. Der Beitrag ist jeweils zum 1. des Monats fällig.
          </p>
          {payMethod === 'transfer' ? (
            <p>
              KONNI MMA GYM GbR
              <br />
              DE77 8605 5592 1090 4292 70 · WELADE8LXXX · Stadt- und Kreissparkasse Leipzig
              <br />
              <span className="admin-muted">Diese Kontodaten stehen im Vertrag.</span>
            </p>
          ) : (
            <>
              <h3>Kontodaten für Lastschrift</h3>
              <p className="admin-muted">
                {minor ? 'Bei unter 18 zahlt meist ein Elternteil: dann dessen Namen als Kontoinhaber. ' : ''}
                SEPA-Lastschrift kommt später. Die Kontodaten können jetzt schon erfasst werden, oder erst wenn das
                Mandat extra vereinbart wird. Nach dem Anlegen den Vertrag drucken und unterschreiben lassen.
              </p>
              <BankFields value={bank} onChange={setBank} holderHint={holderHint} />
            </>
          )}
        </section>
      ) : null}

      <section className="admin-block">
        <h3>Unterschriften auf dem Vertrag</h3>
        <p className="admin-muted">
          Diese Namen stehen auf den Unterschriftszeilen des Vertrags. Die Mail mit Vertrag und Daten geht dabei nicht
          raus. Die schickst du danach extra beim Mitglied.
        </p>
        <SignatureFields
          value={signatures}
          onChange={setSignatures}
          minor={minor}
          mandate={plan !== 'daypass' && payMethod === 'card' && Boolean(bank.iban) && bank.mandateSigned}
          required
        />
      </section>

      {error ? <p className="admin-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        Anlegen
      </button>
    </form>
  )
}
