import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { buildSeoHead } from './src/brand/seo.ts'
import { waitlistDataDir, waitlistPlugin } from './server/waitlist-plugin.ts'

function siteUrl(envUrl = ''): string {
  return (envUrl || process.env.VITE_SITE_URL || '').replace(/\/$/, '')
}

function seoPlugin(envUrl = ''): Plugin {
  return {
    name: 'konnis-seo',
    transformIndexHtml(html) {
      return html.replace('<!--seo-head-->', buildSeoHead(siteUrl(envUrl)))
    },
    generateBundle() {
      const origin = siteUrl(envUrl)
      if (!origin) return
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${origin}/impressum.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.2</priority>
  </url>
</urlset>
`,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), seoPlugin(env.VITE_SITE_URL), waitlistPlugin(env, waitlistDataDir(process.cwd()))],
    server: {
      host: '127.0.0.1',
      port: 43177,
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      port: 43177,
      strictPort: true,
    },
  }
})
