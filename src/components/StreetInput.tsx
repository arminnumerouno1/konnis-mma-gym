import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export type AddressPick = { street: string; zip: string; city: string }

type Suggestion = { street: string; housenumber: string; zip: string; city: string; district: string }

const HOUSE_NUMBER = /\s(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+[a-zA-Z]?)?)\s*$/

function typedNumber(value: string) {
  return HOUSE_NUMBER.exec(value)?.[1]?.replace(/\s+/g, '') ?? ''
}

function lineOf(item: Suggestion, fallbackNumber: string) {
  const number = item.housenumber || fallbackNumber
  return number ? `${item.street} ${number}` : item.street
}

export function StreetInput({
  value,
  onChange,
  onPick,
  required,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onPick: (pick: AddressPick) => void
  required?: boolean
  placeholder?: string
}) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = useRef(false)
  const listId = useId()

  useEffect(() => {
    if (!typed.current) return
    const q = value.trim()
    if (q.length < 3) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/address?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { suggestions: [] }))
        .then((data: { suggestions?: Suggestion[] }) => {
          setItems(data.suggestions ?? [])
          setActive(-1)
          setOpen(Boolean(data.suggestions?.length))
        })
        .catch(() => undefined)
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  function pick(item: Suggestion) {
    typed.current = false
    onPick({ street: lineOf(item, typedNumber(value)), zip: item.zip, city: item.city })
    setOpen(false)
    setItems([])
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      pick(items[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const fallbackNumber = typedNumber(value)

  return (
    <span className="street-input">
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="address-line1"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          typed.current = true
          const next = event.target.value
          if (next.trim().length < 3) {
            setOpen(false)
            setItems([])
          }
          onChange(next)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(items.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open ? (
        <ul className="street-suggest" id={listId} role="listbox">
          {items.map((item, index) => (
            <li
              key={`${item.street}-${item.housenumber}-${item.zip}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'is-active' : ''}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(item)
              }}
            >
              <strong>{lineOf(item, fallbackNumber)}</strong>
              <small>
                {item.zip} {item.city}
                {item.district && item.district !== item.city ? ` · ${item.district}` : ''}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  )
}
