import type { Connect, Plugin } from 'vite'
import { createOpeningMailHandler } from './opening-mail.mjs'

type Env = Record<string, string | undefined>

export function openingMailPlugin(env: Env): Plugin {
  const handle = createOpeningMailHandler({ env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/opening-mail') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-opening-mail',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
