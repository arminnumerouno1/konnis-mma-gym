import type { Connect, Plugin } from 'vite'
import { createInviteMailHandler } from './invite-mail.mjs'

type Env = Record<string, string | undefined>

export function inviteMailPlugin(env: Env): Plugin {
  const handle = createInviteMailHandler({ env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/invite-mail') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-invite-mail',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
