import { sendMembershipEmails } from './membership-mail.mjs'

function mailOpen(env = {}) {
  const raw = String(env.MEMBERSHIP_MAIL ?? '').trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return true
}

/** Checkout ist durch: bezahlt, oder Karte hinterlegt und noch nichts fällig. Abbruch zählt nicht. */
export function checkoutSettled(session) {
  if (!session || session.object !== 'checkout.session') return false
  if (session.status && session.status !== 'complete') return false
  return session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
}

function mailLockPath(memberId) {
  return `mail-lock/${memberId}`
}

/**
 * Vertragsmail nur für Online-Kartenanmeldungen, und nur einmal.
 * Banküberweisung verschickt die Mail beim Abschluss, nicht hier.
 */
export async function sendContractMailOnce(store, env, memberId) {
  if (!mailOpen(env)) return { sent: false, reason: 'off' }
  if (!memberId) return { sent: false, reason: 'missing' }

  const before = await store.load()
  const member = before.members.find((row) => row.id === memberId)
  if (!member) return { sent: false, reason: 'missing' }
  if (member.contractMail === 'sent') return { sent: false, reason: 'already' }
  if (member.contractMail !== 'after_payment' || member.payMethod === 'transfer') {
    return { sent: false, reason: 'not_due' }
  }

  const claimed = await store.putDocOnce(mailLockPath(memberId), Buffer.from(new Date().toISOString()), 'text/plain')
  if (!claimed) return { sent: false, reason: 'already' }

  try {
    const mailed = await sendMembershipEmails(env, member)
    if (mailed.member === 'skipped' && mailed.gym === 'skipped') {
      await store.deleteDoc(mailLockPath(memberId))
      return { sent: false, reason: 'skipped' }
    }
    await store.update((db) => {
      const index = db.members.findIndex((row) => row.id === memberId)
      if (index < 0) return db
      db.members[index] = {
        ...db.members[index],
        contractMail: 'sent',
        contractMailAt: new Date().toISOString(),
      }
      return db
    })
    return { sent: true, ...mailed }
  } catch (error) {
    await store.deleteDoc(mailLockPath(memberId)).catch(() => undefined)
    throw error
  }
}
