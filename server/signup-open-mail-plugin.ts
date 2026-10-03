import type { Connect, Plugin } from 'vite'
import { createSignupOpenMailHandler } from './signup-open-mail.mjs'

type Env = Record<string, string | undefined>

export function signupOpenMailPlugin(env: Env): Plugin {
  const handle = createSignupOpenMailHandler({ env })

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/signup-open-mail') {
      next()
      return
    }
    void handle(req, res)
  }

  return {
    name: 'konnis-signup-open-mail',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
