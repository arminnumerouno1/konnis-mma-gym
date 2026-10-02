import type { PlanId } from '../brand/plans'

export type MembershipError =
  | 'plan'
  | 'first50'
  | 'invite'
  | 'expired'
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
  | 'closed'
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
  invite?: string
  company?: string
}

export type MembershipOk = {
  ok: true
  confirmation: 'saved' | 'listed'
  id?: string
  remainingFirst50: number
  payment?: 'checkout' | 'later' | 'unlinked'
  checkoutUrl?: string
  billingStart?: string
}

export type MembershipFail = { ok: false; error: MembershipError }

export type InviteLookup =
  | { ok: true; invite: { email: string; name: string; slot: number; plan: 'first50'; price: number } }
  | { ok: false; error: MembershipError }

export async function lookupInvite(token: string): Promise<InviteLookup> {
  try {
    const response = await fetch(`/api/mitglied?invite=${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' },
    })
    const data = (await response.json()) as InviteLookup
    if (data && data.ok === false) return data
    if (data && data.ok) return data
    return { ok: false, error: 'invite' }
  } catch {
    return { ok: false, error: 'network' }
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
