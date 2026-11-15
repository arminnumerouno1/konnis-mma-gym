/** Empfängerkonto für die monatliche Überweisung. Kein Stripe-Konto. */
export const GYM_BANK = {
  holder: 'KONNI MMA GYM GbR',
  iban: 'DE77860555921090429270',
  bic: 'WELADE8LXXX',
  bank: 'Stadt- und Kreissparkasse Leipzig',
}

export function spacedIban(iban) {
  return String(iban ?? '')
    .replace(/\s/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}
