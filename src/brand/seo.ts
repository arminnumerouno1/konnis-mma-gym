export const SEO = {
  title: "KONNI'S MMA GYM Leipzig | MMA, Grappling, Striking",
  shortTitle: "KONNI'S MMA GYM Leipzig",
  description:
    "MMA, Grappling und Striking in Leipzig. KONNI'S MMA GYM – No Egos. Just Work. Das Underground-Gym öffnet bald. Standort und weitere Infos folgen.",
  ogImagePath: '/og-image.jpg',
  ogImageAlt: "KONNI'S MMA GYM Leipzig – Konrad und das Gym-Emblem. MMA, Grappling, Striking. Opening soon.",
  locale: 'de_DE',
  siteName: "KONNI'S MMA GYM",
  themeColor: '#050505',
  keywords:
    "MMA Gym Leipzig, MMA Training Leipzig, Grappling Leipzig, Striking Leipzig, Kampfsport Leipzig, KONNI'S MMA GYM, Konrad Dyrschka, Underground Fight Gym",
} as const

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function buildSeoHead(siteUrl = ''): string {
  const origin = siteUrl.replace(/\/$/, '')
  const image = origin ? `${origin}${SEO.ogImagePath}` : SEO.ogImagePath
  const pageUrl = origin ? `${origin}/` : undefined

  const graph = [
    {
      '@type': 'WebSite',
      name: SEO.siteName,
      alternateName: ["Konnis MMA Gym", "KONNI'S MMA GYM Leipzig"],
      description: SEO.description,
      inLanguage: 'de-DE',
      ...(pageUrl ? { url: pageUrl } : {}),
    },
    {
      '@type': 'SportsActivityLocation',
      name: SEO.siteName,
      alternateName: "KONNI'S MMA GYM Leipzig",
      description: SEO.description,
      image: image,
      ...(pageUrl ? { url: pageUrl } : {}),
      email: 'k.dyrschka@web.de',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Leipzig',
        addressRegion: 'SN',
        addressCountry: 'DE',
      },
      areaServed: {
        '@type': 'City',
        name: 'Leipzig',
      },
      sport: ['Mixed Martial Arts', 'MMA', 'Grappling', 'Striking'],
      founder: {
        '@type': 'Person',
        name: 'Konrad Dyrschka',
      },
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': graph,
  }

  const lines = [
    `<title>${escapeHtml(SEO.title)}</title>`,
    `<meta name="description" content="${escapeHtml(SEO.description)}" />`,
    `<meta name="keywords" content="${escapeHtml(SEO.keywords)}" />`,
    `<meta name="author" content="Konrad Dyrschka" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<meta name="googlebot" content="index, follow" />`,
    `<meta name="geo.region" content="DE-SN" />`,
    `<meta name="geo.placename" content="Leipzig" />`,
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
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<link rel="image_src" href="${escapeHtml(image)}" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ]

  return lines.filter(Boolean).join('\n    ')
}
