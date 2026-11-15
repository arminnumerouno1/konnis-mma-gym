import type { Connect, Plugin } from 'vite'
import { createCheckinHandler } from './checkin.mjs'

type Env = Record<string, string | undefined>

export function checkinPlugin(env: Env, dataDir: string): Plugin {
  const handle = createCheckinHandler({ dataDir, env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/checkin') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-checkin',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
