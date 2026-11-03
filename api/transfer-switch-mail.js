import { createMemberStore } from '../server/member-store.mjs'
import { sendTransferSwitchEmail } from '../server/membership-mail.mjs'
import { cronAuthorized } from '../server/dues-cron.mjs'

const TARGET_IDS = new Set([
  '3c94fc87-6003-469d-81a9-8d78b96f26df',
  'ab437b50-ba25-4a8a-a519-264bbe6e153f',
  '1c9b7b08-9510-4262-bf6e-e5dc60e752ed',
  '9c7eff30-d333-46f4-87ab-eb4385ea316a',
  'aca95975-d357-47da-b011-4d559189bb11',
  '4ed0dbb2-6427-4a57-9c6d-90a7c34e9840',
  '4448e302-e234-43a3-9517-86cc3677d5ff',
  '1da440e7-801d-49e8-b444-dddf49d8887b',
  'ba086961-d42d-48b9-8ca0-4172c7c2af8b',
  'b9fb5e9d-8c34-45ab-8ee3-2ec5338bb6f3',
  'fa15d48d-8619-4f8f-a225-b94ad3e7250b',
  '477dd5ff-ad1d-4d58-a58b-35bf5313022d',
  '88797dbd-fc62-4694-b267-4b3ddae1989d',
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
