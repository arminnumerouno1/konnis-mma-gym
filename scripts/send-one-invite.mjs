import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { normalizePersonName } from '../server/invite.mjs'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return ''
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return ''
  return next
}

const email = normalizeEmail(arg('email'))
const name = normalizePersonName(arg('name'))
const slot = Number(arg('slot'))
const proof = process.env.SIGNUP_MAIL_PROOF?.trim()

if (!proof || !isValidEmail(email) || name.length < 3 || !Number.isInteger(slot) || slot < 1 || slot > 50) {
  console.error('Bitte --email, --name und --slot 1–50. Es geht nur eine Mail raus.')
  process.exit(1)
}

const response = await fetch('https://www.mma-in-leipzig.de/api/invite-mail', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ one: true, proof, email, name, slot }),
})
const text = await response.text()
let data = {}
try {
  data = text ? JSON.parse(text) : {}
} catch {
  data = {}
}
if (!response.ok || !data.ok) {
  console.error(`Link nicht raus (${response.status}, ${String(data.error || 'fehler')}).`)
  process.exit(1)
}
console.log(`First-50-Link raus an ${data.email}, Platz ${data.slot}.`)
