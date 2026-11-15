import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { normalizePersonName } from '../server/invite.mjs'

const arg = (name) => {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : ''
}

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
const name = normalizePersonName(arg('name') || process.env.NAME || '')
const emailRaw = arg('email') || process.env.EMAIL || ''
const email = emailRaw ? normalizeEmail(emailRaw) : ''
const note = arg('note') || process.env.NOTE || ''
const site = String(process.env.SITE_URL || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')

if (!proof || (name.length < 3 && !(email && isValidEmail(email)))) {
  console.error('Usage: SIGNUP_MAIL_PROOF=… node scripts/mark-cancelled.mjs --name="Vor Nach" [--email=…]')
  process.exit(1)
}

const response = await fetch(`${site}/api/admin`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    action: 'markCancelled',
    proof,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(note ? { note } : {}),
  }),
})
const text = await response.text()
let data = null
try {
  data = text ? JSON.parse(text) : null
} catch {
  data = { raw: text }
}
console.log(JSON.stringify({ status: response.status, data }, null, 2))
if (!response.ok || !data?.ok) process.exit(1)
