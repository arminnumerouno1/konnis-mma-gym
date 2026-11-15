import { createOpeningMailHandler, openingMailHtml, openingMailSubject } from '../server/opening-mail.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(openingMailSubject().includes('offen'), 'subject open')
assert(openingMailSubject().includes('KONNI MMA GYM'), 'subject gym')
assert(openingMailSubject({ test: true }).startsWith('Test:'), 'test prefix')

const html = openingMailHtml({ first: 'Armin' })
assert(html.includes('Hi Armin,'), 'greeting')
assert(html.includes('ist geöffnet'), 'open now')
assert(html.includes('keine Warteliste mehr'), 'no waitlist')
assert(!html.includes('2. November'), 'no opening date marketing')
assert(html.includes('WIR SIND OFFEN'), 'hero open')
assert(html.includes('Training läuft'), 'training running')
assert(html.includes('Wittenberger Straße 15'), 'street')
assert(html.includes('79,99€') && html.includes('99,99€') && html.includes('109,99€'), 'prices')
assert(html.includes('Anmeldegebühr') && html.includes('19,99€'), 'fee')
assert(html.includes('Jetzt Mitglied werden'), 'cta')
assert(html.includes('/mitglied'), 'join link')
assert(!html.includes('Online Mitglied werden ist noch nicht möglich'), 'no closed signup')
assert(!html.includes('sobald es möglich ist, Mitglied zu werden'), 'no later membership')
assert(!html.includes('Die Tür geht auf'), 'no pre-opening hero')
assert(!html.includes('Endlich hat das Warten ein Ende'), 'no waiting slogan')
assert(html.includes('MMA-Profi Konrad Dyrschka'), 'konrad pro')
assert(html.includes('Endlich ein Top MMA Gym in Leipzig'), 'top gym')
assert(html.includes('konni-logo-mail.jpg') && html.includes('alt="KONNI MMA GYM"'), 'gym logo')
assert((html.match(/@konnimmagym/g) || []).length === 1, 'instagram once')
assert(html.includes('Konrad und Mehmet'), 'signoff both')
assert(!html.includes('<script'), 'no script')
assert(!openingMailHtml({ first: '<x>' }).includes('<x>'), 'escaped name')

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
  const handle = createOpeningMailHandler({ env: { INVITE_SECRET: 'test-invite-secret-key', BREVO_API_KEY: 'x' } })
  const { res, captured } = mockRes()
  await handle(
    { method: 'POST', url: '/api/opening-mail', headers: {}, socket: { remoteAddress: '127.0.0.1' }, body: { email: 'armin@example.com' } },
    res,
  )
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 403 && parsed.error === 'invite', 'opening mail needs secret')
}

console.log('opening mail tests ok')
