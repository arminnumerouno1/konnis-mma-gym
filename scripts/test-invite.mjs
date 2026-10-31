import {
  FIRST50_SLOT_MAX,
  INVITE_TTL_HOURS,
  PLUS_ID,
  first50SeatLabel,
  inviteRevoked,
  inviteUsed,
  nextFirst50Slot,
  contractStart,
  contractTerm,
  storedContractTerm,
  makeInvitePayload,
  namesMatch,
  signInvite,
  splitPersonName,
  verifyInvite,
} from '../server/invite.mjs'
import {
  createInviteMailHandler,
  first50InviteHtml,
  first50InviteSubject,
  plusInviteHtml,
  plusInviteSubject,
} from '../server/invite-mail.mjs'
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
assert(checked.ok && checked.payload.start === '', 'valid token without a later start')
assert(contractStart('2027-01-01') === '2027-01-01', 'january start is allowed')
assert(contractStart('2026-11-01') === '' && contractStart('2027-01-15') === '', 'only a later first of the month')
const laterPayload = makeInvitePayload({ email: 'martin@example.com', name: 'Martin Masurkewicz', slot: 88, start: '2027-01-01' })
assert(laterPayload.d === '2027-01-01', 'later start is signed into the invite')
const laterChecked = verifyInvite(secret, signInvite(secret, laterPayload))
assert(laterChecked.ok && laterChecked.payload.start === '2027-01-01' && laterChecked.payload.term === 24, 'later start comes back out of the token')
assert(contractTerm(12) === 12 && contractTerm('12') === 12 && contractTerm(6) === 0, 'only a twelve month special term')
const shortPayload = makeInvitePayload({
  email: 'm.masurkewicz@gmx.de',
  name: 'Martin Masurkewicz',
  slot: 81,
  start: '2027-01-01',
  term: 12,
})
assert(shortPayload.m === 12 && shortPayload.d === '2027-01-01', 'twelve months are signed into the invite')
const shortChecked = verifyInvite(secret, signInvite(secret, shortPayload))
assert(
  shortChecked.ok && shortChecked.payload.term === 12 && shortChecked.payload.start === '2027-01-01',
  'twelve month term comes back out',
)
assert(
  storedContractTerm([{ email: 'M.Masurkewicz@gmx.de', slot: 81, term: 12 }], 'm.masurkewicz@gmx.de', 81) === 12,
  'stored twelve month term',
)
assert(storedContractTerm([{ email: 'm.masurkewicz@gmx.de', slot: 81 }], 'm.masurkewicz@gmx.de', 81) === 0, 'missing stored term stays default')
assert(checked.payload.email === 'anna@example.com', 'email')
assert(checked.payload.name === 'Anna Müller', 'name')
assert(checked.payload.slot === 7, 'slot')

assert(!verifyInvite(other, token).ok, 'wrong secret')
assert(!verifyInvite(secret, `${token}x`).ok, 'tampered sig')
assert(!verifyInvite(secret, 'nopes').ok, 'garbage')

const expired = signInvite(secret, { ...payload, exp: Math.floor(Date.now() / 1000) - 10 })
const stale = verifyInvite(secret, expired)
assert(!stale.ok && stale.error === 'expired', 'expired')

const friendToken = signInvite(
  secret,
  makeInvitePayload({ email: 'paul@example.com', name: 'Paul Schneider', slot: 51 }),
)
const friendChecked = verifyInvite(secret, friendToken)
assert(friendChecked.ok && friendChecked.payload.slot === 51, 'friend seat above the original fifty')
const tooHigh = signInvite(
  secret,
  makeInvitePayload({ email: 'paul@example.com', name: 'Paul Schneider', slot: FIRST50_SLOT_MAX + 1 }),
)
assert(!verifyInvite(secret, tooHigh).ok, 'slot above the extra seats')
assert(first50SeatLabel(7) === 'Platz 7 von 50', 'numbered seat inside the fifty')
assert(first50SeatLabel(51) === '', 'friend seat hides the fraction')
assert(nextFirst50Slot([], []) === 66, 'desk links start after the seats already mailed')
assert(
  nextFirst50Slot([{ plan: 'first50', status: 'active', inviteSlot: 66 }], [70]) === 67,
  'desk links skip a signed-up seat and a reserved seat',
)

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
assert(
  !inviteUsed([{ plan: 'first50', email: 'anna@example.com', status: 'withdrawn' }], 'anna@example.com'),
  'withdrawal frees the first50 invite',
)
assert(inviteRevoked([{ email: 'Dome@example.com', slot: 86 }], 'dome@example.com', 86), 'revoked invite is blocked')
assert(!inviteRevoked([{ email: 'dome@example.com', slot: 86 }], 'other@example.com', 86), 'another email keeps the seat')

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
  photoData: `data:image/jpeg;base64,${'B'.repeat(80)}`,
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

