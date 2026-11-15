import { createPreregHandler } from '../server/prereg.mjs'

const handle = createPreregHandler({
  dataDir: '/tmp/konni-memberships',
  env: process.env,
})

export default async function handler(req, res) {
  await handle(req, res)
}
