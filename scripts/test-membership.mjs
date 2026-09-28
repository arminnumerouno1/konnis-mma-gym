import { ageOn, first50Taken, validateMembership } from '../server/membership.mjs'
import { membershipCopyHtml } from '../server/membership-mail.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(ageOn('2000-01-15') !== null, 'age parses')
assert(ageOn('1990-13-01') === null, 'bad month')
assert(ageOn('2099-01-01') === null, 'future')

const base = {
  plan: 'standard',
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
  consents: {
    agb: true,
    hausordnung: true,
    widerruf: true,
    privacy: true,
    health: true,
    sign: true,
  },
}

const ok = validateMembership(base, {})
assert(ok.ok && ok.record?.plan === 'standard', 'valid standard')

const honey = validateMembership({ ...base, company: 'bot' }, {})
assert(honey.ok && honey.honey, 'honeypot')

const badSign = validateMembership({ ...base, signature: 'Anna M' }, {})
assert(!badSign.ok && badSign.error === 'signature', 'signature must match')

const gone = validateMembership({ ...base, plan: 'first50' }, {})
assert(!gone.ok && gone.error === 'invite', 'first50 needs invite')

const kid = validateMembership(
  {
    ...base,
    birthDate: '2014-01-01',
    guardianName: 'Tim Müller',
    guardianEmail: 'tim@example.com',
    guardianPhone: '03411234567',
    guardianConsent: true,
  },
  {},
)
assert(kid.ok && kid.record?.minor, 'minor with guardian')

const kidNoGuard = validateMembership({ ...base, birthDate: '2014-01-01' }, {})
assert(!kidNoGuard.ok && kidNoGuard.error === 'guardian', 'minor needs guardian')

const day = validateMembership({ ...base, plan: 'daypass', visitDay: '2026-10-02' }, {})
assert(day.ok && day.record?.visitDay === '2026-10-02', 'day pass date')

assert(first50Taken([{ plan: 'first50' }, { plan: 'standard' }, { plan: 'first50', status: 'cancelled' }]) === 1, 'count')

const mail = membershipCopyHtml({
  firstName: 'Anna',
  lastName: 'Müller',
  birthDate: '1994-04-12',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  city: 'Leipzig',
  email: 'anna@example.com',
  phone: '+49 171 1234567',
  plan: 'first50',
  planName: 'First 50',
  price: 89.99,
  termMonths: 24,
  place: 'Leipzig',
  signature: 'Anna Müller',
  createdAt: '2026-09-28T19:00:00.000Z',
  consents: { earlyStart: true },
})
assert(mail.includes('First 50') && mail.includes('89,99') && mail.includes('Anna Müller'), 'mail copy')
assert(!mail.includes('<script') && mail.includes('Wittenberger'), 'mail escaped')

console.log('membership tests ok')
