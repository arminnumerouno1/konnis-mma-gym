export type CancelKind = 'ordentlich' | 'ausserordentlich' | 'widerruf' | 'umzug'

export type CancelPayload = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  memberId?: string
  kind: CancelKind
  note?: string
  confirm: true
  company?: string
}

export type CancelError = 'name' | 'email' | 'kind' | 'confirm' | 'rate' | 'invalid' | 'upstream' | 'network'

export type CancelOk = {
  ok: true
  id: string
  kindLabel: string
  suggestedEnd?: string | null
  receivedAt: string
}

export async function submitCancellation(payload: CancelPayload): Promise<CancelOk | { ok: false; error: CancelError }> {
  try {
    const response = await fetch('/api/kuendigen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      error?: CancelError
      id?: string
      kindLabel?: string
      suggestedEnd?: string | null
      receivedAt?: string
    }
    if (!response.ok || !data.ok) {
      if (response.status === 429) return { ok: false, error: 'rate' }
      return { ok: false, error: data.error || 'upstream' }
    }
    return {
      ok: true,
      id: data.id || '',
      kindLabel: data.kindLabel || '',
      suggestedEnd: data.suggestedEnd,
      receivedAt: data.receivedAt || new Date().toISOString(),
    }
  } catch {
    return { ok: false, error: 'network' }
  }
}
