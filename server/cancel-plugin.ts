import type { Connect, Plugin } from 'vite'
import { createCancelHandler } from './cancel.mjs'

type Env = Record<string, string | undefined>

export function cancelPlugin(env: Env, dataDir: string): Plugin {
  const handle = createCancelHandler({ dataDir, env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/kuendigen') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-cancel',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
