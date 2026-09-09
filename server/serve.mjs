import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWaitlistHandler } from './waitlist.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = join(root, 'dist')
const dataDir = join(root, 'data')
const port = Number(process.env.PORT || 43177)
const handleWaitlist = createWaitlistHandler({ dataDir, env: process.env })

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent((urlPath.split('?')[0] || '/').replace(/\\/g, '/'))
  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\//, '')
  const absolute = resolve(dist, relativePath)
  const rel = relative(dist, absolute)
  if (rel.startsWith('..') || normalize(rel).startsWith('..')) return null
  return absolute
}

async function sendFile(res, file) {
  const info = await stat(file)
  if (info.isDirectory()) return false
  res.statusCode = 200
  res.setHeader('content-type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('content-length', String(info.size))
  createReadStream(file).pipe(res)
  return true
}

const server = createServer((req, res) => {
  const url = req.url ?? '/'
  if (url.split('?')[0] === '/api/waitlist') {
    void handleWaitlist(req, res)
    return
  }

  void (async () => {
    try {
      const file = safeFile(url)
      if (file && (await sendFile(res, file))) return
      const fallback = join(dist, 'index.html')
      if (await sendFile(res, fallback)) return
      res.statusCode = 404
      res.end('Not found')
    } catch {
      res.statusCode = 500
      res.end('Server error')
    }
  })()
})

server.listen(port, '127.0.0.1', () => {
  console.log(`KONNI MMA GYM at http://127.0.0.1:${port}`)
})
