import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { contractStart, normalizePersonName } from '../server/invite.mjs'

const arg = (name) => {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : ''
}

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
const email = normalizeEmail(arg('email') || process.env.EMAIL || '')
const name = normalizePersonName(arg('name') || process.env.NAME || '')
const start = contractStart(arg('start') || process.env.START || '')
const site = String(process.env.SITE_URL || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')

if (!proof || !isValidEmail(email) || name.length < 3 || !start) {
  console.error('Usage: SIGNUP_MAIL_PROOF=… node scripts/send-plus-invite.mjs --email=… --name=… --start=YYYY-MM-01')
  process.exit(1)
}

const response = await fetch(`${site}/api/admin`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    action: 'sendPlusInvite',
    proof,
    email,
    name,
    start,
    openUntilSignup: process.argv.includes('--open-until-signup'),
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
