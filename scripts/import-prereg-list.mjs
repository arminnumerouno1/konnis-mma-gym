import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isValidEmail, normalizeEmail } from '../server/membership.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return 'true'
  return next
}

function envValue(key) {
  if (process.env[key]) return process.env[key]
  const file = resolve(root, '.env')
  if (!existsSync(file)) return ''
  const hit = readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
  return hit ? hit[1].trim().replace(/^["']|["']$/g, '') : ''
}

function readCells(path) {
  const py = `
import json, re, sys, zipfile, xml.etree.ElementTree as ET
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(sys.argv[1]) as z:
    ss = ET.fromstring(z.read('xl/sharedStrings.xml'))
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
strings = [''.join(t.text or '' for t in si.findall('.//m:t', ns)) for si in ss.findall('m:si', ns)]
rows = []
for row in sheet.findall('m:sheetData/m:row', ns):
    cells = {}
    for c in row.findall('m:c', ns):
        v = c.find('m:v', ns)
        t = c.get('t')
        if t == 's' and v is not None:
            val = strings[int(v.text)]
        elif t == 'inlineStr':
            val = ''.join(x.text or '' for x in c.findall('.//m:t', ns))
        else:
            val = v.text if v is not None else ''
        cells[re.sub(r'\\d', '', c.get('r'))] = str(val).strip()
    rows.append({'row': int(row.get('r')), 'cells': cells})
print(json.dumps(rows, ensure_ascii=False))
`
  return JSON.parse(execFileSync('python3', ['-c', py, path], { encoding: 'utf8', maxBuffer: 10_000_000 }))
}

function findColumns(rows) {
  for (const { row, cells } of rows) {
    const cols = {}
    for (const [col, value] of Object.entries(cells)) {
      const key = value.toLowerCase().replace(/[:\s]+$/, '')
      if (key === 'name') cols.name = col
      if (/^(e-?mail|mail)/.test(key)) cols.email = col
    }
    if (cols.name && cols.email) return { header: row, ...cols }
  }
  throw new Error('Keine Kopfzeile mit Name und E-Mail gefunden.')
}

function loadJson(file, fallback) {
  const path = resolve(root, file)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PRICE_RE = /^\d{2,3}[.,]\d{2}$/

export function rowsFromSheet(sheetRows, { invited = new Set(), mailed = new Set() } = {}) {
  const cols = findColumns(sheetRows)
  const out = []
  for (const { row, cells } of sheetRows) {
    if (row <= cols.header) continue
    const name = String(cells[cols.name] ?? '').replace(/\s+/g, ' ').trim()
    const rawEmail = String(cells[cols.email] ?? '').trim()
    if (!name && !rawEmail) continue
    const email = isValidEmail(normalizeEmail(rawEmail)) ? normalizeEmail(rawEmail) : ''
    const listNo = Number.parseInt(String(cells.A ?? ''), 10)
    let price = null
    let age = null
    const remarks = email || !rawEmail ? [] : [`Mailfeld: ${rawEmail}`]
    const extraEmails = []
    for (const [col, raw] of Object.entries(cells)) {
      if (col === 'A' || col === cols.name || col === cols.email) continue
      const value = raw.replace(/\s+/g, ' ').trim()
      if (!value) continue
      if (PRICE_RE.test(value)) {
        price = Number(value.replace(',', '.'))
        continue
      }
      if (MAIL_RE.test(value)) {
        const extra = normalizeEmail(value)
        if (extra !== email) extraEmails.push(extra)
        continue
      }
      const years = value.match(/^(\d{1,2})\s*jahre?\b/i) ?? value.match(/^(\d{1,2})$/)
      if (years && age == null) age = Number(years[1])
      remarks.push(value)
    }
    out.push({
      listNo: Number.isInteger(listNo) ? listNo : out.length + 1,
      name,
      email,
      validEmail: Boolean(email),
      age,
      price,
      remarks,
      extraEmails: [...new Set(extraEmails)],
      first50: invited.has(email) || (listNo <= 50 && price === 89.99),
      openingMail: mailed.has(email),
    })
  }
  return out
}

async function main() {
  const file = resolve(arg('xlsx', 'data/voranmeldung.xlsx'))
  if (!existsSync(file)) {
    console.error(`Datei nicht gefunden: ${file}`)
    process.exit(1)
  }
  const invites = loadJson('data/first50-invites.json', { invites: [] })
  const sent = loadJson('data/opening-mail-sent.json', { emails: [] })
  const invited = new Set((invites.invites ?? []).map((row) => normalizeEmail(row.email)))
  const mailed = new Set((sent.emails ?? []).map(normalizeEmail))
  const rows = rowsFromSheet(readCells(file), { invited, mailed })

  const dupes = rows.filter((row, i) => row.email && rows.findIndex((other) => other.email === row.email) !== i)
  console.log(
    `${rows.length} Zeilen · ${rows.filter((r) => r.first50).length} First 50 · ${rows.filter((r) => r.openingMail).length} mit Eröffnungsmail · ${rows.filter((r) => r.age != null).length} mit Alter`,
  )
  const bad = rows.filter((row) => !row.validEmail)
  if (bad.length) console.log(`Ungültige Mail bei Nr. ${bad.map((row) => row.listNo).join(', ')}`)
  if (dupes.length) console.log(`Doppelte Mail bei Nr. ${dupes.map((row) => row.listNo).join(', ')} (wird zusammengeführt)`)

  if (!process.argv.includes('--confirm')) {
    console.log('Vorschau. Mit --confirm wird in die Verwaltung übernommen.')
    return
  }

  const site = arg('site', 'https://www.mma-in-leipzig.de').replace(/\/+$/, '')
  const password = envValue('ADMIN_PASSWORD') || envValue('ADMIN_SECRET')
  if (!password) {
    console.error('ADMIN_PASSWORD fehlt.')
    process.exit(1)
  }
  const login = await fetch(`${site}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'login', password }),
  })
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
  if (!login.ok || !cookie) {
    console.error(`Login fehlgeschlagen (${login.status}).`)
    process.exit(1)
  }
  const response = await fetch(`${site}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ action: 'preregImport', rows }),
  })
  const data = await response.json()
  await fetch(`${site}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ action: 'logout' }),
  })
  if (!data.ok) {
    console.error('Import fehlgeschlagen:', data.error)
    process.exit(1)
  }
  console.log(`Übernommen: ${data.added} neu, ${data.updated} aktualisiert, ${data.skipped} übersprungen.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
