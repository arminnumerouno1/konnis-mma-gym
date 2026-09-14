export const SEO = {
  title: 'KONNI MMA GYM Leipzig',
  shortTitle: 'KONNI MMA GYM Leipzig',
  description:
    'MMA-Gym in Leipzig von Konrad Dyrschka. Training in MMA, Grappling und Striking. Eröffnung und Standort folgen.',
  ogImagePath: '/og-image.jpg',
  ogImageAlt: 'KONNI MMA GYM Leipzig',
  locale: 'de_DE',
  siteName: 'KONNI MMA GYM',
  themeColor: '#050505',
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SEO.siteName,
        inLanguage: 'de-DE',
        ...(pageUrl ? { url: pageUrl } : {}),
      },
      {
        '@type': 'SportsActivityLocation',
        name: SEO.siteName,
        description: SEO.description,
        image,
        email: 'info@mma-in-leipzig.de',
        ...(pageUrl ? { url: pageUrl } : {}),
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Schönbachstr. 66',
          postalCode: '04299',
          addressLocality: 'Leipzig',
          addressCountry: 'DE',
        },
        founder: {
          '@type': 'Person',
          name: 'Konrad Dyrschka',
        },
      },
    ],
  }

  const lines = [
    `<title>${escapeHtml(SEO.title)}</title>`,
    `<meta name="description" content="${escapeHtml(SEO.description)}" />`,
    `<meta name="author" content="Konrad Dyrschka" />`,
    `<meta name="robots" content="index, follow" />`,
    pageUrl ? `<link rel="canonical" href="${escapeHtml(pageUrl)}" />` : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SEO.siteName)}" />`,
    `<meta property="og:locale" content="${SEO.locale}" />`,
    `<meta property="og:title" content="${escapeHtml(SEO.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(SEO.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    pageUrl ? `<meta property="og:url" content="${escapeHtml(pageUrl)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(SEO.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(SEO.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    `<script type="application/ld+json">`,
    JSON.stringify(jsonLd, null, 2)
      .split('\n')
      .map((line, index) => (index === 0 ? line : `    ${line}`))
      .join('\n'),
    `</script>`,
  ]

  return lines.filter(Boolean).join('\n    ')
}
