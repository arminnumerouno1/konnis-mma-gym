import { randomInt } from 'node:crypto'

/** Alphabet without 0/O/1/I/L for easy door typing. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function normalizeCheckinCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
}

export function isValidCheckinCode(value) {
  const code = normalizeCheckinCode(value)
  return code.length === 6 && /^[A-Z0-9]{6}$/.test(code)
}

export function generateCheckinCode(existing = new Set()) {
  const taken = existing instanceof Set ? existing : new Set(existing)
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let code = ''
    for (let i = 0; i < 6; i += 1) code += ALPHABET[randomInt(ALPHABET.length)]
    if (!taken.has(code)) return code
  }
  throw new Error('checkin_code_exhausted')
}

export function collectCheckinCodes(members = [], trials = []) {
  const taken = new Set()
  for (const row of members) {
    const code = normalizeCheckinCode(row?.checkinCode)
    if (code) taken.add(code)
  }
  for (const row of trials) {
    const code = normalizeCheckinCode(row?.checkinCode)
    if (code) taken.add(code)
  }
  return taken
}

export function ensureCheckinCode(row, taken) {
  const current = normalizeCheckinCode(row?.checkinCode)
  if (current && isValidCheckinCode(current)) {
    taken.add(current)
    return { ...row, checkinCode: current }
  }
  const code = generateCheckinCode(taken)
  taken.add(code)
  return { ...row, checkinCode: code }
}
