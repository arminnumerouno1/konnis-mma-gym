import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContactHandler, isTrialOpen, TRIAL_OPEN } from '../server/contact.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(TRIAL_OPEN === false, 'trial closed until launch')
assert(isTrialOpen({}) === false, 'closed default')
assert(isTrialOpen({ TRIAL_OPEN: 'true' }) === true, 'env override open')
assert(isTrialOpen({ TRIAL_OPEN: 'false' }) === false, 'env override closed')

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

const dataDir = join(tmpdir(), `konni-contact-${process.pid}`)
mkdirSync(dataDir, { recursive: true })

{
  const handle = createContactHandler({ dataDir, env: {} })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      url: '/api/kontakt',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: { name: 'Anna Müller', email: 'anna@example.com', phone: '+49 171 1234567', interest: 'MMA' },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 403 && parsed.ok === false && parsed.error === 'closed', 'handler rejects closed trial')
}

console.log('contact tests ok')
