import assert from 'node:assert/strict'
import {
  buildOngoingTransferPayload,
  buildTransferDue,
  buildTransferPayload,
  daysInMonth,
  followingFirstIso,
  nextFirstIso,
  prorateMonthCents,
  remainingDaysInclusive,
  transferPurpose,
} from '../server/transfer-due.mjs'

assert.equal(daysInMonth('2026-11-10'), 30, 'november has 30 days')
assert.equal(daysInMonth('2026-02-01'), 28, '2026 feb has 28')
assert.equal(remainingDaysInclusive('2026-11-10'), 21, '10 nov → 21 days left')
assert.equal(remainingDaysInclusive('2026-11-28'), 3, '28 nov → 3 days')
assert.equal(remainingDaysInclusive('2026-11-01'), 30, '1 nov → full month')
assert.equal(nextFirstIso('2026-11-10'), '2026-12-01')
assert.equal(nextFirstIso('2026-11-01'), '2026-11-01')
assert.equal(followingFirstIso('2026-11-01'), '2026-12-01')

assert.equal(prorateMonthCents(9999, '2026-11-10'), 6999, '10 nov standard share')
assert.equal(prorateMonthCents(9999, '2026-11-28'), 1000, '28 nov standard share')
assert.equal(prorateMonthCents(9999, '2026-11-01'), 9999, '1st is full')

const mid = buildTransferDue(
  { id: 'abc12345-xxxx', firstName: 'Kevin', lastName: 'Wollenberg', price: 99.99, fee: 0 },
  Date.parse('2026-11-10T12:00:00+01:00'),
)
assert.equal(mid.prorated, true)
assert.equal(mid.prorateCents, 6999)
assert.equal(mid.amount, 6999)
assert.equal(mid.nextFullDue, '2026-12-01')
assert.equal(mid.dueNow, true)

const withFee = buildTransferDue(
  { id: 'abc12345-xxxx', firstName: 'Anna', lastName: 'Test', price: 99.99, fee: 19.99 },
  Date.parse('2026-11-10T12:00:00+01:00'),
)
assert.equal(withFee.amount, 6999 + 1999, 'prorate plus signup fee')
assert.equal(withFee.feeCents, 1999)

const onFirst = buildTransferDue(
  { id: 'x', firstName: 'A', lastName: 'B', price: 99.99, fee: 0 },
  Date.parse('2026-12-01T10:00:00+01:00'),
)
assert.equal(onFirst.prorated, false)
assert.equal(onFirst.amount, 9999)
assert.equal(onFirst.nextFullDue, '2027-01-01')

const early = buildTransferDue(
  { id: 'x', firstName: 'A', lastName: 'B', price: 99.99, fee: 0 },
  Date.parse('2026-10-15T10:00:00+02:00'),
)
assert.equal(early.prorated, false)
assert.equal(early.dueNow, false)
assert.equal(early.firstDueDate, '2026-11-01')
assert.equal(early.amount, 9999)

const purpose = transferPurpose({ id: 'a81f7fb4-819f-43e0-94dd-495679eb10bc', firstName: 'Kevin', lastName: 'Wollenberg' })
assert.match(purpose, /KONNI Beitrag/)
assert.match(purpose, /Wollenberg/)
assert.match(purpose, /a81f7fb4/)

const payload = buildTransferPayload(
  { id: 'abc12345-xxxx', firstName: 'Max', lastName: 'Mustermann', price: 99.99, fee: 19.99 },
  Date.parse('2026-11-28T12:00:00+01:00'),
)
assert.equal(payload.prorated, true)
assert.equal(payload.amount, 1000 + 1999)
assert.equal(payload.prorateAmount, 1000)
assert.equal(payload.feeAmount, 1999)
assert.ok(payload.purpose.includes('Mustermann'))
assert.equal(payload.iban, 'DE77860555921090429270')

const ongoing = buildOngoingTransferPayload(
  { id: 'abcdefgh-xxxx', firstName: 'A', lastName: 'B', price: 99.99 },
  Date.parse('2026-11-06T12:00:00Z'),
)
assert.equal(ongoing.prorated, false)
assert.equal(ongoing.amount, 9999)
assert.equal(ongoing.firstDueDate, '2026-12-01')
assert.equal(ongoing.nextFullDue, '2026-12-01')

console.log('transfer-due ok')
