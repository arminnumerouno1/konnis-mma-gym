export type ConsentChoice = {
  extras: boolean
  at: number
  v: number
}

export const CONSENT_COOKIE = 'konni_consent'
export const CONSENT_DAYS = 180
export const CONSENT_VERSION = 1

const LEGACY_EXTRAS_COOKIE = 'konni_media'
const STORAGE_KEY = 'konni_consent'
const OPEN_EVENT = 'konni-consent-open'
const CHANGE_EVENT = 'konni-consent-change'
const MAX_AGE_MS = CONSENT_DAYS * 86400 * 1000

function cookieSecure() {
  return window.location.protocol === 'https:' ? '; Secure' : ''
}

function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${days * 86400}; SameSite=Lax${cookieSecure()}`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${cookieSecure()}`
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const row = document.cookie.split('; ').find((part) => part.startsWith(prefix))
  return row ? decodeURIComponent(row.slice(prefix.length)) : null
}

function storageGet() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storageSet(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* private mode or blocked storage */
  }
}

export function isChoiceCurrent(choice: ConsentChoice, now = Date.now()) {
  if (choice.v !== CONSENT_VERSION) return false
  if (now - choice.at > MAX_AGE_MS) return false
  return true
}

export function parseChoice(raw: string | null): ConsentChoice | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as { extras?: boolean; at?: number; v?: number }
    if (typeof data.extras !== 'boolean') return null
    return {
      extras: data.extras,
      at: Number(data.at) || 0,
      v: Number(data.v) || 0,
    }
  } catch {
    return null
  }
}

function applyFlag(extras: boolean) {
  if (extras) document.documentElement.dataset.consentExtras = '1'
  else delete document.documentElement.dataset.consentExtras
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === 'undefined') return null
  const choice = parseChoice(readCookie(CONSENT_COOKIE)) ?? parseChoice(storageGet())
  if (!choice || !isChoiceCurrent(choice)) return null
  return choice
}

export function hasExtrasConsent() {
  return readConsent()?.extras === true
}

export function applyConsent(extras: boolean) {
  const choice: ConsentChoice = { extras, at: Date.now(), v: CONSENT_VERSION }
  const raw = JSON.stringify(choice)
  writeCookie(CONSENT_COOKIE, raw, CONSENT_DAYS)
  storageSet(raw)
  clearCookie(LEGACY_EXTRAS_COOKIE)
  applyFlag(extras)
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: choice }))
  return choice
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function onConsentOpen(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler)
  return () => window.removeEventListener(OPEN_EVENT, handler)
}

export function onConsentChange(handler: (choice: ConsentChoice) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<ConsentChoice>).detail)
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

export function syncConsentFromStore() {
  const choice = readConsent()
  applyFlag(choice?.extras === true)
  return choice
}
