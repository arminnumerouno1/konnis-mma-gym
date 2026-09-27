import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const file = join(root, 'data', 'memberships.json')

try {
  const raw = await readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  const rows = Array.isArray(parsed.memberships) ? parsed.memberships : []
  console.log(`${rows.length} Mitgliedsanträge`)
  for (const row of rows) {
    console.log(`${row.createdAt}\t${row.plan}\t${row.firstName} ${row.lastName}\t<${row.email}>`)
  }
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.log('Noch keine Einträge. data/memberships.json fehlt.')
    process.exit(0)
  }
  throw error
}
