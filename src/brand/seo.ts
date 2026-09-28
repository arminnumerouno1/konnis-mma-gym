import { COPY, FAQ } from './copy.ts'
import { GYM, GYM_ADDRESS } from './gym.ts'
import { PLANS } from './plans.ts'

export const CANONICAL_ORIGIN = 'https://www.mma-in-leipzig.de'

export const SEO = {
  title: 'MMA Gym in Leipzig | KONNI MMA GYM | BJJ & Boxen',
  shortTitle: 'MMA Leipzig',
  description:
    'MMA Gym in Leipzig: MMA, Ringen, BJJ, Boxen und Kick- & Thai-Boxen im KONNI MMA GYM. Wittenberger Straße 15. Jetzt Mitglied werden.',
  ogImagePath: '/og-image.jpg',
  ogImageAlt: 'KONNI MMA GYM Leipzig – das MMA-Gym von MMA-Profi Konrad Dyrschka.',
  locale: 'de_DE',
  siteName: 'KONNI MMA GYM',
  themeColor: '#070707',
  keywords:
    'MMA in Leipzig, Ringen in Leipzig, BJJ in Leipzig, Boxen in Leipzig, Kick- & Thai-Boxen in Leipzig, MMA Gym Leipzig, MMA Training Leipzig, Kickboxen Leipzig, Thai-Boxen Leipzig, Kampfsport Leipzig, KONNI MMA GYM, Konrad Dyrschka, Mitgliedschaft MMA Leipzig',
} as const

