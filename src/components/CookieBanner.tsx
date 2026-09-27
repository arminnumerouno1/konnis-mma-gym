import { useEffect, useRef, useState } from 'react'
import { COPY } from '../brand/copy'
import {
  applyConsent,
  onConsentChange,
  onConsentOpen,
  openConsentSettings,
  readConsent,
  syncConsentFromStore,
  type ConsentChoice,
} from '../lib/consent'
import { Link } from '../lib/Link'
import { href } from '../lib/router'

function firstChoice() {
  return typeof document === 'undefined' ? null : readConsent()
}

export function CookieBanner() {
  const first = firstChoice()
  const [open, setOpen] = useState(() => !first)
  const [details, setDetails] = useState(false)
  const [extras, setExtras] = useState(() => first?.extras ?? false)
  const [stored, setStored] = useState(() => Boolean(first))
  const boxRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef(false)

  useEffect(() => {
    syncConsentFromStore()
    return onConsentOpen(() => {
      const next = readConsent()
      setExtras(next?.extras ?? false)
      setStored(Boolean(next))
      setDetails(true)
      focusRef.current = true
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (open) document.documentElement.dataset.cookieOpen = '1'
    else delete document.documentElement.dataset.cookieOpen
    if (open && focusRef.current) {
      boxRef.current?.querySelector<HTMLElement>('button, a')?.focus()
      focusRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !stored) return
      setOpen(false)
      setDetails(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, stored])

  if (!open) return null

  function finish(nextExtras: boolean) {
    applyConsent(nextExtras)
    setExtras(nextExtras)
    setStored(true)
    setOpen(false)
    setDetails(false)
  }

  return (
    <div
      ref={boxRef}
      className={`cookie${details ? ' is-open' : ''}`}
      role="region"
      aria-labelledby="cookie-title"
    >
      <div className="cookie-inner">
        <div className="cookie-copy">
          <h2 id="cookie-title">{COPY.cookieTitle}</h2>
          <p>{COPY.cookieText}</p>
          <p className="cookie-links">
            <button className="cookie-text-btn" type="button" onClick={() => setDetails((v) => !v)}>
              {COPY.cookieSettings}
            </button>
            <span aria-hidden="true">·</span>
            <Link href={href('datenschutz')}>{COPY.cookiePrivacy}</Link>
          </p>
        </div>

        {details ? (
          <div className="cookie-details">
            <label className="cookie-row is-locked">
              <input type="checkbox" checked disabled />
              <span>
                <strong>{COPY.cookieNeededLabel}</strong>
                {COPY.cookieNeededHelp}
              </span>
            </label>
            <label className="cookie-row">
              <input type="checkbox" checked={extras} onChange={(event) => setExtras(event.target.checked)} />
              <span>
                <strong>{COPY.cookieExtraLabel}</strong>
                {COPY.cookieExtraHelp}
              </span>
            </label>
          </div>
        ) : null}

        <div className="cookie-actions">
          <button className="btn btn-ghost" type="button" onClick={() => finish(false)}>
            {COPY.cookieNeeded}
          </button>
          {details ? (
            <button className="btn btn-solid" type="button" onClick={() => finish(extras)}>
              {COPY.cookieSave}
            </button>
          ) : (
            <button className="btn btn-solid" type="button" onClick={() => finish(true)}>
              {COPY.cookieAll}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function CookieStatus() {
  const [choice, setChoice] = useState<ConsentChoice | null>(() => firstChoice())

  useEffect(() => onConsentChange(setChoice), [])

  const text = !choice ? COPY.cookieStatusNone : choice.extras ? COPY.cookieStatusAll : COPY.cookieStatusNeeded

  return (
    <p className="cookie-status">
      {text}{' '}
      <button className="cookie-text-btn" type="button" onClick={() => openConsentSettings()}>
        {COPY.cookieChange}
      </button>
    </p>
  )
}
