import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { buildSeoHead, buildSitemap } from './src/brand/seo.ts'
import { membershipDataDir, membershipPlugin } from './server/membership-plugin.ts'
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
        source: buildSitemap(origin),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dataDir = waitlistDataDir(process.cwd())

  return {
    plugins: [
      react(),
      seoPlugin(env.VITE_SITE_URL),
      waitlistPlugin(env, dataDir),
      membershipPlugin(env, membershipDataDir(process.cwd())),
    ],
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
