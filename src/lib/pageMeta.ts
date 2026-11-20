import { SEO, canonicalOrigin } from '../brand/seo'

type PageMeta = {
  title: string
  description: string
  path: string
}

function metaBy(attr: 'name' | 'property', key: string) {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (existing) return existing
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  document.head.appendChild(el)
  return el
}

function linkByRel(rel: string) {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (existing) return existing
  const el = document.createElement('link')
  el.rel = rel
  document.head.appendChild(el)
  return el
}

/** Client-side meta for SPA hub pages. Build-time head stays homepage-default. */
export function applyPageMeta({ title, description, path }: PageMeta) {
  const origin = canonicalOrigin(import.meta.env.VITE_SITE_URL ?? '')
  const url = `${origin}${path}`

  document.title = title
  metaBy('name', 'description').content = description
  metaBy('property', 'og:title').content = title
  metaBy('property', 'og:description').content = description
  metaBy('property', 'og:url').content = url
  metaBy('name', 'twitter:title').content = title
  metaBy('name', 'twitter:description').content = description
  linkByRel('canonical').href = url
}

export function resetHomeMeta() {
  applyPageMeta({
    title: SEO.title,
    description: SEO.description,
    path: '/',
  })
}
