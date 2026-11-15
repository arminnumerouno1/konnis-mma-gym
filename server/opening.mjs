/** Muss zu src/brand/gym.ts openingDate passen. */
export const OPENING_DATE = '2026-11-02'

export function berlinIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Training gibt es frühestens am Eröffnungstag. Davor ist kein vorzeitiger Start möglich. */
export function trainingHasStarted(date = new Date()) {
  const value = date instanceof Date ? berlinIsoDate(date) : String(date).slice(0, 10)
  return value >= OPENING_DATE
}
