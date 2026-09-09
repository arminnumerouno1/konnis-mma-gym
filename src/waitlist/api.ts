export type WaitlistConfirmation = 'saved' | 'email' | 'listed' | 'duplicate'

export type WaitlistResult =
  | { ok: true; confirmation: WaitlistConfirmation }
  | { ok: false; error: 'email' | 'consent' | 'rate' | 'upstream' | 'network' | 'invalid' }

export async function submitWaitlist(input: {
  email: string
  name: string
  consent: boolean
  company?: string
}): Promise<WaitlistResult> {
  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        email: input.email,
        name: input.name,
        consent: input.consent,
        company: input.company ?? '',
      }),
    })
    const data = (await response.json()) as WaitlistResult
    if (!response.ok && data && data.ok === false) return data
    if (data && data.ok) return data
    return { ok: false, error: 'invalid' }
  } catch {
    return { ok: false, error: 'network' }
  }
}
