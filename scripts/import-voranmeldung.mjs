import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeInvitePayload, signInvite } from '../server/invite.mjs'
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

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return 'true'
  return next
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n;]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function ensureSecret() {
  let secret = String(process.env.INVITE_SECRET ?? '').trim()
  if (secret.length >= 16) return secret
  secret = randomBytes(32).toString('base64url')
  upsertEnv('INVITE_SECRET', secret)
  process.env.INVITE_SECRET = secret
  console.log('INVITE_SECRET neu erzeugt und in .env geschrieben (nicht ins Git).')
  return secret
}

function readXlsx(path) {
  const py = `
import json, sys, zipfile, xml.etree.ElementTree as ET
path = sys.argv[1]
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(path) as z:
    ss = z.read('xl/sharedStrings.xml')
    sheet = z.read('xl/worksheets/sheet1.xml')
root = ET.fromstring(ss)
strings = []
for si in root.findall('m:si', ns):
    strings.append(''.join(t.text or '' for t in si.findall('.//m:t', ns)))
sroot = ET.fromstring(sheet)

def colrow(ref):
    col, row = '', ''
    for ch in ref:
        if ch.isalpha():
            col += ch
        else:
            row += ch
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n, int(row)

grid = {}
maxc = 0
maxr = 0
for row in sroot.findall('m:sheetData/m:row', ns):
    for c in row.findall('m:c', ns):
        ref = c.get('r')
        t = c.get('t')
        v = c.find('m:v', ns)
        val = ''
        if t == 's' and v is not None:
            val = strings[int(v.text)]
        elif t == 'inlineStr':
            val = ''.join(x.text or '' for x in c.findall('.//m:t', ns))
        elif v is not None:
            val = v.text or ''
        cn, rn = colrow(ref)
        grid[(rn, cn)] = str(val).strip()
        maxc = max(maxc, cn)
        maxr = max(maxr, rn)

header_row = None
name_col = email_col = num_col = None
for r in range(1, maxr + 1):
    for c in range(1, maxc + 1):
        cell = grid.get((r, c), '').strip().lower().rstrip(':')
        if cell == 'name':
            header_row = r
            name_col = c
        elif cell.startswith('email') or cell.startswith('e-mail') or cell.startswith('mail'):
            email_col = c
        elif cell in ('nr', 'no', '#', 'platz'):
            num_col = c
    if header_row and name_col and email_col:
        break
if not header_row:
    raise SystemExit('Keine Kopfzeile mit Name/E-Mail gefunden.')
if num_col is None:
    num_col = 1

rows = []
for r in range(header_row + 1, maxr + 1):
    name = grid.get((r, name_col), '').strip()
    email = grid.get((r, email_col), '').strip()
    num = grid.get((r, num_col), '').strip()
    extras = []
    for c in range(1, maxc + 1):
        if c in (num_col, name_col, email_col):
            continue
        val = grid.get((r, c), '').strip()
        if val:
            extras.append(val)
    if not name and not email:
        continue
    rows.append({'row': r, 'num': num, 'name': name, 'email': email, 'extras': extras})
print(json.dumps(rows, ensure_ascii=False))
`
  const raw = execFileSync('python3', ['-c', py, path], { encoding: 'utf8', maxBuffer: 10_000_000 })
  return JSON.parse(raw)
}

function slotOf(row, index) {
  const n = Number.parseInt(String(row.num ?? '').replace(/[^\d]/g, ''), 10)
  return Number.isInteger(n) && n > 0 ? n : index
}

function inviteUrl(site, token) {
  const origin = site.replace(/\/+$/, '')
  return `${origin}/mitglied?invite=${encodeURIComponent(token)}`
}

async function sendBrevo({ apiKey, sender, to, name, url, slot }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'KONNI MMA GYM', email: sender },
      to: [{ email: to, name }],
      subject: 'Dein First-50-Platz im KONNI MMA GYM',
      htmlContent: `<p>Hi ${name.split(' ')[0]},</p>
<p>du stehst auf der Voranmeldung. Platz ${slot} von 50 gilt nur für dich: <strong>89,99€ im Monat statt 99,99€</strong>, 24 Monate.</p>
<p><a href="${url}">Hier Vertrag abschließen</a></p>
<p>Der Link ist an deine E-Mail gebunden. Weiterleiten bringt nichts – Name und Mail müssen zu dieser Voranmeldung passen. Zahlung erst ab echter Eröffnung.</p>
<p>KONNI MMA GYM · Wittenberger Straße 15 · Leipzig</p>`,
    }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`brevo_${response.status}:${text.slice(0, 240)}`)
}

