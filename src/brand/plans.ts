export const PLAN_IDS = ['standard', 'flex', 'daypass', 'first50'] as const

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
  bullets: string[]
  contract: '12' | '24' | 'day'
}

export const PLANS: Plan[] = [
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
    bullets: [
      'Alle Kurse nutzbar',
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
    bullets: [
      'Alle Kurse nutzbar',
      'Kürzere Erstlaufzeit',
      'Zahlung erst ab echter Eröffnung',
      'Kündigung 1 Monat zum Laufzeitende',
    ],
    contract: '12',
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
    bullets: [
      'Alle Kurse nutzbar an diesem Tag',
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
  bullets: [
    '89,99€ statt 99,99€',
    'Alle Kurse nutzbar',
    'Nur für die Voranmeldung, persönlicher Link',
    'Zahlung erst ab echter Eröffnung',
  ],
  contract: '24',
}

const ALL_PLANS: Plan[] = [...PLANS, FIRST50]

/** Online-Mitgliedschaft. Auf true, wenn der Vertrag wieder angenommen wird. */
export const SIGNUP_OPEN = false

/** Probetraining-Anfrage. Auf true, wenn Einheiten wieder angefragt werden können. */
export const TRIAL_OPEN = false

export const SIGNUP_FEE = 0
export const PAYMENT_NOTE =
  'Bei 12- und 24-Monats-Verträgen ziehen wir den Monatsbeitrag per SEPA-Lastschrift ein, in der Regel zum 1. des Monats. Mandat und Kontodaten klären wir vor dem ersten Einzug. Zahlungspflicht erst ab echter Eröffnung.'

export function planById(id: string | null | undefined): Plan | undefined {
  return ALL_PLANS.find((plan) => plan.id === id)
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value)
}

export function isPublicPlanId(value: string): value is Exclude<PlanId, 'first50'> {
  return value !== 'first50' && isPlanId(value)
}
