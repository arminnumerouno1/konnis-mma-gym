import type { PlanId } from '../brand/plans'

export type MembershipError =
  | 'plan'
  | 'first50'
  | 'name'
  | 'birth'
  | 'address'
  | 'email'
  | 'phone'
  | 'guardian'
  | 'consent'
  | 'place'
  | 'signature'
  | 'visit'
  | 'rate'
  | 'upstream'
  | 'network'
  | 'invalid'

export type MembershipConsents = {
  agb: boolean
  hausordnung: boolean
  widerruf: boolean
  privacy: boolean
  health: boolean
  sign: boolean
  earlyStart: boolean
  photos: boolean
  newsletter: boolean
}

export type MembershipInput = {
  plan: PlanId
  firstName: string
  lastName: string
  birthDate: string
  street: string
  zip: string
  city: string
  email: string
  phone: string
  place: string
  signature: string
  visitDay?: string
  guardianName?: string
  guardianEmail?: string
  guardianPhone?: string
  guardianConsent?: boolean
  consents: MembershipConsents
  company?: string
}

export type MembershipOk = {
  ok: true
  confirmation: 'saved' | 'listed'
  id?: string
  remainingFirst50: number
}

export type MembershipFail = { ok: false; error: MembershipError }

export async function fetchFirst50(): Promise<{ remainingFirst50: number; first50Taken: number }> {
  try {
    const response = await fetch('/api/mitglied', { headers: { accept: 'application/json' } })
    const data = (await response.json()) as { remainingFirst50?: number; first50Taken?: number }
    return {
      remainingFirst50: Number(data.remainingFirst50 ?? 50),
      first50Taken: Number(data.first50Taken ?? 0),
    }
  } catch {
    return { remainingFirst50: 50, first50Taken: 0 }
  }
}

export async function submitMembership(input: MembershipInput): Promise<MembershipOk | MembershipFail> {
  try {
    const response = await fetch('/api/mitglied', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(input),
    })
    const text = await response.text()
    let data: MembershipOk | MembershipFail | null = null
    try {
      data = text ? (JSON.parse(text) as MembershipOk | MembershipFail) : null
    } catch {
      return { ok: false, error: 'network' }
    }
    if (data && data.ok === false) return data
    if (data && data.ok) return data
    return { ok: false, error: 'invalid' }
  } catch {
    return { ok: false, error: 'network' }
  }
}
