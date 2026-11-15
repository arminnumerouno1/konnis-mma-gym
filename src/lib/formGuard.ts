import { useRef } from 'react'

/** Epoch ms when the public form became interactive — sent as formStarted. */
export function useFormStarted() {
  const started = useRef(Date.now())
  return started.current
}

export function honeypotInputProps() {
  return {
    name: 'company' as const,
    type: 'text' as const,
    tabIndex: -1,
    autoComplete: 'off' as const,
    'aria-hidden': true as const,
    className: 'form-hp',
  }
}
