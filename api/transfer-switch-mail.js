import { createMemberStore } from '../server/member-store.mjs'
import { sendTransferSwitchEmail } from '../server/membership-mail.mjs'
import { cronAuthorized } from '../server/dues-cron.mjs'

const TARGET_IDS = new Set([
  '9a32ca7b-98c8-4c90-8db7-c128c0d5d728', // Wanya Donix
  '16f1706f-069b-4410-874d-0e7e75ce7357', // Sandro Bischoff
  'afe1522a-81e1-428b-a79d-250a167e9396', // Mark Pupynin
])

function isTarget(member) {
  if (TARGET_IDS.has(member.id)) return true
  return (
    member.payMethod === 'transfer' &&
    String(member.notes || '').includes('Karte/Apple Pay → Überweisung')
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
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

  const store = createMemberStore({ dataDir: process.env.MEMBER_DATA_DIR || '/tmp/konni-data', env: process.env })
  const db = await store.load()
  const members = db.members || []
  const targets = members.filter(isTarget)
  const results = []

  for (const member of targets) {
    if (member.payMethod !== 'transfer') {
      results.push({ id: member.id, mail: 'skip_not_transfer' })
      continue
    }
    if (member.transferSwitchMail === 'sent') {
      results.push({ id: member.id, mail: 'already', email: member.email })
      continue
    }
    let mail = 'skipped'
    try {
      mail = await sendTransferSwitchEmail(process.env, member)
    } catch (error) {
      results.push({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        mail: 'error',
        error: String(error.message || error),
      })
      continue
    }
    if (mail && mail !== 'skipped') {
      const at = new Date().toISOString()
      await store.update((fresh) => {
        const index = fresh.members.findIndex((row) => row.id === member.id)
        if (index < 0) return fresh
        fresh.members[index] = {
          ...fresh.members[index],
          transferSwitchMail: 'sent',
          transferSwitchMailAt: at,
          updatedAt: at,
        }
        return fresh
      })
    }
    results.push({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      email: member.email,
      mail,
      brevo: Boolean(process.env.BREVO_API_KEY?.trim()),
    })
  }

  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(
    JSON.stringify({
      ok: true,
      totalMembers: members.length,
      targetCount: targets.length,
      brevo: Boolean(process.env.BREVO_API_KEY?.trim()),
      sent: results.filter((r) => r.mail === 'sent' || r.mail === 'sent_with_pdf').length,
      results,
    }),
  )
}
