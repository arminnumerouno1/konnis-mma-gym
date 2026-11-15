const PHOTON = 'https://photon.komoot.io/api/'
const LEIPZIG = { lat: 51.34, lon: 12.37 }
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 90
const CACHE_MAX = 400
const TIMEOUT_MS = 3500

const hits = new Map()
const cache = new Map()

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > RATE_MAX
}

function reply(res, status, body, maxAge = 0) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', maxAge ? `public, max-age=${maxAge}` : 'no-store')
  res.end(JSON.stringify(body))
}

export function toSuggestions(features) {
  const seen = new Set()
  const out = []
  for (const feature of features ?? []) {
    const p = feature?.properties ?? {}
    if (p.countrycode !== 'DE' || !p.postcode) continue
    const street = p.type === 'street' ? p.name : p.street
    if (!street) continue
    const city = p.city || p.town || p.village || p.county || ''
    if (!city) continue
    const housenumber = p.type === 'house' ? String(p.housenumber ?? '') : ''
    const key = `${street}|${housenumber}|${p.postcode}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ street, housenumber, zip: String(p.postcode).slice(0, 5), city, district: p.district || '' })
  }
  return out
}

export function createAddressHandler({ fetchImpl = globalThis.fetch } = {}) {
  return async function handleAddress(req, res) {
    if (req.method !== 'GET') {
      reply(res, 405, { ok: false, error: 'method' })
      return
    }
    const url = new URL(req.url || '/', 'http://localhost')
    const q = String(url.searchParams.get('q') ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (q.length < 3 || q.length > 120) {
      reply(res, 200, { ok: true, suggestions: [] })
      return
    }
    if (rateLimited(clientIp(req))) {
      reply(res, 429, { ok: false, error: 'rate' })
      return
    }
    const key = q.toLowerCase()
    if (cache.has(key)) {
      reply(res, 200, { ok: true, suggestions: cache.get(key) }, 86400)
      return
    }
    const target = new URL(PHOTON)
    target.searchParams.set('q', q)
    target.searchParams.set('lang', 'de')
    target.searchParams.set('limit', '10')
    target.searchParams.set('lat', String(LEIPZIG.lat))
    target.searchParams.set('lon', String(LEIPZIG.lon))
    target.searchParams.append('layer', 'house')
    target.searchParams.append('layer', 'street')
    try {
      const upstream = await fetchImpl(target, {
        headers: { accept: 'application/json', 'user-agent': 'konni-mma-gym/1.0 (info@mma-in-leipzig.de)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!upstream.ok) throw new Error(`photon ${upstream.status}`)
      const data = await upstream.json()
      const suggestions = toSuggestions(data.features).slice(0, 6)
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
      cache.set(key, suggestions)
      reply(res, 200, { ok: true, suggestions }, 86400)
    } catch (error) {
      console.warn('[address]', error?.message ?? error)
      reply(res, 200, { ok: true, suggestions: [] })
    }
  }
}