const typoSign = validateMembership({ ...base, signature: 'Anna Mueller' }, ctx)
assert(typoSign.ok && typoSign.record?.signature === 'Anna Mueller', 'signature can differ from the invited name')

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
const januaryHtml = first50InviteHtml({
  first: 'Martin',
  name: 'Martin Masurkewicz',
  email: 'm.masurkewicz@gmx.de',
  url: 'https://www.mma-in-leipzig.de/mitglied?invite=abc',
  start: '2027-01-01',
})
assert(januaryHtml.includes('1. Januar 2027') && januaryHtml.includes('Vorher wird nichts berechnet'), 'january invite names the later start')
assert(januaryHtml.includes('24 Monate'), 'january invite stays at 24 months unless asked')
assert(!januaryHtml.includes('1. November 2026'), 'january invite does not promise a november charge')
const shortHtml = first50InviteHtml({
  first: 'Martin',
  name: 'Martin Masurkewicz',
  email: 'm.masurkewicz@gmx.de',
  url: 'https://www.mma-in-leipzig.de/mitglied?invite=abc',
  start: '2027-01-01',
  term: 12,
})
assert(shortHtml.includes('12 Monate') && shortHtml.includes('Sondervertrag') && shortHtml.includes('89,99€'), 'twelve month invite')
assert(!shortHtml.includes('24 Monate') && shortHtml.includes('1. Januar 2027'), 'twelve month invite drops the usual term')
assert(inviteHtml.includes('Danach beträgt sie 49 €'), 'invite states the later signup fee')
assert(inviteHtml.includes('geht dein Platz automatisch an die nächste Person'), 'unused invite passes to the next person')
assert(!inviteHtml.includes('<script'), 'invite escaped')
const lastChanceHtml = first50InviteHtml({
  first: 'Anna',
  name: 'Anna Müller',
  email: 'anna@example.com',
  url: 'https://www.mma-in-leipzig.de/mitglied?invite=abc',
  lastChance: true,
})
assert(
  lastChanceHtml.includes('noch nicht angemeldet') &&
    lastChanceHtml.includes('noch einmalig die Chance') &&
    lastChanceHtml.includes('keinen weiteren Link'),
  'last chance invite says final offer',
)
assert(lastChanceHtml.includes('ist der Platz weg') && !lastChanceHtml.includes('geht dein Platz automatisch an die nächste Person'), 'last chance invite drops the pass-along line')
assert(first50InviteSubject({ lastChance: true }).includes('Letzte Chance'), 'last chance subject')

const plusPayload = makeInvitePayload({
  email: 'benjaminpitzinger@icloud.com',
  name: 'Benjamin Pitzinger',
  slot: 120,
  plan: PLUS_ID,
  start: '2026-12-01',
})
assert(plusPayload.p === PLUS_ID && plusPayload.d === '2026-12-01' && plusPayload.m == null, 'plus invite has no first50 term field')
const plusToken = signInvite(secret, plusPayload)
const plusChecked = verifyInvite(secret, plusToken)
assert(
  plusChecked.ok && plusChecked.payload.plan === PLUS_ID && plusChecked.payload.term === 6 && plusChecked.payload.start === '2026-12-01',
  'plus invite verifies with six months and december start',
)
const plusOk = validateMembership(
  {
    ...base,
    plan: 'plus',
    email: 'benjaminpitzinger@icloud.com',
    firstName: 'Benjamin',
    lastName: 'Pitzinger',
    signature: 'Benjamin Pitzinger',
    invite: plusToken,
  },
  ctx,
)
assert(plusOk.ok && plusOk.record?.plan === 'plus' && plusOk.record?.price === 119 && plusOk.record?.termMonths === 6, 'plus invite signup')
assert(plusOk.record?.startDate === '2026-12-01', 'plus invite keeps december start')
const plusWrongPlan = validateMembership({ ...base, plan: 'first50', invite: plusToken }, ctx)
assert(!plusWrongPlan.ok && plusWrongPlan.error === 'invite', 'plus token cannot book first50')
assert(plusInviteSubject().includes('Plus'), 'plus invite subject')
const plusHtml = plusInviteHtml({
  first: 'Benjamin',
  name: 'Benjamin Pitzinger',
  email: 'benjaminpitzinger@icloud.com',
  url: 'https://www.mma-in-leipzig.de/mitglied?invite=abc',
  start: '2026-12-01',
})
assert(plusHtml.includes('119€') && plusHtml.includes('6 Monate') && plusHtml.includes('1. Dezember 2026'), 'plus invite body')
assert(plusHtml.includes('Vorher wird nichts berechnet') && plusHtml.includes('Jetzt Vertrag abschließen'), 'plus invite payment timing')
assert(plusHtml.includes('48 Stunden'), 'default plus invite still mentions 48 hours')
const plusOpenHtml = plusInviteHtml({
  first: 'Benjamin',
  name: 'Benjamin Pitzinger',
  email: 'benjaminpitzinger@icloud.com',
  url: 'https://www.mma-in-leipzig.de/mitglied?invite=abc',
  start: '2026-12-01',
  openUntilSignup: true,
})
assert(
  plusOpenHtml.includes('bleibt gültig, bis du dich angemeldet hast') && !plusOpenHtml.includes('Der Link gilt <strong>48 Stunden</strong>'),
  'open-until-signup plus invite drops 48h pressure',
)

