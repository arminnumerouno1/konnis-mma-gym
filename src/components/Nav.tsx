import { useEffect, useState } from 'react'
import { COPY } from '../brand/copy'
import { GYM } from '../brand/gym'
import { TRIAL_OPEN } from '../brand/plans'
import { Link } from '../lib/Link'
import { href, type Route } from '../lib/router'

type NavProps = {
  route: Route
}

export function Nav({ route }: NavProps) {
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '/#training', label: COPY.navTraining },
    { href: '/#plan', label: COPY.navPlan },
    { href: '/#team', label: COPY.navTeam },
    { href: '/#preise', label: COPY.navPlans },
    ...(TRIAL_OPEN ? [{ href: '/#probetraining', label: COPY.navTrial }] : []),
    { href: '/#kontakt', label: COPY.navContact },
  ]

  return (
    <header className={`nav ${solid || route.name !== 'home' ? 'is-solid' : ''} ${open ? 'is-open' : ''}`}>
      <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
        <img src={GYM.logo} alt={GYM.name} width={1036} height={1125} />
        <span>
          {COPY.gymName}
          <small>Leipzig</small>
        </span>
      </Link>

      <button
        className="nav-burger"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
        <span className="sr-only">Menü</span>
      </button>

      <nav id="site-nav" className="nav-links">
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href={href('join')} className="nav-cta" onClick={() => setOpen(false)}>
          {COPY.ctaJoin}
        </Link>
      </nav>
    </header>
  )
}
