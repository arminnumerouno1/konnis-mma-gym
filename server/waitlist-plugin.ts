import { join } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { createWaitlistHandler } from './waitlist.mjs'

type WaitlistEnv = Record<string, string | undefined>

export function waitlistPlugin(env: WaitlistEnv, dataDir: string): Plugin {
  const handle = createWaitlistHandler({ dataDir, env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/waitlist') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-waitlist',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export function waitlistDataDir(root: string) {
  return join(root, 'data')
}
