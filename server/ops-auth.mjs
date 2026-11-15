import { timingSafeEqual } from 'node:crypto'

/** Timing-safe compare for Bearer / body secrets. */
export function secretsEqual(left, right) {
  const a = Buffer.from(String(left ?? ''))
  const b = Buffer.from(String(right ?? ''))
  if (!a.length || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Auth for outbound mail ops endpoints (/api/invite-mail, /api/opening-mail).
 * Never use INVITE_SECRET here — that key only signs invite links / photo tokens.
 */
export function opsMailSecret(env) {
  for (const key of ['MAIL_OPS_SECRET', 'CRON_SECRET', 'ADMIN_SECRET']) {
    const value = env?.[key]?.trim() || ''
    if (value.length >= 16) return value
  }
  return ''
}

export function opsMailAuthorized(provided, env) {
  const secret = opsMailSecret(env)
  if (!secret) return false
  return secretsEqual(provided, secret)
}
