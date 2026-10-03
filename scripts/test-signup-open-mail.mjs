import {
  SIGNUP_OPEN_TEST_TO,
  createSignupOpenMailHandler,
  signupOpenMailHtml,
  signupOpenMailSubject,
  signupOpenRecipients,
} from '../server/signup-open-mail.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(signupOpenMailSubject().includes('Mitglied werden'), 'subject')
assert(signupOpenMailSubject().includes('KONNI MMA GYM'), 'subject gym')
assert(signupOpenMailSubject({ test: true }).startsWith('Test:'), 'test prefix')

const html = signupOpenMailHtml({ first: 'Armin' })
assert(html.includes('Hi Armin,'), 'greeting')
assert(html.includes('Du kannst jetzt online Mitglied werden.'), 'signup is open')
assert(!html.includes('noch nicht möglich'), 'not the old closed line')
assert(html.includes('https://www.mma-in-leipzig.de/mitglied'), 'join link')
assert(!html.includes('/mitglied?invite='), 'no invite link')
assert(html.includes('99,99€') && html.includes('109,99€'), 'public prices')
assert(!html.includes('89,99') && !html.includes('19,99') && !html.includes('Day Pass'), 'no first50 price and no day pass')
assert(html.includes('0€ nur bis 2. November, danach 49€'), 'fee window')
assert(html.includes('Das Studio eröffnet am 2. November 2026.'), 'studio opens 2 november')
assert(html.includes('Vorher gibt es kein Training.'), 'no training before opening')
assert(html.includes('1. November 2026'), 'first charge')
assert(html.includes('Vorher geht nichts vom Konto.'), 'nothing before opening charge')
assert(html.includes('Karte oder Apple Pay'), 'card')
assert(html.includes('Banküberweisung'), 'transfer')
assert(html.includes('SEPA-Lastschrift kommt später.'), 'sepa later')
assert(!/ersten\s+50|First 50|persönlichen Link/i.test(html), 'no first 50 in this mail')
assert(!html.includes('Bist du schon Mitglied'), 'no already-member line')
assert(html.includes('Konrad und Mehmet'), 'signoff')
assert(html.includes('Wittenberger Straße 15'), 'street')
assert(html.includes('konni-logo-mail.jpg'), 'logo')
assert(!html.includes('<script'), 'no script')
assert(!/Halle/i.test(html), 'no halle')
assert(!signupOpenMailHtml({ first: '<x>' }).includes('<x>'), 'escaped name')
assert(signupOpenMailHtml({}).includes('Hi,'), 'empty name')

const people = signupOpenRecipients([
  { name: 'Anna Müller', email: 'anna@example.com', first50: true },
  { name: 'Ben Kurz', email: 'ben@example.com', first50: false, extraEmails: ['ben2@example.com'] },
  { name: 'Cem Ohne', email: 'keine-mail', first50: false },
  { name: 'Dora Doppelt', email: 'ben@example.com', first50: false },
  { name: 'Eva Auch', email: 'anna@example.com', extraEmails: ['anna-zweit@example.com'], first50: false },
])
assert(people.map((row) => row.email).join(',') === 'ben@example.com,ben2@example.com', 'only people outside the first 50')
assert(people[0].first === 'Ben', 'first name')

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

const proof = 'signup-mail-proof-test'
const env = { SIGNUP_MAIL_PROOF: proof, BREVO_API_KEY: 'xkeysib-test' }

{
  let called = false
  const handle = createSignupOpenMailHandler({
    env,
    fetchImpl: async () => {
      called = true
      return { ok: true, text: async () => '{"messageId":"1"}' }
    },
  })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: { proof, email: 'andere@example.com', name: 'Andere', test: true },
    },
    res,
  )
  assert(captured.status === 403 && !called, 'other address is refused')
}

{
  let payload = null
  const handle = createSignupOpenMailHandler({
    env,
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body)
      return { ok: true, text: async () => '{"messageId":"1"}' }
    },
  })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: { proof, email: SIGNUP_OPEN_TEST_TO, name: 'Armin Scholtz', test: true },
    },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 200 && parsed.ok && parsed.test, 'test accepted')
  assert(payload.to[0].email === SIGNUP_OPEN_TEST_TO, 'brevo recipient')
  assert(payload.subject.startsWith('Test:'), 'brevo subject')
  assert(payload.htmlContent.includes('Hi Armin,'), 'brevo greeting')
  assert(!payload.htmlContent.includes('89,99'), 'brevo has no first50 price')
  assert(!String(payload.headers?.['api-key'] || payload).includes('unused'), 'shape')
  assert(payload.headers == null, 'key stays in headers not body')
}

{
  const handle = createSignupOpenMailHandler({
    env,
    fetchImpl: async () => {
      throw new Error('should not send')
    },
  })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: { proof: 'falsch-und-zu-kurz', email: SIGNUP_OPEN_TEST_TO, test: true },
    },
    res,
  )
  assert(captured.status === 403, 'bad proof')
}

{
  const handle = createSignupOpenMailHandler({
    env,
    fetchImpl: async () => {
      throw new Error('should not send')
    },
  })
  const { res, captured } = mockRes()
  await handle(
    {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      body: { proof, email: SIGNUP_OPEN_TEST_TO, all: true },
    },
    res,
  )
  assert(captured.status === 403, 'list send refused')
}

console.log('signup-open mail ok')
