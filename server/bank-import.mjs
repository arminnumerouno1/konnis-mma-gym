import { normalizeIban, openDuesOf } from './member-model.mjs'

function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '')
}

function detectDelimiter(headerLine) {
  const semi = (headerLine.match(/;/g) || []).length
  const comma = (headerLine.match(/,/g) || []).length
  return semi >= comma ? ';' : ','
}

function parseCsvLine(line, delimiter) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else inQuotes = !inQuotes
      continue
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function normalizeHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function pickIndex(headers, candidates) {
  for (const want of candidates) {
    const idx = headers.findIndex((h) => h.includes(want) || h === want)
    if (idx >= 0) return idx
  }
  return -1
}

function parseAmount(raw) {
  const text = String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(text)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function parseGermanDate(raw) {
  const s = String(raw ?? '').trim()
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(s)
  if (de) {
    const y = de[3].length === 2 ? `20${de[3]}` : de[3]
    return `${y}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return ''
}

/**
 * Sparkasse-/Bank-CSV → Buchungen. Negativbeträge (Ausgänge) werden verworfen.
 */
export function parseBankCsv(text) {
  const cleaned = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return { ok: false, error: 'empty', rows: [] }
  const delimiter = detectDelimiter(lines[0])
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader)
  const amountIdx = pickIndex(headers, ['betrag', 'umsatz', 'amount'])
  const purposeIdx = pickIndex(headers, ['verwendungszweck', 'zweck', 'purpose', 'referenz'])
  const nameIdx = pickIndex(headers, [
    'beguenstigterzahlungspflichtiger',
    'zahlungspflichtiger',
    'auftraggeber',
    'name',
    'empfaenger',
  ])
  const dateIdx = pickIndex(headers, ['buchungstag', 'valutadatum', 'datum', 'buchungsdatum', 'date'])
  const ibanIdx = pickIndex(headers, ['kontonummeriban', 'iban', 'gegenkonto'])
  if (amountIdx < 0) return { ok: false, error: 'columns', rows: [] }

  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter)
    if (cols.every((c) => !c)) continue
    const amount = parseAmount(cols[amountIdx])
    if (amount == null || amount <= 0) continue
    const purpose = purposeIdx >= 0 ? cols[purposeIdx] || '' : ''
    const name = nameIdx >= 0 ? cols[nameIdx] || '' : ''
    const date = dateIdx >= 0 ? parseGermanDate(cols[dateIdx]) : ''
    const iban = ibanIdx >= 0 ? normalizeIban(cols[ibanIdx] || '') : ''
    rows.push({
      index: i,
      date,
      amount,
      name,
      purpose,
      iban,
      raw: cols.join(delimiter),
    })
  }
  return { ok: true, rows }
}

function normName(value) {
  return String(value ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function scoreMatch(member, txn) {
  let score = 0
  const purpose = String(txn.purpose ?? '')
  const purposeLow = purpose.toLowerCase()
  const hay = normName(`${txn.name} ${txn.purpose}`)
  const email = String(member.email ?? '')
    .toLowerCase()
    .trim()
  const memberIban = String(member.bank?.iban || '')
    .replace(/\s/g, '')
    .toUpperCase()
  const txnIban = String(txn.iban || '')
    .replace(/\s/g, '')
    .toUpperCase()

  // Harte Regeln: IBAN / E-Mail / Mitglieds-ID im Verwendungszweck
  if (memberIban && txnIban && memberIban === txnIban) score += 100
  if (email && purposeLow.includes(email)) score += 70
  if (member.id && purpose.includes(member.id)) score += 90

  // Zweck-Stichworte
  if (/(beitrag|mitglied|konni|mma|monat)/i.test(purpose)) score += 12
  for (const period of openPeriodsHint(member)) {
    if (purpose.includes(period) || purposeLow.includes(period.replace('-', '/'))) score += 18
    const [y, m] = period.split('-')
    const months = ['januar', 'februar', 'maerz', 'marz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember']
    const name = months[Number(m) - 1]
    if (name && purposeLow.includes(name) && purpose.includes(y)) score += 15
  }

  const last = normName(member.lastName)
  const first = normName(member.firstName)
  if (last && hay.includes(last)) score += 28
  if (first && hay.includes(first)) score += 12
  const full = `${first} ${last}`.trim()
  if (full && hay.includes(full)) score += 18
  return score
}

function openPeriodsHint(member) {
  const rows = Array.isArray(member.payments) ? member.payments : []
  return rows
    .filter((row) => (row.status === 'open' || row.status === 'failed') && row.kind === 'month')
    .map((row) => String(row.period))
}

/**
 * Ordnet positive Eingänge offenen Beiträgen (Überweisung) zu.
 */
export function matchBankTransactions(members, transactions, today) {
  const usedTx = new Set()
  const usedSlots = new Set()
  const matches = []
  const unmatched = []
  const candidates = []

  for (const txn of transactions) {
    for (const member of members) {
      if (member.payMethod !== 'transfer') continue
      if (member.status === 'withdrawn' || member.status === 'expired') continue
      const dues = openDuesOf(member, today)
      if (!dues.openCount) continue
      const row = dues.openRows.find((item) => Math.abs(Number(item.amount) - txn.amount) < 0.02)
      if (!row) continue
      const score = scoreMatch({ ...member, payments: dues.openRows }, txn)
      // IBAN-Treffer oder starke Zweck/Name-Treffer
      const minScore = txn.iban && member.bank?.iban ? 40 : 35
      if (score < minScore) continue
      candidates.push({ txn, member, row, score })
    }
  }
  candidates.sort((a, b) => b.score - a.score)

  for (const hit of candidates) {
    const slot = `${hit.member.id}:${hit.row.kind}:${hit.row.period}`
    if (usedTx.has(hit.txn.index) || usedSlots.has(slot)) continue
    usedTx.add(hit.txn.index)
    usedSlots.add(slot)
    matches.push({
      txnIndex: hit.txn.index,
      date: hit.txn.date,
      amount: hit.txn.amount,
      name: hit.txn.name,
      purpose: hit.txn.purpose,
      iban: hit.txn.iban || '',
      memberId: hit.member.id,
      memberName: `${hit.member.firstName} ${hit.member.lastName}`.trim(),
      email: hit.member.email,
      period: hit.row.period,
      kind: hit.row.kind,
      score: hit.score,
      selected: true,
    })
  }

  for (const txn of transactions) {
    if (usedTx.has(txn.index)) continue
    unmatched.push({
      txnIndex: txn.index,
      date: txn.date,
      amount: txn.amount,
      name: txn.name,
      purpose: txn.purpose,
    })
  }

  return { matches, unmatched }
}
