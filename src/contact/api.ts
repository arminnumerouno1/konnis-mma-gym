export async function submitTrial(input: {
  name: string
  email: string
  phone: string
  birthDate: string
  slotId: string
  note: string
  guardianName?: string
  guardianRelation?: string
  guardianEmail?: string
  guardianPhone?: string
  guardianConsent?: boolean
  company?: string
  formStarted?: number
}): Promise<
  | { ok: true; minor?: boolean }
  | {
      ok: false
      error: 'invalid' | 'birth' | 'guardian' | 'slot' | 'duplicate' | 'rate' | 'closed' | 'upstream' | 'network'
    }
> {
  try {
    const response = await fetch('/api/kontakt', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(input),
    })
    const data = (await response.json()) as { ok?: boolean; error?: string }
    if (response.status === 429) return { ok: false, error: 'rate' }
    if (data.error === 'closed' || response.status === 403) return { ok: false, error: 'closed' }
    if (data.ok) return { ok: true, minor: Boolean((data as { minor?: boolean }).minor) }
    if (data.error === 'upstream') return { ok: false, error: 'upstream' }
    if (data.error === 'duplicate' || response.status === 409) return { ok: false, error: 'duplicate' }
    if (data.error === 'slot') return { ok: false, error: 'slot' }
    if (data.error === 'birth') return { ok: false, error: 'birth' }
    if (data.error === 'guardian') return { ok: false, error: 'guardian' }
    return { ok: false, error: 'invalid' }
  } catch {
    return { ok: false, error: 'network' }
  }
}
