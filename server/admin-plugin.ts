import type { Connect, Plugin } from 'vite'
import { createAdminHandler } from './admin.mjs'
import { createStripeHandler } from './stripe.mjs'
import { createAddressHandler } from './address.mjs'

type Env = Record<string, string | undefined>

export function adminPlugin(env: Env, dataDir: string): Plugin {
  const handle = createAdminHandler({ dataDir, env })
  const handleStripe = createStripeHandler({ dataDir, env })
  const handleAddress = createAddressHandler()

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path === '/api/admin') {
      void handle(req, res)
      return
    }
    if (path === '/api/address') {
      void handleAddress(req, res)
      return
    }
    if (path === '/api/stripe') {
      void handleStripe(req, res)
      return
    }
    next()
  }

  return {
    name: 'konnis-admin',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
