import { createMemberStore } from '../server/member-store.mjs'
import { cronAuthorized } from '../server/dues-cron.mjs'
import { sendMembershipEmails } from '../server/membership-mail.mjs'
import { normalizePersonName } from '../server/invite.mjs'

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'method' }))
    return
  }
  if (!cronAuthorized(req, process.env)) {
    res.statusCode = 401
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'auth' }))
    return
  }

  const body = await readJson(req)
  const email = String(body.email || '').trim().toLowerCase()
  const name = normalizePersonName(body.name || '')
  if (!email && name.length < 3) {
    res.statusCode = 400
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'email' }))
    return
  }

  const store = createMemberStore({ dataDir: process.env.MEMBER_DATA_DIR || '/tmp/konni-data', env: process.env })
  const db = await store.load()
  const found = (db.members || []).filter((row) => {
    if (email) return String(row.email || '').trim().toLowerCase() === email
    const full = normalizePersonName(`${row.firstName ?? ''} ${row.lastName ?? ''}`).toLocaleLowerCase('de-DE')
    return full === name.toLocaleLowerCase('de-DE')
  })
  if (!found.length) {
    res.statusCode = 404
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'missing' }))
    return
  }
  if (found.length > 1) {
    res.statusCode = 409
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'duplicate' }))
    return
  }

  const current = found[0]
  const extra = []
  const uploaded = current.docs?.contract
  if (uploaded?.path) {
    try {
      const bytes = await store.getDoc(uploaded.path)
      if (bytes?.length) {
        extra.push({
          name: uploaded.name || 'Unterschriebener-Vertrag.pdf',
          content: Buffer.from(bytes).toString('base64'),
        })
      }
    } catch (error) {
      console.error('[send-contract-cron] signed attachment skipped', error)
    }
  }
  // Include transfer notice PDF when present (transfer members).
  const payment = current.docs?.payment
  if (payment?.path) {
    try {
      const bytes = await store.getDoc(payment.path)
      if (bytes?.length) {
        extra.push({
          name: payment.name || 'Bankueberweisung.pdf',
          content: Buffer.from(bytes).toString('base64'),
        })
      }
    } catch (error) {
      console.error('[send-contract-cron] payment attachment skipped', error)
    }
  }

  const mailRecord = extra.length ? { ...current, signedUploadName: extra.find((f) => /vertrag/i.test(f.name))?.name } : current
  let mailed
  try {
    mailed = await sendMembershipEmails(process.env, mailRecord, {
      paper: current.source === 'admin',
      creditorId: process.env.SEPA_CREDITOR_ID?.trim() || '',
      extra,
    })
  } catch (error) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'mail', detail: String(error.message || error) }))
    return
  }
  if (!mailed || mailed.member === 'skipped') {
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'mail_off' }))
    return
  }

  const at = new Date().toISOString()
  await store.update((fresh) => {
    const index = fresh.members.findIndex((row) => row.id === current.id)
    if (index < 0) return fresh
    fresh.members[index] = {
      ...fresh.members[index],
      contractMail: 'sent',
      contractMailAt: at,
      updatedAt: at,
    }
    return fresh
  })

  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(
    JSON.stringify({
      ok: true,
      mailed,
      email: current.email,
      name: `${current.firstName} ${current.lastName}`,
      fee: current.fee,
      transferAmount: current.transfer?.amount,
    }),
  )
}
