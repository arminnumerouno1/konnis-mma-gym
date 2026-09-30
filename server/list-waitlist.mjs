import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const file = join(root, 'data', 'waitlist.json')

try {
  const raw = await readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  const signups = Array.isArray(parsed.signups) ? parsed.signups : []
  const ordered = [...signups].sort((a, b) => {
    const left = typeof a?.createdAt === 'string' ? a.createdAt : ''
    const right = typeof b?.createdAt === 'string' ? b.createdAt : ''
    return right.localeCompare(left)
  })
  console.log(`${ordered.length} Einträge`)
  for (const row of ordered) {
    const name = row.name ? `${row.name} ` : ''
    console.log(`${row.createdAt}\t${name}<${row.email}>`)
  }
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.log('Noch keine Einträge. data/waitlist.json fehlt.')
    process.exit(0)
  }
  throw error
}
