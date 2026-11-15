import { normalizeEmail } from '../server/membership.mjs'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return ''
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return ''
  return next
}

const email = normalizeEmail(arg('email'))
const proof = process.env.SIGNUP_MAIL_PROOF?.trim()

if (!proof || !email) {
  console.error('Bitte --email. Es geht nur eine Vertragsmail raus.')
  process.exit(1)
}

const response = await fetch('https://www.mma-in-leipzig.de/api/admin', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ action: 'sendPaperReturn', proof, email }),
})
const text = await response.text()
let data = {}
try {
  data = text ? JSON.parse(text) : {}
} catch {
  data = {}
}
if (!response.ok || !data.ok) {
  console.error(`Vertragsmail nicht raus (${response.status}, ${String(data.error || 'fehler')}).`)
  process.exit(1)
}
console.log(`Vertragsmail raus, Beitrag ${data.price}.`)
