import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { normalizePersonName } from '../server/invite.mjs'

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
if (!proof || proof.length < 16) {
  console.error('SIGNUP_MAIL_PROOF fehlt.')
  process.exit(1)
}

const people = [
  { name: 'Beshann Ahmadi', email: 'beshann.ahmadi38@gmail.com' },
  { name: 'Florian Walther', email: 'f.walther@mars-holding.com' },
  { name: 'Hannes Beckhof', email: 'hannob08@gmail.com' },
  { name: 'Julius Beck', email: 'julius-beck@gmx.net' },
  { name: 'Kevin Müller', email: 'muellerkevin237@gmail.com' },
  { name: 'Lauritz Musch', email: 'muschlauritz@gmail.com' },
  { name: 'Marvin Pannasch', email: 'pannaschmarvin@gmail.com' },
  { name: 'Roger Müller', email: 'roger_mueller_87@gmx.de' },
  { name: 'Roger Müller', email: 'roger.mueller@ap-arbeitspartner.de' },
  { name: 'Tarek Razek', email: 'tarek.razek@t-online.de' },
  { name: 'Ugur Ata', email: 'ugur.ata62@gmail.com' },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const results = []
for (const person of people) {
  const email = normalizeEmail(person.email)
  const name = normalizePersonName(person.name)
  if (!isValidEmail(email) || name.length < 3) {
    results.push({ email, name, ok: false, error: 'invalid' })
    continue
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
  results.push({
    email,
    name,
    ok: Boolean(response.ok && data.ok),
    status: response.status,
    error: data.error || null,
    slot: data.slot || null,
  })
  console.log(
    data.ok
      ? `ok ${email} slot ${data.slot}`
      : `fail ${email} ${response.status} ${data.error || 'fehler'}`,
  )
  await sleep(400)
}

const sent = results.filter((row) => row.ok).length
const failed = results.filter((row) => !row.ok)
console.log(`done sent=${sent} failed=${failed.length}`)
if (failed.length) {
  for (const row of failed) console.error(`fail ${row.email} ${row.error || row.status}`)
  process.exit(1)
}
