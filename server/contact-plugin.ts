import type { Connect, Plugin } from 'vite'
import { createContactHandler } from './contact.mjs'

type Env = Record<string, string | undefined>

export function contactPlugin(env: Env, dataDir: string): Plugin {
  const handle = createContactHandler({ dataDir, env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/kontakt') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-contact',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
