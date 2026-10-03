import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { SIGNUP_OPEN_TEST_TO, signupOpenMailSubject } from '../server/signup-open-mail.mjs'

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return 'true'
  return next
}

const origin = 'https://www.mma-in-leipzig.de'

if (process.argv.includes('--help') || process.argv.length <= 2) {
  console.log(`Mail an alle außerhalb der First 50. Massenversand ist noch zu.

  node scripts/send-signup-open-mail.mjs --test ${SIGNUP_OPEN_TEST_TO} [--name "Armin Scholtz"]

Erst nach Freigabe geht die Mail an die Liste.
`)
  process.exit(0)
}

if (process.argv.includes('--all') || process.argv.includes('--confirm-all')) {
  console.error('Massenversand ist noch zu. Erst die Testmail, dann die Freigabe.')
  process.exit(1)
}

const testTo = arg('test')
if (!testTo || testTo === 'true') {
  console.error(`Bitte --test ${SIGNUP_OPEN_TEST_TO}`)
  process.exit(1)
}

const email = normalizeEmail(testTo)
if (email !== SIGNUP_OPEN_TEST_TO || !isValidEmail(email)) {
  console.error(`Die Testmail geht nur an ${SIGNUP_OPEN_TEST_TO}.`)
  process.exit(1)
}

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
if (!proof) {
  console.error('SIGNUP_MAIL_PROOF fehlt.')
  process.exit(1)
}

const name = arg('name', 'Armin Scholtz')
const response = await fetch(`${origin}/api/signup-open-mail`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ proof, email, name, test: true }),
})
const text = await response.text()
let data = {}
try {
  data = text ? JSON.parse(text) : {}
} catch {
  data = {}
}
if (!response.ok || !data.ok) {
  console.error(`Testmail nicht raus (${response.status}, ${String(data.error || 'fehler')}).`)
  process.exit(1)
}
console.log(`Testmail raus an ${email}. Betreff: ${signupOpenMailSubject({ test: true })}. Kein Massenversand.`)
