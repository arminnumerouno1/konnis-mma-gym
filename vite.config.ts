import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { buildSeoBody, buildSeoHead, buildSitemap, canonicalOrigin } from './src/brand/seo.ts'
import { contactPlugin } from './server/contact-plugin.ts'
import { inviteMailPlugin } from './server/invite-mail-plugin.ts'
import { openingMailPlugin } from './server/opening-mail-plugin.ts'
import { membershipDataDir, membershipPlugin } from './server/membership-plugin.ts'
import { adminPlugin } from './server/admin-plugin.ts'
import { waitlistDataDir, waitlistPlugin } from './server/waitlist-plugin.ts'

function seoPlugin(envUrl = ''): Plugin {
  const origin = canonicalOrigin(envUrl || process.env.VITE_SITE_URL || '')
  return {
    name: 'konnis-seo',
    transformIndexHtml(html) {
      return html.replace('<!--seo-head-->', buildSeoHead(origin)).replace('<!--seo-body-->', buildSeoBody())
    },
    generateBundle() {
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
      adminPlugin(env, membershipDataDir(process.cwd())),
      contactPlugin(env, dataDir),
      inviteMailPlugin(env),
      openingMailPlugin(env),
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
