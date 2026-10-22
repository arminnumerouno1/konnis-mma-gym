export const PLAN_IDS = ['slowstart', 'standard', 'flex', 'plus', 'daypass', 'first50'] as const

export type PlanId = (typeof PLAN_IDS)[number]

export type Plan = {
  id: PlanId
  name: string
  tag: string
  price: string
  priceValue: number
  unit: string
  term: string
  termMonths: number | null
  accent: 'red' | 'white' | 'gold' | 'pink'
  limited?: boolean
  limit?: number
  /** Leistungsumfang auf Karten und im Anmeldeformular. */
  includes: string
  bullets: string[]
  contract: '6' | '12' | '24' | 'day'
}

const INCLUDES_ALL =
  'Alle Kurse inklusive: MMA, Boxen, BJJ und mehr. So oft du willst – nicht nur 2× die Woche.'
const INCLUDES_SLOWSTART =
  '2 Kurse / Einheiten pro Woche. MMA, Boxen, BJJ und mehr – für alle, die es erstmal ruhiger angehen wollen.'

export const PLANS: Plan[] = [
  {
    id: 'slowstart',
    name: 'Slow Start Tarif',
    tag: '12 Monate',
    price: '79,99',
    priceValue: 79.99,
    unit: '/ Monat',
    term: '12 Monate Laufzeit',
    termMonths: 12,
    accent: 'white',
    includes: INCLUDES_SLOWSTART,
    bullets: [
      '2 Kurse / Einheiten pro Woche',
      'Zahlung erst ab echter Eröffnung',
      'Kündigung 1 Monat zum Laufzeitende',
    ],
    contract: '12',
  },
  {
    id: 'standard',
    name: 'Standard',
    tag: '24 Monate',
    price: '99,99',
    priceValue: 99.99,
    unit: '/ Monat',
    term: '24 Monate Laufzeit',
    termMonths: 24,
    accent: 'white',
    includes: INCLUDES_ALL,
    bullets: [
      'Volle Mitgliedschaft',
      'Zahlung erst ab echter Eröffnung',
      'Kündigung 1 Monat zum Laufzeitende',
    ],
    contract: '24',
  },
  {
    id: 'flex',
    name: 'Flex',
    tag: '12 Monate',
    price: '109,99',
    priceValue: 109.99,
    unit: '/ Monat',
    term: '12 Monate Laufzeit',
    termMonths: 12,
    accent: 'gold',
    includes: INCLUDES_ALL,
    bullets: [
      'Kürzere Erstlaufzeit',
      'Zahlung erst ab echter Eröffnung',
      'Kündigung 1 Monat zum Laufzeitende',
    ],
    contract: '12',
  },
  {
    id: 'plus',
    name: 'Plus',
    tag: '6 Monate',
    price: '119,00',
    priceValue: 119,
    unit: '/ Monat',
    term: '6 Monate Laufzeit',
    termMonths: 6,
    accent: 'pink',
    includes: INCLUDES_ALL,
    bullets: [
      'Kurze Erstlaufzeit',
      'Zahlung erst ab echter Eröffnung',
      'Kündigung 1 Monat zum Laufzeitende',
    ],
    contract: '6',
  },
  {
    id: 'daypass',
    name: 'Day Pass',
    tag: 'Admit one',
    price: '19,99',
    priceValue: 19.99,
    unit: '/ Tag',
    term: 'Ein Trainingstag',
    termMonths: null,
    accent: 'pink',
    includes: 'Alle Kurse an diesem Tag: MMA, Boxen, BJJ und mehr.',
    bullets: [
      'Alle Kurse an diesem Tag: MMA, Boxen, BJJ und mehr',
      'Kein Monatsvertrag',
      'Vor Ort oder online vormerken',
      'Hausordnung gilt trotzdem',
    ],
    contract: 'day',
  },
]

export const FIRST50: Plan = {
  id: 'first50',
  name: 'First 50',
  tag: 'Nur per Einladung',
  price: '89,99',
  priceValue: 89.99,
  unit: '/ Monat',
  term: '24 Monate Laufzeit',
  termMonths: 24,
  accent: 'red',
  limited: true,
  limit: 50,
  includes: INCLUDES_ALL,
  bullets: [
    '89,99€ statt 99,99€',
    'Nur für die Voranmeldung, persönlicher Link',
    'Zahlung erst ab echter Eröffnung',
  ],
  contract: '24',
}

const ALL_PLANS: Plan[] = [...PLANS, FIRST50]

/** Online-Day-Pass. false blendet die Tageskarte aus, bis sie wieder angeboten wird. Muss zu server/membership.mjs DAY_PASS_OPEN passen. */
export const DAY_PASS_OPEN = false

export const PUBLIC_PLANS: Plan[] = DAY_PASS_OPEN ? PLANS : PLANS.filter((plan) => plan.id !== 'daypass')

/** Online-Mitgliedschaft. false sperrt das Formular wieder. */
export const SIGNUP_OPEN = true

/** Probetraining-Anfrage. Auf true, wenn Einheiten wieder angefragt werden können. */
export const TRIAL_OPEN = false

export const SIGNUP_FEE = 0
/** Erste volle Monatsabbuchung. Muss zu server/stripe-checkout.mjs BILLING_START passen. */
export const FIRST_CHARGE = '2026-11-01'
export const PAYMENT_NOTE =
  'Der Mitgliedsbeitrag ist jeweils zum 1. des Monats fällig. Du zahlst mit Karte oder Apple Pay, oder per Banküberweisung auf das Konto der KONNI MMA GYM GbR, IBAN DE77 8605 5592 1090 4292 70, BIC WELADE8LXXX, Stadt- und Kreissparkasse Leipzig. SEPA-Lastschrift kommt später. Wer vor der Eröffnung abschließt, zahlt erstmals am 1. November 2026. Vorher geht nichts vom Konto. Die Aufnahmegebühr von 0 € gilt nur bis zum 2. November 2026. Danach beträgt sie 49 €.'

export function planById(id: string | null | undefined): Plan | undefined {
  return ALL_PLANS.find((plan) => plan.id === id)
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value)
}

export function isPublicPlanId(value: string): value is Exclude<PlanId, 'first50'> {
  if (!isPlanId(value) || value === 'first50') return false
  if (value === 'daypass' && !DAY_PASS_OPEN) return false
  return true
}
