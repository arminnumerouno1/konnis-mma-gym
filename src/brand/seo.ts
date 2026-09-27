import { GYM, GYM_ADDRESS } from './gym.ts'

export const SEO = {
  title: 'KONNI MMA GYM Leipzig | Mitglied werden',
  shortTitle: 'KONNI MMA GYM Leipzig',
  description:
    'KONNI MMA GYM in Leipzig – MMA, Grappling und Striking. Unlimited Training. Standard, Flex und Day Pass. Online-Mitgliedschaft mit Vertrag, AGB und Widerruf.',
  ogImagePath: '/og-image.jpg',
  ogImageAlt: 'KONNI MMA GYM Leipzig – das MMA-Gym von MMA-Profi Konrad Dyrschka.',
  locale: 'de_DE',
  siteName: 'KONNI MMA GYM',
  themeColor: '#070707',
  keywords:
    'MMA Gym Leipzig, MMA Training Leipzig, Grappling Leipzig, Striking Leipzig, Kampfsport Leipzig, KONNI MMA GYM, Konrad Dyrschka, Mitgliedschaft MMA Leipzig',
} as const

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const PAGE_PATHS = ['/', '/mitglied', '/impressum', '/datenschutz', '/agb', '/widerruf', '/hausordnung']

export function buildSeoHead(siteUrl = ''): string {
  const origin = siteUrl.replace(/\/$/, '')
  const image = origin ? `${origin}${SEO.ogImagePath}` : SEO.ogImagePath
  const pageUrl = origin ? `${origin}/` : undefined

  const graph = [
    {
      '@type': 'WebSite',
      name: SEO.siteName,
      alternateName: ['Konni MMA Gym', 'KONNI MMA GYM Leipzig', 'KONNIMMAGYM'],
      description: SEO.description,
      inLanguage: 'de-DE',
      ...(pageUrl ? { url: pageUrl } : {}),
    },
    {
      '@type': 'SportsActivityLocation',
      name: SEO.siteName,
      legalName: GYM.legalName,
      alternateName: 'KONNI MMA GYM Leipzig',
      description: SEO.description,
      image,
      ...(pageUrl ? { url: pageUrl } : {}),
      email: GYM.email,
      telephone: GYM.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: GYM.street,
        postalCode: GYM.zip,
        addressLocality: GYM.city,
        addressRegion: 'SN',
        addressCountry: 'DE',
      },
      areaServed: { '@type': 'City', name: 'Leipzig' },
      sport: ['Mixed Martial Arts', 'MMA', 'Grappling', 'Striking'],
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
    pageUrl ? `<link rel="canonical" href="${escapeHtml(pageUrl)}" />` : '',
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
    pageUrl ? `<meta property="og:url" content="${escapeHtml(pageUrl)}" />` : '',
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

  return lines.filter(Boolean).join('\n    ')
}

export function buildSitemap(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, '')
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
