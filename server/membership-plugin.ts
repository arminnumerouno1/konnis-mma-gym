import { join } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { createMembershipHandler } from './membership.mjs'

type Env = Record<string, string | undefined>

export function membershipPlugin(env: Env, dataDir: string): Plugin {
  const handle = createMembershipHandler({ dataDir, env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/mitglied') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-membership',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export function membershipDataDir(root: string) {
  return join(root, 'data')
}
