import { createMemberStore } from '../server/member-store.mjs'
import { ensurePayments, isoDate } from '../server/member-model.mjs'
import { buildOngoingTransferPayload } from '../server/transfer-due.mjs'

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  if (req.body != null && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function normalizeName(value) {
  return String(value || '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function applyPrice(member, price, today) {
  let next = {
    ...member,
    price,
    updatedAt: new Date().toISOString(),
  }
  if (next.payMethod === 'transfer') {
    const payload = buildOngoingTransferPayload(next, Date.parse(today + 'T12:00:00+01:00') || Date.now())
    next = {
      ...next,
      transfer: {
        ...(next.transfer || {}),
        ...payload,
        monthAmount: Math.round(price * 100),
        amount: Math.round(price * 100),
      },
    }
  }
  next = ensurePayments(next, today)
  next = {
    ...next,
    payments: (next.payments || []).map((row) => {
      if (row.kind !== 'month') return row
      if (row.status === 'paid' || row.status === 'waived') return row
      if (row.note && /Anteiliger/i.test(row.note)) return row
      return { ...row, amount: price }
    }),
  }
  return next
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }
    const secret = process.env.CRON_SECRET?.trim() || ''
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    const header = String(req.headers['x-cron-secret'] || '').trim()
    if (!secret || (auth !== secret && header !== secret)) {
      json(res, 401, { ok: false, error: 'auth' })
      return
    }

    const body = await readBody(req)
    const price = Number(body.price)
    if (!Number.isFinite(price) || price <= 0 || price >= 1000) {
      json(res, 400, { ok: false, error: 'price' })
      return
    }
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const nameWanted = normalizeName(body.name || '')

    const store = createMemberStore({
      dataDir: '/tmp/konni-memberships',
      env: process.env,
    })
    const db = await store.load()
    let member = null
    if (email) {
      member = (db.members || []).find((row) => String(row.email || '').toLowerCase() === email) || null
    }
    if (!member && nameWanted) {
      const hits = (db.members || []).filter((row) => {
        const full = normalizeName(`${row.firstName || ''} ${row.lastName || ''}`)
        return full === nameWanted || full.includes(nameWanted)
      })
      if (hits.length === 1) member = hits[0]
      else if (hits.length > 1) {
        json(res, 409, {
          ok: false,
          error: 'ambiguous',
          matches: hits.map((row) => ({
            id: row.id,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
            price: row.price,
          })),
        })
        return
      }
    }
    if (!member) {
      json(res, 404, { ok: false, error: 'missing' })
      return
    }

    const today = isoDate()
    const previous = Number(member.price)
    let saved = null
    await store.update((fresh) => {
      const index = fresh.members.findIndex((row) => row.id === member.id)
      if (index < 0) return fresh
      fresh.members[index] = applyPrice(fresh.members[index], price, today)
      saved = fresh.members[index]
      return fresh
    })

    json(res, 200, {
      ok: true,
      id: saved.id,
      name: `${saved.firstName} ${saved.lastName}`.trim(),
      email: saved.email,
      from: previous,
      to: Number(saved.price),
      plan: saved.plan,
    })
  } catch (error) {
    console.error('[set-member-price]', error)
    if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
  }
}
