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
  const hay = normName(`${txn.name} ${txn.purpose}`)
  const email = String(member.email ?? '')
    .toLowerCase()
    .trim()
  if (email && String(txn.purpose).toLowerCase().includes(email)) score += 60
  if (member.id && String(txn.purpose).includes(member.id)) score += 80
  const last = normName(member.lastName)
  const first = normName(member.firstName)
  if (last && hay.includes(last)) score += 30
  if (first && hay.includes(first)) score += 15
  const full = `${first} ${last}`.trim()
  if (full && hay.includes(full)) score += 20
  return score
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
      const score = scoreMatch(member, txn)
      if (score < 30) continue
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
      memberId: hit.member.id,
      memberName: `${hit.member.firstName} ${hit.member.lastName}`.trim(),
      email: hit.member.email,
      period: hit.row.period,
      kind: hit.row.kind,
      score: hit.score,
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
