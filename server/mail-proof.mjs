import { timingSafeEqual } from 'node:crypto'

/** Minimum entropy for the ops mail proof. Shorter values are treated as unset. */
export const MAIL_PROOF_MIN = 24

export function mailProofOf(env) {
  const value = String(env?.SIGNUP_MAIL_PROOF ?? '').trim()
  return value.length >= MAIL_PROOF_MIN ? value : ''
}

export function mailProofMatches(offered, env) {
  const expected = mailProofOf(env)
  const left = Buffer.from(String(offered ?? ''))
  const right = Buffer.from(expected)
  if (!expected || !left.length || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
