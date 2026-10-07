import { normalizePersonName } from '../server/invite.mjs'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return ''
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return ''
  return next
}

const name = normalizePersonName(arg('name'))
const proof = process.env.SIGNUP_MAIL_PROOF?.trim()

if (!proof || name.length < 3) {
  console.error('Bitte --name. Es geht nur ein Zahlungslink raus.')
  process.exit(1)
}

const response = await fetch('https://www.mma-in-leipzig.de/api/admin', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ action: 'sendPayLink', proof, name }),
})
const text = await response.text()
let data = {}
try {
  data = text ? JSON.parse(text) : {}
} catch {
  data = {}
}
if (!response.ok || !data.ok) {
  console.error(`Zahlungslink nicht raus (${response.status}, ${String(data.error || 'fehler')}).`)
  process.exit(1)
}
console.log(`Zahlungslink raus an ${data.email}.`)
