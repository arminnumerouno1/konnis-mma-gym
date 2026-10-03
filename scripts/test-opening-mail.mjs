import { createOpeningMailHandler, openingMailHtml, openingMailSubject } from '../server/opening-mail.mjs'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

assert(openingMailSubject().includes('2. November'), 'subject date')
assert(openingMailSubject().includes('KONNI MMA GYM'), 'subject gym')
assert(openingMailSubject({ test: true }).startsWith('Test:'), 'test prefix')

const html = openingMailHtml({ first: 'Armin' })
assert(html.includes('Hi Armin,'), 'greeting')
assert(html.includes('danke, dass du dich vorangemeldet hast'), 'thanks you not everyone')
assert(!html.includes('danke für die ganzen Voranmeldungen'), 'not thanking one person for all signups')
assert(html.includes('wir sind begeistert'), 'excited')
assert(html.includes('mehr Voranmeldungen reingekommen'), 'volume of signups')
assert(html.includes('wir freuen uns auf dich'), 'looking forward to you')
assert(html.includes('Wenn du dich bis zum 2. November anmeldest, entfällt die Anmeldegebühr'), 'fee waived until opening')
assert(html.includes('nicht unter den ersten 50'), 'waitlist still gets a win')
assert(!html.includes('Das gilt für alle'), 'no gilt für alle')
assert(!html.includes('Sonderpreis der ersten 50'), 'no sonderpreis closer')
assert(html.includes('0€ nur bis 2. November, danach nicht mehr'), 'fee ends after 2 november')
assert(html.includes('Endlich hat das Warten ein Ende.'), 'wait is over')
assert(html.includes('Eröffnung am'), 'opening lead')
assert(html.includes('2. November 2026'), 'opening date')
assert(!html.includes('gebaut'), 'not claiming build is done')
assert(!html.includes('standest auf der Liste'), 'no list-while-building')
assert(html.includes('Wittenberger Straße 15'), 'street')
assert(html.includes('99,99€') && html.includes('109,99€') && html.includes('19,99€'), 'prices')
assert((html.match(/alle Kurse nutzbar/g) || []).length === 2, 'all courses usable')
assert(!html.includes('Unlimited Training'), 'no unlimited training')
assert(html.includes('Anmeldegebühr') && html.includes('0€'), 'fee')
assert(html.includes('Online Mitglied werden ist noch nicht möglich'), 'signup closed')
assert(html.includes('sobald es möglich ist, Mitglied zu werden'), 'when membership is possible')
assert(!html.includes('Mitglied werden geht'), 'no geht wording')
assert(html.includes('MMA-Profi Konrad Dyrschka'), 'konrad pro')
assert(html.includes('Endlich ein Top MMA Gym in Leipzig'), 'top gym')
assert(!html.includes('Endlich ein MMA Gym in Leipzig.'), 'not only gym')
assert(!html.includes('Abstecher'), 'no other-city detour')
assert(!html.includes('andere Stadt'), 'no other city')
assert(!html.includes('voll haben'), 'no voll haben')
assert(!html.includes('wenn es losgeht'), 'no losgeht closer')
assert(html.includes('konni-logo-mail.jpg') && html.includes('alt="KONNI MMA GYM"'), 'gym logo')
assert((html.match(/@konnimmagym/g) || []).length === 1, 'instagram once')
assert(!html.includes('Mail und Instagram'), 'no doubled instagram')
assert(!html.includes('Beides, damit du es mitkriegst'), 'no doubled channel')
assert(!/Halle/i.test(html), 'no halle')
assert(!html.includes('Käfig'), 'no cage line')
assert(!html.includes('Vertrag kannst du später'), 'no later contract')
assert(!html.includes('Zahlung erst'), 'no payment-on-open')
assert((html.match(/Mehmet/g) || []).length === 1, 'mehmet only in signoff')
assert(html.includes('Konrad und Mehmet'), 'signoff both')
assert(html.includes('ersten 50') && html.includes('extra eine eigene Mail'), 'first50 later')
assert(!html.includes('nur für euch'), 'no ihr for first50 in blast')
assert(!html.includes('89,99'), 'no first50 price in blast')
assert(!html.includes('/mitglied?invite='), 'no invite links')
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
  await handle({ method: 'POST', url: '/api/opening-mail', headers: {}, socket: { remoteAddress: '127.0.0.1' }, body: { email: 'armin@example.com' } }, res)
  const parsed = JSON.parse(captured.body)
  assert(captured.status === 403 && parsed.error === 'invite', 'opening mail needs secret')
}

console.log('opening mail tests ok')
