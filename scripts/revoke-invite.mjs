import { isValidEmail, normalizeEmail } from '../server/membership.mjs'

const arg = (name) => {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : ''
}

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
const email = normalizeEmail(arg('email') || process.env.EMAIL || '')
const slot = Number(arg('slot') || process.env.SLOT || '')
const reason = arg('reason') || process.env.REASON || 'desk'
const site = String(process.env.SITE_URL || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')

if (!proof || !isValidEmail(email) || !Number.isInteger(slot) || slot < 1) {
  console.error('Usage: SIGNUP_MAIL_PROOF=… node scripts/revoke-invite.mjs --email=… --slot=…')
  process.exit(1)
}

const response = await fetch(`${site}/api/admin`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ action: 'revokeInvite', proof, email, slot, reason }),
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
