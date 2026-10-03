import {
  INVITE_TTL_HOURS,
  inviteUsed,
  makeInvitePayload,
  namesMatch,
  signInvite,
  splitPersonName,
  verifyInvite,
} from '../server/invite.mjs'
import { first50InviteHtml, first50InviteSubject } from '../server/invite-mail.mjs'
import { validateMembership } from '../server/membership.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const secret = 'test-invite-secret-key'
const other = 'other-invite-secret-k'

const issuedAt = Date.parse('2026-10-03T12:00:00.000Z')
const timed = makeInvitePayload({ email: 'anna@example.com', name: 'Anna Müller', slot: 7, nowMs: issuedAt })
assert(INVITE_TTL_HOURS === 48, 'invite lasts 48 hours')
assert(timed.exp === Math.floor(issuedAt / 1000) + 48 * 60 * 60, 'expiry is 48 hours after issue')
const payload = makeInvitePayload({ email: 'anna@example.com', name: 'Anna Müller', slot: 7 })
const token = signInvite(secret, payload)
const checked = verifyInvite(secret, token)
assert(checked.ok, 'valid token')
assert(checked.payload.email === 'anna@example.com', 'email')
assert(checked.payload.name === 'Anna Müller', 'name')
assert(checked.payload.slot === 7, 'slot')

assert(!verifyInvite(other, token).ok, 'wrong secret')
assert(!verifyInvite(secret, `${token}x`).ok, 'tampered sig')
assert(!verifyInvite(secret, 'nopes').ok, 'garbage')

const expired = signInvite(secret, { ...payload, exp: Math.floor(Date.now() / 1000) - 10 })
const stale = verifyInvite(secret, expired)
assert(!stale.ok && stale.error === 'expired', 'expired')

const split = splitPersonName('Joshua Victor Grudzinski')
assert(split.firstName === 'Joshua Victor' && split.lastName === 'Grudzinski', 'split')
assert(namesMatch('Anna  Müller', 'anna müller'), 'names match')
assert(!namesMatch('Anna Müller', 'Anna Meier'), 'names differ')

assert(
  inviteUsed([{ plan: 'first50', email: 'anna@example.com' }], 'Anna@example.com'),
  'used',
)
assert(
  !inviteUsed([{ plan: 'first50', email: 'anna@example.com', status: 'cancelled' }], 'anna@example.com'),
  'cancelled not used',
)

const base = {
  plan: 'first50',
  firstName: 'Anna',
  lastName: 'Müller',
  birthDate: '1994-04-12',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  city: 'Leipzig',
  email: 'anna@example.com',
  phone: '+49 171 1234567',
  place: 'Leipzig',
  signature: 'Anna Müller',
  invite: token,
  consents: {
    agb: true,
    hausordnung: true,
    widerruf: true,
    privacy: true,
    health: true,
    sign: true,
  },
}

const ctx = { inviteSecret: secret, memberships: [] }
const ok = validateMembership(base, ctx)
assert(ok.ok && ok.record?.plan === 'first50' && ok.record?.inviteSlot === 7, 'invite signup')

const forwarded = validateMembership(
  { ...base, firstName: 'Max', lastName: 'Meier', email: 'max@example.com', signature: 'Max Meier' },
  ctx,
)
assert(!forwarded.ok && forwarded.error === 'invite', 'forwarded other person')

const mailSwap = validateMembership({ ...base, email: 'max@example.com' }, ctx)
assert(!mailSwap.ok && mailSwap.error === 'invite', 'email must match token')

const nameSwap = validateMembership(
  { ...base, firstName: 'Anna', lastName: 'Meier', signature: 'Anna Meier' },
  ctx,
)
assert(!nameSwap.ok && nameSwap.error === 'invite', 'name must match token')

const reused = validateMembership(base, {
  inviteSecret: secret,
  memberships: [{ plan: 'first50', email: 'anna@example.com' }],
})
assert(!reused.ok && reused.error === 'invite', 'one first50 per email')

const missing = validateMembership({ ...base, invite: undefined }, ctx)
assert(!missing.ok && missing.error === 'invite', 'token required')

assert(first50InviteSubject().includes('ersten 50'), 'invite subject')
assert(first50InviteSubject({ test: true }).startsWith('Test:'), 'test prefix')
const inviteHtml = first50InviteHtml({
  first: 'Anna',
  name: 'Anna Müller',
  email: 'anna@example.com',
  url: 'https://www.mma-in-leipzig.de/mitglied?invite=abc',
})
assert(inviteHtml.includes('ersten 50') && inviteHtml.includes('freuen') && inviteHtml.includes('89,99'), 'invite welcome')
assert(inviteHtml.includes('Jetzt Vertrag abschließen') && inviteHtml.includes('anna@example.com'), 'invite link')
assert(inviteHtml.includes('48 Stunden') && inviteHtml.includes('1. November 2026'), 'invite explains the 48 hour link')
assert(inviteHtml.includes('Danach beträgt sie 49 €'), 'invite states the later signup fee')
assert(!inviteHtml.includes('<script'), 'invite escaped')

console.log('invite tests ok')
