import { isValidEmail, normalizeEmail } from '../server/membership.mjs'
import { SIGNUP_OPEN_CONFIRM, SIGNUP_OPEN_TEST_TO, signupOpenMailSubject } from '../server/signup-open-mail.mjs'

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return 'true'
  return next
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const origin = 'https://www.mma-in-leipzig.de'
const wantAll = process.argv.includes('--all')
const confirmAll = process.argv.includes('--confirm-all')
const wantCount = process.argv.includes('--count')

if (process.argv.includes('--help') || process.argv.length <= 2) {
  console.log(`Mail an alle außerhalb der First 50.

  node scripts/send-signup-open-mail.mjs --test ${SIGNUP_OPEN_TEST_TO} [--name "Armin Scholtz"]
  node scripts/send-signup-open-mail.mjs --count
  node scripts/send-signup-open-mail.mjs --all --confirm-all

Ohne --confirm-all geht kein Massenversand. First 50 bleiben draußen.
`)
  process.exit(0)
}

const proof = process.env.SIGNUP_MAIL_PROOF?.trim()
if (!proof) {
  console.error('SIGNUP_MAIL_PROOF fehlt.')
  process.exit(1)
}

async function post(body) {
  const response = await fetch(`${origin}/api/signup-open-mail`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ proof, ...body }),
  })
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = {}
  }
  return { status: response.status, data }
}

if (wantCount || wantAll) {
  if (wantAll && !confirmAll) {
    console.error('Massenversand nur mit --all --confirm-all')
    process.exit(1)
  }
  const preview = await post({ count: true })
  if (!preview.data.ok) {
    console.error(`Liste nicht lesbar (${preview.status}, ${String(preview.data.error || 'fehler')}). Nichts verschickt.`)
    process.exit(1)
  }
  console.log(`Außerhalb der First 50: ${preview.data.outside}. Davon noch offen: ${preview.data.pending}. Schon raus: ${preview.data.already}.`)
  if (!wantAll) process.exit(0)
  if (!preview.data.outside) {
    console.error('Niemand außerhalb der First 50. Nichts verschickt.')
    process.exit(1)
  }

  let sent = 0
  let stalled = 0
  for (;;) {
    const batch = await post({ all: true, confirm: SIGNUP_OPEN_CONFIRM, limit: 12 })
    const row = batch.data
    sent += Number(row.sent) || 0
    const remaining = Number(row.remaining)
    console.log(`Raus in diesem Schwung: ${Number(row.sent) || 0}. Übrig: ${Number.isFinite(remaining) ? remaining : '?'}.`)
    if (row.ok && remaining === 0) break
    if ((Number(row.sent) || 0) > 0 && remaining === 0) break
    if (!row.ok && (Number(row.sent) || 0) === 0) {
      stalled += 1
      if (stalled >= 6) {
        console.error(`Versand gestoppt (${batch.status}, ${String(row.error || 'fehler')}). Schon raus: ${sent}.`)
        process.exit(1)
      }
      await sleep(8000)
      continue
    }
    stalled = 0
    if (!Number.isFinite(remaining)) {
      console.error(`Antwort ohne Restzahl (${batch.status}). Schon raus: ${sent}.`)
      process.exit(1)
    }
  }
  console.log(`Fertig. Mails raus: ${sent}. First 50 nicht angeschrieben.`)
  process.exit(0)
}

const testTo = arg('test')
if (!testTo || testTo === 'true') {
  console.error(`Bitte --test ${SIGNUP_OPEN_TEST_TO}, --count oder --all --confirm-all`)
  process.exit(1)
}

const email = normalizeEmail(testTo)
if (email !== SIGNUP_OPEN_TEST_TO || !isValidEmail(email)) {
  console.error(`Die Testmail geht nur an ${SIGNUP_OPEN_TEST_TO}.`)
  process.exit(1)
}

const name = arg('name', 'Armin Scholtz')
const response = await post({ email, name, test: true })
if (!response.data.ok) {
  console.error(`Testmail nicht raus (${response.status}, ${String(response.data.error || 'fehler')}).`)
  process.exit(1)
}
console.log(`Testmail raus an ${email}. Betreff: ${signupOpenMailSubject({ test: true })}. Kein Massenversand.`)
