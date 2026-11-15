import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openingMailHtml, openingMailSubject } from '../server/opening-mail.mjs'
import { isValidEmail, normalizeEmail } from '../server/membership.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const envPath = resolve(root, '.env')

function loadEnvFile() {
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return 'true'
  return next
}

function firstNameOf(name) {
  const parts = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  return parts[0] || ''
}

function loadList() {
  const file = resolve(root, 'data/first50-invites.json')
  if (!existsSync(file)) {
    throw new Error('data/first50-invites.json fehlt. Erst Voranmeldung importieren.')
  }
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const rows = [...(data.invites ?? []), ...(data.waitlist ?? [])]
  const seen = new Set()
  const people = []
  for (const row of rows) {
    const email = normalizeEmail(row.email)
    if (!isValidEmail(email) || seen.has(email)) continue
    seen.add(email)
    people.push({ email, name: String(row.name ?? '').replace(/\s+/g, ' ').trim(), first: firstNameOf(row.name) })
  }
  return people
}

async function sendOne({ apiKey, sender, to, name, first, test }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'KONNI MMA GYM', email: sender },
      to: [{ email: to, name: name || to }],
      replyTo: { email: sender, name: 'KONNI MMA GYM' },
      subject: openingMailSubject({ test }),
      htmlContent: openingMailHtml({ first }),
      tags: test ? ['opening-announce-test'] : ['opening-announce'],
    }),
  })
  const detail = await response.text()
  if (!response.ok) throw new Error(`brevo_${response.status}:${detail.slice(0, 240)}`)
}

async function sendViaApi({ origin, secret, to, name, test }) {
  const response = await fetch(`${origin}/api/opening-mail`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ secret, email: to, name, test }),
  })
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!response.ok || !data.ok) {
    throw new Error(`api_${response.status}:${String(data.error || text).slice(0, 240)}`)
  }
}

loadEnvFile()

if (process.argv.includes('--help') || process.argv.length <= 2) {
  console.log(`Eröffnungsmail an die Voranmeldung

  node scripts/send-opening-mail.mjs --test armin.scholtz@gmail.com [--name "Armin Scholtz"]
  node scripts/send-opening-mail.mjs --all --confirm-all

Ohne --confirm-all geht kein Massenversand.
`)
  process.exit(0)
}

const apiKey = process.env.BREVO_API_KEY?.trim()
const secret = process.env.INVITE_SECRET?.trim()
const sender = process.env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
const origin = String(process.env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
const site = origin.includes('mma-in-leipzig.de') ? 'https://www.mma-in-leipzig.de' : origin
const testTo = arg('test')
const wantAll = process.argv.includes('--all')
const confirmAll = process.argv.includes('--confirm-all')

async function deliver({ to, name, first, test }) {
  if (apiKey) {
    await sendOne({ apiKey, sender, to, name, first, test })
    return
  }
  if (!secret) {
    console.error('Weder BREVO_API_KEY noch INVITE_SECRET. Test geht über die Live-API mit INVITE_SECRET.')
    process.exit(1)
  }
  await sendViaApi({ origin: site, secret, to, name, test })
}

function loadSent() {
  const file = resolve(root, 'data/opening-mail-sent.json')
  if (!existsSync(file)) return { file, emails: new Set() }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    return { file, emails: new Set(Array.isArray(data.emails) ? data.emails : []) }
  } catch {
    return { file, emails: new Set() }
  }
}

function saveSent(file, emails) {
  writeFileSync(file, `${JSON.stringify({ emails: [...emails], at: new Date().toISOString() }, null, 2)}\n`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function deliverWithRetry(person) {
  let last = null
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await deliver({ to: person.email, name: person.name, first: person.first, test: false })
      return
    } catch (error) {
      last = error
      const msg = String(error?.message ?? error)
      if (!/api_429|api_502|rate|upstream/i.test(msg) && attempt > 2) throw error
      await sleep(Math.min(8000, 700 * attempt))
    }
  }
  throw last ?? new Error('retry')
}

if (testTo && testTo !== 'true') {
  const email = normalizeEmail(testTo)
  if (!isValidEmail(email)) {
    console.error('Ungültige Test-Adresse.')
    process.exit(1)
  }
  const name = arg('name', 'Armin Scholtz')
  await deliver({ to: email, name, first: firstNameOf(name), test: true })
  console.log(`Testmail raus an ${email}. Kein Massenversand.`)
  process.exit(0)
}

if (wantAll) {
  if (!confirmAll) {
    console.error('Massenversand nur mit --all --confirm-all')
    process.exit(1)
  }
  const people = loadList()
  const sentLog = loadSent()
  const pending = people.filter((person) => !sentLog.emails.has(person.email))
  console.log(
    `Versand an ${pending.length} Adressen (${people.length - pending.length} schon raus). First-50-Links sind nicht in dieser Mail.`,
  )
  let sent = 0
  let failed = 0
  for (const person of pending) {
    try {
      await deliverWithRetry(person)
      sentLog.emails.add(person.email)
      saveSent(sentLog.file, sentLog.emails)
      sent += 1
      process.stdout.write(`Mail ${sent}/${pending.length}   \r`)
    } catch (error) {
      failed += 1
      console.error(`\nFehler ${failed}: ${String(error?.message ?? error).slice(0, 120)}`)
    }
    await sleep(350)
  }
  console.log(`Mails raus: ${sent}. Fehler: ${failed}. Gesamt auf der Liste: ${people.length}.`)
  process.exit(failed ? 1 : 0)
}

console.error('Bitte --test ADRESSE oder --all --confirm-all angeben.')
process.exit(1)
