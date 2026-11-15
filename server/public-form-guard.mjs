/** Shared anti-abuse helpers for unauthenticated public forms. */

export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

/** Sliding-window rate limiter keyed by IP, email, etc. */
export function createKeyedRateLimiter({ windowMs, max }) {
  const hits = new Map()
  return function limited(key) {
    const id = String(key || 'unknown')
    const now = Date.now()
    const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      hits.set(id, recent)
      return true
    }
    recent.push(now)
    hits.set(id, recent)
    return false
  }
}

/** Classic bot trap: hidden "company" field filled by autofill scripts. */
export function isHoneypot(body) {
  return typeof body?.company === 'string' && body.company.trim().length > 0
}

/**
 * Reject instant bot posts. Clients send formStarted as epoch ms (when the form mounted).
 * Missing/invalid timestamps count as too fast.
 */
export function isTooFast(body, minMs = 2500, nowMs = Date.now()) {
  const started = Number(body?.formStarted)
  if (!Number.isFinite(started) || started <= 0) return true
  const age = nowMs - started
  if (age < minMs) return true
  // Reject absurd future clocks / replayed ancient tokens (> 24h).
  if (age > 24 * 60 * 60 * 1000) return true
  return false
}

/**
 * @returns {'honey' | 'fast' | null}
 * honey/fast should look like success to bots (no useful signal).
 */
export function publicFormTrap(body, { minMs = 2500, nowMs = Date.now() } = {}) {
  if (isHoneypot(body)) return 'honey'
  if (isTooFast(body, minMs, nowMs)) return 'fast'
  return null
}
