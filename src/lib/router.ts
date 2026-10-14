export type RouteName =
  | 'home'
  | 'join'
  | 'prereg'
  | 'impressum'
  | 'datenschutz'
  | 'agb'
  | 'widerruf'
  | 'hausordnung'
  | 'vertrag6'
  | 'vertrag12'
  | 'vertrag24'
  | 'admin'
  | 'notfound'

export type Route = {
  name: RouteName
  path: string
  hash: string
  plan: string | null
  invite: string | null
}

export const PATHS: Record<Exclude<RouteName, 'notfound'>, string> = {
  home: '/',
  join: '/mitglied',
  prereg: '/voranmeldung',
  impressum: '/impressum',
  datenschutz: '/datenschutz',
  agb: '/agb',
  widerruf: '/widerruf',
  hausordnung: '/hausordnung',
  vertrag6: '/vertrag/6',
  vertrag12: '/vertrag/12',
  vertrag24: '/vertrag/24',
  admin: '/verwaltung',
}

function cleanPath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function parseLocation(url = window.location.href): Route {
  const parsed = new URL(url, window.location.origin)
  const path = cleanPath(parsed.pathname)
  const plan = parsed.searchParams.get('plan')
  const invite = parsed.searchParams.get('invite')
  const hash = parsed.hash

  const match = (Object.entries(PATHS) as [Exclude<RouteName, 'notfound'>, string][]).find(
    ([, value]) => value === path,
  )
  if (match) {
    return { name: match[0], path, hash, plan, invite }
  }
  if (path === '/impressum.html') {
    return { name: 'impressum', path: PATHS.impressum, hash, plan, invite }
  }
  return { name: 'notfound', path, hash, plan, invite }
}

export function href(name: Exclude<RouteName, 'notfound'>, query?: Record<string, string>) {
  const path = PATHS[name]
  if (!query) return path
  const params = new URLSearchParams(query)
  return `${path}?${params.toString()}`
}

export function scrollPageTop() {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

export function navigate(path: string) {
  if (path === `${window.location.pathname}${window.location.search}${window.location.hash}`) return
  window.history.pushState({}, '', path)
  const next = new URL(path, window.location.origin)
  if (!next.hash) scrollPageTop()
  window.dispatchEvent(new PopStateEvent('popstate'))
}