function mockRes() {
  const captured = { status: 0, body: '' }
  const res = {
    get headersSent() {
      return captured.status !== 0
    },
    statusCode: 0,
    setHeader() {},
    end(payload) {
      captured.status = this.statusCode
      captured.body = String(payload ?? '')
    },
  }
  return { res, captured }
}

{
  const proof = 'signup-mail-proof-test-ok24'
  let sent = null
  const handle = createInviteMailHandler({
    env: { INVITE_SECRET: secret, BREVO_API_KEY: 'xkeysib-test', SIGNUP_MAIL_PROOF: proof },
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return { ok: true, text: async () => '{}' }
    },
    loadMembers: async () => [{ plan: 'first50', status: 'active', email: 'besetzt@example.com', inviteSlot: 7 }],
  })
  const blocked = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.41' },
      body: { one: true, proof, email: 'besetzt@example.com', name: 'Besetzt Person', slot: 19 },
    },
    blocked.res,
  )
  assert(blocked.captured.status === 409 && !sent, 'no invite when the email already has a membership')
  const takenSlot = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.42' },
      body: { one: true, proof, email: 'neu@example.com', name: 'Neu Person', slot: 7 },
    },
    takenSlot.res,
  )
  assert(takenSlot.captured.status === 409 && !sent, 'no invite on a used first50 slot')
  const okMail = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.43' },
      body: { one: true, proof, email: 'neu@example.com', name: 'Neu Person', slot: 19 },
    },
    okMail.res,
  )
  const parsed = JSON.parse(okMail.captured.body)
  assert(okMail.captured.status === 200 && parsed.ok && parsed.slot === 19 && !parsed.url, 'one invite sent without returning the link')
  assert(sent.to[0].email === 'neu@example.com', 'invite recipient')
  assert(sent.subject === 'Du gehörst zu den ersten 50 · KONNI MMA GYM', 'live subject')
  assert(sent.htmlContent.includes('Hi Neu,') && sent.htmlContent.includes('89,99'), 'invite body')
  const href = sent.htmlContent.match(/https:\/\/www\.mma-in-leipzig\.de\/mitglied\?invite=([^"]+)/)
  assert(href, 'invite link')
  const checkedLink = verifyInvite(secret, decodeURIComponent(href[1]))
  assert(checkedLink.ok && checkedLink.payload.email === 'neu@example.com' && checkedLink.payload.slot === 19, 'link matches the person')
  const friendMail = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.44' },
      body: { one: true, proof, email: 'paul@example.com', name: 'Paul Schneider', slot: 51 },
    },
    friendMail.res,
  )
  const friendParsed = JSON.parse(friendMail.captured.body)
  assert(friendMail.captured.status === 200 && friendParsed.ok && friendParsed.slot === 51 && !friendParsed.url, 'friend invite above 50')
  const friendHref = sent.htmlContent.match(/https:\/\/www\.mma-in-leipzig\.de\/mitglied\?invite=([^"]+)/)
  const friendLink = verifyInvite(secret, decodeURIComponent(friendHref[1]))
  assert(friendLink.ok && friendLink.payload.email === 'paul@example.com' && friendLink.payload.slot === 51, 'friend link')
  assert(!sent.htmlContent.includes('Platz 51'), 'mail does not print the extra seat number')
  const overMax = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.45' },
      body: { one: true, proof, email: 'paul@example.com', name: 'Paul Schneider', slot: FIRST50_SLOT_MAX + 1 },
    },
    overMax.res,
  )
  assert(overMax.captured.status === 400, 'slot above the extra seats is refused')
  const shortMail = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.46' },
      body: { one: true, proof, email: 'm.masurkewicz@gmx.de', name: 'Martin Masurkewicz', slot: 81, start: '2027-01-01', term: 12 },
    },
    shortMail.res,
  )
  const shortParsed = JSON.parse(shortMail.captured.body)
  assert(shortMail.captured.status === 200 && shortParsed.ok && shortParsed.slot === 81, 'twelve month invite sent')
  assert(sent.htmlContent.includes('12 Monate') && sent.htmlContent.includes('1. Januar 2027'), 'twelve month mail text')
  const shortHref = sent.htmlContent.match(/https:\/\/www\.mma-in-leipzig\.de\/mitglied\?invite=([^"]+)/)
  const shortLink = verifyInvite(secret, decodeURIComponent(shortHref[1]))
  assert(shortLink.ok && shortLink.payload.term === 12 && shortLink.payload.start === '2027-01-01', 'twelve month link')
  const badTerm = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/invite-mail',
      headers: {},
      socket: { remoteAddress: '127.0.0.47' },
      body: { one: true, proof, email: 'm.masurkewicz@gmx.de', name: 'Martin Masurkewicz', slot: 81, term: 6 },
    },
    badTerm.res,
  )
  assert(badTerm.captured.status === 400, 'other terms are refused')
}

console.log('invite tests ok')
