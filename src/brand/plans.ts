export const PLAN_IDS = ['standard', 'flex', 'daypass'] as const

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
      'Unlimited Training',
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
      'Unlimited Training',
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
      'Unlimited Training an diesem Tag',
      'Kein Monatsvertrag',
      'Vor Ort oder online vormerken',
      'Hausordnung gilt trotzdem',
    ],
    contract: 'day',
  },
]

export const SIGNUP_FEE = 0
export const PAYMENT_NOTE =
  'Du überweist den Beitrag selbst so, dass er spätestens am 1. des Monats da ist. Die Kontoverbindung schicken wir dir vor der Eröffnung.'

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find((plan) => plan.id === id)
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value)
}
