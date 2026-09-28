import { useEffect, useState } from 'react'
import { parseLocation, type Route } from './router'

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'home', path: '/', hash: '', plan: null, invite: null } : parseLocation(),
  )

  useEffect(() => {
    const sync = () => setRoute(parseLocation())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return route
}
