import { createKeyedRateLimiter, isHoneypot, isTooFast, publicFormTrap } from '../server/public-form-guard.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(isHoneypot({ company: 'Acme' }), 'filled company is honeypot')
assert(!isHoneypot({ company: '' }), 'empty company ok')
assert(!isHoneypot({}), 'missing company ok')

const now = Date.now()
assert(isTooFast({}, 2500, now), 'missing formStarted is too fast')
assert(isTooFast({ formStarted: now - 500 }, 2500, now), 'half second is too fast')
assert(!isTooFast({ formStarted: now - 3000 }, 2500, now), '3s is ok')
assert(isTooFast({ formStarted: now - 25 * 60 * 60 * 1000 }, 2500, now), 'older than 24h rejected')

assert(publicFormTrap({ company: 'x', formStarted: now - 5000 }) === 'honey', 'honey wins')
assert(publicFormTrap({ formStarted: now }, { minMs: 2500, nowMs: now }) === 'fast', 'fast trap')
assert(publicFormTrap({ formStarted: now - 4000 }, { minMs: 2500, nowMs: now }) === null, 'clean pass')

const limited = createKeyedRateLimiter({ windowMs: 60_000, max: 2 })
assert(!limited('a'), 'first ok')
assert(!limited('a'), 'second ok')
assert(limited('a'), 'third blocked')
assert(!limited('b'), 'other key ok')

console.log('public-form-guard ok')
