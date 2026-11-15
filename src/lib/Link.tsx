import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { navigate } from './router'

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: ReactNode
}

function modified(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

export function Link({ href, children, className, onClick, ...rest }: LinkProps) {
  return (
    <a
      {...rest}
      href={href}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event)
        if (event.defaultPrevented || modified(event)) return
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        event.preventDefault()
        navigate(`${url.pathname}${url.search}${url.hash}`)
      }}
    >
      {children}
    </a>
  )
}
