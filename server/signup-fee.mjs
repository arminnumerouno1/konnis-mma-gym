import { berlinIsoDate, OPENING_DATE } from './opening.mjs'

/** Aufnahmegebühr 0 € bis einschließlich Eröffnungstag, danach 49 €. */
export const FEE_FREE_UNTIL = OPENING_DATE
export const FEE_AFTER_OPENING = 49

/**
 * @param {string | Date} [when] ISO-Tag oder Date (Berlin-Kalender bei Date)
 * @param {string} [plan]
 */
export function signupFeeFor(when = new Date(), plan = '') {
  if (plan === 'daypass' || plan === 'first50') return 0
  const day =
    when instanceof Date
      ? berlinIsoDate(when)
      : String(when ?? '')
          .slice(0, 10)
          .trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return FEE_AFTER_OPENING
  return day <= FEE_FREE_UNTIL ? 0 : FEE_AFTER_OPENING
}