loadEnvFile()

if (process.argv.includes('--help')) {
  console.log(`Voranmeldung → First-50-Links

  node scripts/import-voranmeldung.mjs --xlsx DATEI.xlsx
    [--site https://www.mma-in-leipzig.de]
    [--limit 50]
    [--out data/first50-invites]
    [--send]

Ohne --send nur CSV/JSON. Mails gehen nur mit --send und BREVO_API_KEY.
INVITE_SECRET muss auf Vercel (Production) derselbe Wert sein.
`)
  process.exit(0)
}

const xlsx = arg('xlsx')
if (!xlsx) {
  console.error('Bitte --xlsx Pfad/zur/Voranmeldeliste.xlsx angeben.')
  process.exit(1)
}

const xlsxPath = resolve(xlsx)
if (!existsSync(xlsxPath)) {
  console.error(`Datei nicht gefunden: ${xlsxPath}`)
  process.exit(1)
}

const limit = Number(arg('limit', '50')) || 50
const site = arg('site', process.env.VITE_SITE_URL?.trim() || 'https://www.mma-in-leipzig.de')
const outBase = resolve(root, arg('out', 'data/first50-invites'))
const wantSend = process.argv.includes('--send')
const secret = ensureSecret()
const rows = readXlsx(xlsxPath)

const skipped = []
const invites = []
const waitlist = []
const seen = new Set()

rows.forEach((row, index) => {
  const slot = slotOf(row, index + 1)
  const name = String(row.name ?? '').replace(/\s+/g, ' ').trim()
  const email = normalizeEmail(row.email)
  const item = { slot, name, email, sourceRow: row.row, extras: row.extras ?? [] }

  if (slot > limit) {
    if (isValidEmail(email)) waitlist.push(item)
    else skipped.push({ ...item, reason: 'waitlist-ohne-mail' })
    return
  }

  if (!name) {
    skipped.push({ ...item, reason: 'kein-name' })
    return
  }
  if (!isValidEmail(email)) {
    skipped.push({ ...item, reason: 'keine-mail' })
    return
  }
  if (seen.has(email)) {
    skipped.push({ ...item, reason: 'doppelte-mail' })
    return
  }
  seen.add(email)
  const token = signInvite(secret, makeInvitePayload({ email, name, slot }))
  invites.push({ ...item, token, url: inviteUrl(site, token) })
})

mkdirSync(dirname(outBase), { recursive: true })

const csv = [
  ['slot', 'name', 'email', 'url', 'status'].map(csvCell).join(','),
  ...invites.map((row) => [row.slot, row.name, row.email, row.url, 'invite'].map(csvCell).join(',')),
].join('\n')
writeFileSync(`${outBase}.csv`, `${csv}\n`, 'utf8')
writeFileSync(
  `${outBase}.json`,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), site, limit, invites, skipped, waitlist }, null, 2)}\n`,
  'utf8',
)

if (waitlist.length) {
  const waitCsv = [
    ['slot', 'name', 'email'].map(csvCell).join(','),
    ...waitlist.map((row) => [row.slot, row.name, row.email].map(csvCell).join(',')),
  ].join('\n')
  writeFileSync(`${outBase}-waitlist.csv`, `${waitCsv}\n`, 'utf8')
}

console.log(`First 50 Links: ${invites.length}`)
console.log(`Übersprungen: ${skipped.length}`)
for (const row of skipped.filter((item) => item.slot <= limit)) {
  console.log(`  #${row.slot} ${row.name} → ${row.reason}${row.email ? ` (${row.email})` : ''}`)
}
console.log(`Danach auf Standard-Preis: ${waitlist.length}`)
console.log(`CSV: ${outBase}.csv`)
console.log('PII bleibt lokal, nicht ins Git.')

if (!wantSend) {
  console.log('Keine Mails verschickt. Zum Versand: gleichen Befehl plus --send (BREVO_API_KEY, Absender bestätigt).')
  process.exit(0)
}

const apiKey = process.env.BREVO_API_KEY?.trim()
if (!apiKey) {
  console.error('BREVO_API_KEY fehlt. Links sind da, Mails nicht.')
  process.exit(1)
}

const sender = process.env.BREVO_SENDER?.trim() || 'info@mma-in-leipzig.de'
let sent = 0
for (const row of invites) {
  await sendBrevo({ apiKey, sender, to: row.email, name: row.name, url: row.url, slot: row.slot })
  sent += 1
  process.stdout.write(`Mail ${sent}/${invites.length}\r`)
  await new Promise((resolveWait) => setTimeout(resolveWait, 350))
}
console.log(`Mails raus: ${sent}`)
