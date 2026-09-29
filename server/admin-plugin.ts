import type { Connect, Plugin } from 'vite'
import { createAdminHandler } from './admin.mjs'

type Env = Record<string, string | undefined>

export function adminPlugin(env: Env, dataDir: string): Plugin {
  const handle = createAdminHandler({ dataDir, env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/admin') {
      next()
      return
    }
    void handle(req, res)
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
