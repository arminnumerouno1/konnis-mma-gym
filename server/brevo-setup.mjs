import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

function upsertEnv(key, value) {
  const block = `${key}=${value}`
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `${block}\n`, 'utf8')
    return
  }
  const text = readFileSync(envPath, 'utf8')
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(text)) {
    writeFileSync(envPath, text.replace(pattern, block), 'utf8')
    return
  }
  const suffix = text.endsWith('\n') ? '' : '\n'
  writeFileSync(envPath, `${text}${suffix}${block}\n`, 'utf8')
}

loadEnvFile()

const apiKey = process.env.BREVO_API_KEY?.trim()
if (!apiKey) {
  console.error(`Kein BREVO_API_KEY.

1. Kostenloses Konto: https://app.brevo.com/account/register
   Am besten mit info@mma-in-leipzig.de anlegen und die Mail bestätigen.
2. Danach: https://app.brevo.com/settings/keys/api
   „API-Schlüssel erzeugen“, Namen KONNI MMA GYM geben, Schlüssel kopieren.
3. Hier im Chat nur den Schlüssel schicken (nicht das Passwort).
   Dann lege ich Liste und Anschluss an.
`)
  process.exit(1)
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function brevo(path, init = {}) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: {
      'api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!response.ok) {
    const err = new Error(`${response.status} ${path}: ${text.slice(0, 400)}`)
    err.status = response.status
    err.body = data
    throw err
  }
  return data
}

const LIST_NAME = 'KONNI MMA GYM Warteliste'

const account = await brevo('/account')
console.log(`Konto: ${account.email}${account.companyName ? ` (${account.companyName})` : ''}`)

const folders = await brevo('/contacts/folders?limit=50')
const folderId = folders.folders?.[0]?.id
if (!folderId) {
  throw new Error('Kein Kontakte-Ordner in Brevo. Einmal im Dashboard Kontakte öffnen, dann dieses Skript erneut.')
}

const lists = await brevo('/contacts/lists?limit=50&offset=0')
let list = lists.lists?.find((entry) => entry.name === LIST_NAME)
if (!list) {
  const created = await brevo('/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ name: LIST_NAME, folderId }),
  })
  list = { id: created.id, name: LIST_NAME }
  console.log(`Liste angelegt: ${list.name} (#${list.id})`)
} else {
  console.log(`Liste vorhanden: ${list.name} (#${list.id})`)
}

for (const name of ['VORNAME', 'SOURCE']) {
  try {
    await brevo(`/contacts/attributes/normal/${name}`, {
      method: 'POST',
      body: JSON.stringify({ type: 'text' }),
    })
    console.log(`Attribut ${name} angelegt`)
  } catch (error) {
    if (error.status === 400) console.log(`Attribut ${name} war schon da`)
    else throw error
  }
}

upsertEnv('BREVO_LIST_ID', String(list.id))
if (!process.env.VITE_SITE_URL) {
  upsertEnv('VITE_SITE_URL', 'https://mma-in-leipzig.de')
}
upsertEnv('BREVO_DOI_REDIRECT_URL', 'https://mma-in-leipzig.de/?liste=bestaetigt')

console.log(`
Fertig. BREVO_LIST_ID=${list.id} steht in .env (nicht im Git).

Als Nächstes in Brevo, wenn ihr Mails wirklich rausschicken wollt:
- Absender info@mma-in-leipzig.de bestätigen
- Optional Double-Opt-in-Template, dann BREVO_DOI_TEMPLATE_ID setzen
- Kampagnen an die Liste „${LIST_NAME}“

Dev-Server danach neu starten, damit der Schlüssel geladen wird.
`)
