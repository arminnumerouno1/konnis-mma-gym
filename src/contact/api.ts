export async function submitTrial(input: {
  name: string
  email: string
  phone: string
  interest: string
  note: string
  company?: string
}): Promise<{ ok: true } | { ok: false; error: 'invalid' | 'rate' | 'upstream' | 'network' }> {
  try {
    const response = await fetch('/api/kontakt', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(input),
    })
    const data = (await response.json()) as { ok?: boolean; error?: string }
    if (response.status === 429) return { ok: false, error: 'rate' }
    if (data.ok) return { ok: true }
    if (data.error === 'upstream') return { ok: false, error: 'upstream' }
    return { ok: false, error: 'invalid' }
  } catch {
    return { ok: false, error: 'network' }
  }
}
