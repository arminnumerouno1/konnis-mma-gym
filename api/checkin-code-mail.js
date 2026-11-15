import { collectCheckinCodes, ensureCheckinCode, generateCheckinCode } from '../server/checkin-code.mjs'
import { cronAuthorized, cronRateLimited } from '../server/dues-cron.mjs'
import { createMemberStore } from '../server/member-store.mjs'
import { sendCheckinCodeEmail } from '../server/membership-mail.mjs'
import { createTrialStore } from '../server/trial.mjs'

export const config = {
  maxDuration: 300,
}

export const CHECKIN_CODE_MAIL_CONFIRM = 'checkin-code-mail'

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

function isMailEligible(member) {
  if (!member?.email) return false
  const status = String(member.status || '')
  if (status === 'cancelled' || status === 'withdrawn' || status === 'expired') return false
  return true
}

async function sendOne(store, member, trials) {
  let target = member
  if (!target.checkinCode) {
    await store.update((db) => {
      const index = db.members.findIndex((row) => row.id === member.id)
      if (index < 0) return db
      const trialEntries = trials || []
      const withCode = ensureCheckinCode(db.members[index], collectCheckinCodes(db.members, trialEntries))
      db.members[index] = { ...withCode, updatedAt: new Date().toISOString() }
      target = db.members[index]
      return db
    })
  }
  const mailed = await sendCheckinCodeEmail(process.env, target)
  if (mailed !== 'sent') return { ok: false, error: mailed || 'mail', email: target.email }
  const at = new Date().toISOString()
  await store.update((fresh) => {
    const index = fresh.members.findIndex((row) => row.id === target.id)
    if (index < 0) return fresh
    fresh.members[index] = {
      ...fresh.members[index],
      checkinCodeMailAt: at,
      updatedAt: at,
    }
    return fresh
  })
  return { ok: true, email: target.email }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method' })
      return
    }
    if (!cronAuthorized(req, process.env)) {
      json(res, 401, { ok: false, error: 'auth' })
      return
    }
    if (cronRateLimited(req)) {
      json(res, 429, { ok: false, error: 'rate' })
      return
    }

    const body = await readBody(req)
    const store = createMemberStore({
      dataDir: '/tmp/konni-memberships',
      env: process.env,
    })
    const trials = createTrialStore({
      dataDir: '/tmp/konni-memberships',
      env: process.env,
    })

    if (body.bulk === true) {
      if (String(body.confirm ?? '').trim() !== CHECKIN_CODE_MAIL_CONFIRM) {
        json(res, 403, { ok: false, error: 'confirm' })
        return
      }
      if (!process.env.BREVO_API_KEY?.trim()) {
        json(res, 503, { ok: false, error: 'mail_off' })
        return
      }

      const trialDb = await trials.load()
      // Assign missing codes first so every eligible member has one.
      await store.update((db) => {
        const taken = collectCheckinCodes(db.members, trialDb.entries)
        db.members = db.members.map((row) => {
          if (!isMailEligible(row)) return row
          if (row.checkinCode) {
            taken.add(String(row.checkinCode).toUpperCase())
            return row
          }
          return ensureCheckinCode(row, taken)
        })
        return db
      })

      const people = ((await store.load()).members || []).filter((row) => {
        if (!isMailEligible(row)) return false
        if (!row.checkinCode) return false
        if (body.force === true) return true
        return !row.checkinCodeMailAt
      })
      if (!people.length) {
        json(res, 409, { ok: false, error: 'no_recipients' })
        return
      }

      let sent = 0
      let failed = 0
      const errors = []
      for (const person of people) {
        const result = await sendOne(store, person, trialDb.entries)
        if (!result.ok) {
          failed += 1
          errors.push({ email: person.email, error: result.error })
          console.error('[checkin-code-bulk]', person.email, result.error)
        } else {
          sent += 1
        }
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      json(res, failed && !sent ? 502 : 200, {
        ok: failed === 0,
        sent,
        failed,
        total: people.length,
        errors: errors.slice(0, 20),
      })
      return
    }

    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    if (!email || !email.includes('@')) {
      json(res, 400, { ok: false, error: 'email' })
      return
    }

    const db = await store.load()
    const trialDb = await trials.load()
    let member = (db.members || []).find((row) => String(row.email || '').toLowerCase() === email)
    let record
    if (member) {
      if (!member.checkinCode) {
        member = ensureCheckinCode(member, collectCheckinCodes(db.members, trialDb.entries))
        await store.update((next) => {
          const index = next.members.findIndex((row) => row.id === member.id)
          if (index >= 0) next.members[index] = { ...member, updatedAt: new Date().toISOString() }
          return next
        })
      }
      record = member
    } else {
      record = {
        firstName: String(body.firstName || 'Armin').trim() || 'Armin',
        lastName: String(body.lastName || 'Scholtz').trim(),
        email,
        checkinCode: generateCheckinCode(),
      }
    }

    const mail = await sendCheckinCodeEmail(process.env, record)
    if (member && mail === 'sent') {
      const at = new Date().toISOString()
      await store.update((fresh) => {
        const index = fresh.members.findIndex((row) => row.id === member.id)
        if (index < 0) return fresh
        fresh.members[index] = { ...fresh.members[index], checkinCodeMailAt: at, updatedAt: at }
        return fresh
      })
    }
    json(res, 200, {
      ok: true,
      mail,
      memberFound: Boolean(member),
      email: record.email,
      code: record.checkinCode,
    })
  } catch (error) {
    console.error('[checkin-code-mail]', error)
    if (!res.headersSent) json(res, 500, { ok: false, error: 'upstream' })
  }
}
