import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { buildSeoHead } from './src/brand/seo.ts'

function siteUrl(): string {
  return (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
}

function seoPlugin(): Plugin {
  return {
    name: 'konnis-seo',
    transformIndexHtml(html) {
      return html.replace('<!--seo-head-->', buildSeoHead(siteUrl()))
    },
    generateBundle() {
      const origin = siteUrl()
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

export default defineConfig({
  plugins: [react(), seoPlugin()],
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
})
