import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { normalizePersonName } from '../server/invite.mjs'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return ''
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return ''
  return next
}

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
const email = normalizeEmail(arg('email'))
const name = normalizePersonName(arg('name'))

if (!proof || !isValidEmail(email) || name.length < 3) {
  console.error('Bitte --email und --name. Es geht nur eine Last-Chance-Mail raus.')
  process.exit(1)
}

const response = await fetch('https://www.mma-in-leipzig.de/api/admin', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ action: 'sendFirst50', proof, email, name, lastChance: true }),
})
const text = await response.text()
let data = {}
try {
  data = text ? JSON.parse(text) : {}
} catch {
  data = {}
}
if (!response.ok || !data.ok) {
  console.error(`Last-Chance-Link nicht raus (${response.status}, ${String(data.error || 'fehler')}).`)
  process.exit(1)
}
console.log(`Last-Chance-Link raus, Platz ${data.slot}.`)
