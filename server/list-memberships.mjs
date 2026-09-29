import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMemberStore } from './member-store.mjs'
import { listMember, isoDate } from './member-model.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const store = createMemberStore({ dataDir: join(root, 'data'), env: process.env })
const db = await store.load()
const today = isoDate()
console.log(`${db.members.length} Mitglieder`)
for (const row of db.members) {
  const view = listMember(row, today)
  console.log(
    `${view.status}\t${view.plan}\t${view.firstName} ${view.lastName}\t${view.payThisMonth}\t${view.cancel?.nextEnd ?? ''}\t<${view.email}>`,
  )
}