export function canonicalOrigin(envUrl = ''): string {
  const raw = envUrl.trim()
  if (!raw) return CANONICAL_ORIGIN
  try {
    const url = new URL(raw)
    if (url.hostname === 'mma-in-leipzig.de' || url.hostname === 'www.mma-in-leipzig.de') {
      return CANONICAL_ORIGIN
    }
    return url.origin
  } catch {
    return CANONICAL_ORIGIN
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const PAGE_PATHS = ['/', '/mitglied', '/impressum', '/datenschutz', '/agb', '/widerruf', '/hausordnung']

export function buildSeoHead(siteUrl = ''): string {
  const origin = canonicalOrigin(siteUrl)
  const image = `${origin}${SEO.ogImagePath}`
  const pageUrl = `${origin}/`

  const graph = [
    {
      '@type': 'WebSite',
      name: SEO.siteName,
      alternateName: ['Konni MMA Gym', 'KONNI MMA GYM Leipzig', 'KONNIMMAGYM'],
      description: SEO.description,
      inLanguage: 'de-DE',
      url: pageUrl,
    },
    {
      '@type': 'SportsActivityLocation',
      name: SEO.siteName,
      legalName: GYM.legalName,
      alternateName: 'KONNI MMA GYM Leipzig',
      description: SEO.description,
      image,
      url: pageUrl,
      email: GYM.email,
      telephone: GYM.phone,
      sameAs: [GYM.instagram, GYM.whatsapp],
      address: {
        '@type': 'PostalAddress',
        streetAddress: GYM.street,
        postalCode: GYM.zip,
        addressLocality: GYM.city,
        addressRegion: 'SN',
        addressCountry: 'DE',
      },
      areaServed: { '@type': 'City', name: 'Leipzig' },
      sport: ['Mixed Martial Arts', 'MMA', 'Wrestling', 'Brazilian Jiu-Jitsu', 'Boxing', 'Kickboxing', 'Muay Thai'],
      founder: GYM.partners.map((name: string) => ({
        '@type': 'Person',
        name,
        jobTitle: name === 'Konrad Dyrschka' ? 'MMA-Profi' : 'Gesellschafter',
      })),
    },
  ]

  const jsonLd = { '@context': 'https://schema.org', '@graph': graph }

  const lines = [
    `<title>${escapeHtml(SEO.title)}</title>`,
    `<meta name="description" content="${escapeHtml(SEO.description)}" />`,
    `<meta name="keywords" content="${escapeHtml(SEO.keywords)}" />`,
    `<meta name="author" content="${escapeHtml(GYM.legalName)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<meta name="googlebot" content="index, follow" />`,
    `<meta name="geo.region" content="DE-SN" />`,
    `<meta name="geo.placename" content="Leipzig" />`,
    `<meta name="geo.position" content="51.37;12.39" />`,
    `<meta name="language" content="de" />`,
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SEO.siteName)}" />`,
    `<meta property="og:locale" content="${SEO.locale}" />`,
    `<meta property="og:title" content="${escapeHtml(SEO.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(SEO.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(SEO.ogImageAlt)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(SEO.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(SEO.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(SEO.ogImageAlt)}" />`,
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(SEO.shortTitle)}" />`,
    `<meta name="application-name" content="${escapeHtml(SEO.siteName)}" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`,
    `<link rel="image_src" href="${escapeHtml(image)}" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ]

  return lines.join('\n    ')
}

export function buildSeoBody(): string {
  const disciplines = COPY.disciplines
    .map(
      (item) => `      <h3>${escapeHtml(item.name)} ${escapeHtml(COPY.disciplinePlace)}</h3>
      <p><strong>${escapeHtml(item.tagline)}</strong> ${escapeHtml(item.text)}</p>`,
    )
    .join('\n')

  const people = COPY.whoPeople
    .map(([name, text]) => `      <p><strong>${escapeHtml(name)}:</strong> ${escapeHtml(text)}</p>`)
    .join('\n')

  const plans = PLANS.map(
    (plan) =>
      `      <p><strong>${escapeHtml(plan.name)}</strong> ${escapeHtml(plan.price)}€ ${escapeHtml(plan.unit)}, ${escapeHtml(plan.term)}. ${plan.bullets.map(escapeHtml).join(' ')}</p>`,
  ).join('\n')

  const faq = FAQ.map(
    (item) => `      <h3>${escapeHtml(item.q)}</h3>
      <p>${escapeHtml(item.a)}</p>`,
  ).join('\n')

  const about = COPY.aboutParas.map((para) => `    <p>${escapeHtml(para)}</p>`).join('\n')

  return `<article id="seo-crawl">
    <nav aria-label="Seitenübersicht">
      <a href="/">${escapeHtml(COPY.gymName)}</a>
      <a href="/#training">${escapeHtml(COPY.navTraining)}</a>
      <a href="/#team">${escapeHtml(COPY.navTeam)}</a>
      <a href="/#preise">${escapeHtml(COPY.navPlans)}</a>
      <a href="/#probetraining">${escapeHtml(COPY.navTrial)}</a>
      <a href="/#kontakt">${escapeHtml(COPY.navContact)}</a>
      <a href="/mitglied">${escapeHtml(COPY.ctaJoin)}</a>
      <a href="/impressum">${escapeHtml(COPY.impressum)}</a>
      <a href="/datenschutz">${escapeHtml(COPY.privacy)}</a>
      <a href="/agb">${escapeHtml(COPY.agb)}</a>
      <a href="/widerruf">${escapeHtml(COPY.withdraw)}</a>
      <a href="/hausordnung">${escapeHtml(COPY.house)}</a>
    </nav>
    <h1>MMA Gym in Leipzig | ${escapeHtml(COPY.gymName)}</h1>
    <p>MMA Gym in Leipzig: ${escapeHtml(COPY.gymName)} von ${escapeHtml(GYM.partners[0])} und ${escapeHtml(GYM.partners[1])} an der ${escapeHtml(GYM_ADDRESS)}. MMA in Leipzig, Ringen in Leipzig, BJJ in Leipzig, Boxen in Leipzig und Kick- &amp; Thai-Boxen in Leipzig. ${escapeHtml(COPY.heroHit)} ${escapeHtml(COPY.ctaJoinNow)} oder zuerst zum ${escapeHtml(COPY.ctaTrial)} kommen.</p>
${about}
    <p>${escapeHtml(COPY.aboutClose.replace('🥊', '').trim())} ${escapeHtml(COPY.aboutStreet)}, ${escapeHtml(COPY.aboutZip)}. ${escapeHtml(COPY.aboutWhen)}.</p>
    <h2>${escapeHtml(COPY.trainTitle)} MMA Training Leipzig</h2>
    <p>Im ${escapeHtml(COPY.gymName)} Leipzig trainierst du MMA in Leipzig, Ringen in Leipzig, BJJ in Leipzig, Boxen in Leipzig und Kick- &amp; Thai-Boxen in Leipzig.</p>
${disciplines}
    <h2>${escapeHtml(COPY.teamTitle)}</h2>
    <p>${escapeHtml(COPY.teamLead)} ${escapeHtml(COPY.konradName)}, ${escapeHtml(COPY.konradRole)}. ${escapeHtml(COPY.konradBio)} ${escapeHtml(COPY.mehmetName)}, ${escapeHtml(COPY.mehmetRole)}. ${escapeHtml(COPY.mehmetBio)}</p>
    <h2>${escapeHtml(COPY.whoTitle)} ${escapeHtml(COPY.whoKicker)}</h2>
    <p>${escapeHtml(COPY.whoLead)}</p>
${people}
    <h2>${escapeHtml(COPY.priceTitle)} Mitglied werden</h2>
    <p>${escapeHtml(COPY.priceLead)} ${escapeHtml(COPY.priceFoot)}</p>
${plans}
    <p><a href="/mitglied">${escapeHtml(COPY.ctaJoinNow)}</a> · <a href="/#probetraining">${escapeHtml(COPY.ctaTrial)}</a></p>
    <h2>${escapeHtml(COPY.faqTitle)}</h2>
${faq}
    <h2>${escapeHtml(COPY.contactTitle)}</h2>
    <p>${escapeHtml(GYM.legalName)}, ${escapeHtml(GYM_ADDRESS)}. Mail: <a href="mailto:${escapeHtml(GYM.email)}">${escapeHtml(GYM.email)}</a>. Telefon: <a href="${escapeHtml(GYM.phoneHref)}">${escapeHtml(GYM.phone)}</a>.</p>
    <p>
      <a href="${escapeHtml(GYM.instagram)}" rel="noopener noreferrer">Instagram ${escapeHtml(GYM.instagramHandle)}</a>
      ·
      <a href="${escapeHtml(GYM.whatsapp)}" rel="noopener noreferrer">WhatsApp</a>
      ·
      <a href="${escapeHtml(GYM.mapsUrl)}" rel="noopener noreferrer">Karte Wittenberger Straße 15 Leipzig</a>
    </p>
  </article>`
}

export function buildSitemap(siteUrl: string): string {
  const origin = canonicalOrigin(siteUrl)
  const urls = PAGE_PATHS.map(
    (path, index) => `  <url>
    <loc>${origin}${path === '/' ? '/' : path}</loc>
    <changefreq>${index === 0 ? 'weekly' : 'monthly'}</changefreq>
    <priority>${index === 0 ? '1.0' : index === 1 ? '0.8' : '0.3'}</priority>
  </url>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}

export function seoAddressLine() {
  return `${GYM.legalName}, ${GYM_ADDRESS}`
}
