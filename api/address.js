import { createAddressHandler } from '../server/address.mjs'

const handle = createAddressHandler()

export default async function handler(req, res) {
  await handle(req, res)
}
