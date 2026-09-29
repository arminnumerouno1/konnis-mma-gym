import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { memberFromSignup } from './member-model.mjs'

const FILE_NAME = 'members.json'
const LEGACY_NAME = 'memberships.json'
const BLOB_PATH = 'konni/members.json'

function emptyStore() {
  return { version: 1, members: [] }
}

async function readJsonFile(file) {
  try {
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function normalizeStore(parsed) {
  if (!parsed || typeof parsed !== 'object') return emptyStore()
  if (Array.isArray(parsed.members)) return { version: 1, members: parsed.members }
  if (Array.isArray(parsed.memberships)) {
    return { version: 1, members: parsed.memberships.map((row) => memberFromSignup(row)) }
  }
  return emptyStore()
}

async function loadBlob(token) {
  try {
    const { list } = await import('@vercel/blob')
    const listed = await list({ prefix: 'konni/', token, limit: 20 })
    const hit = listed.blobs?.find((item) => item.pathname === BLOB_PATH)
    if (!hit?.url) return null
    const res = await fetch(hit.url, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error('[members] blob load failed', error)
    return null
  }
}

async function saveBlob(token, store) {
  const { put } = await import('@vercel/blob')
  await put(BLOB_PATH, JSON.stringify(store), {
    access: 'private',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

export function membersFile(dataDir) {
  return join(dataDir, FILE_NAME)
}

export function storeKind(env = process.env) {
  if (env.BLOB_READ_WRITE_TOKEN?.trim()) return 'blob'
  if (env.VERCEL) return 'ephemeral'
  return 'file'
}

export function createMemberStore({ dataDir, env = process.env }) {
  const file = membersFile(dataDir)
  const legacy = join(dataDir, LEGACY_NAME)
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() || ''
  let chain = Promise.resolve()

  async function loadUnlocked() {
    if (token) {
      const fromBlob = await loadBlob(token)
      if (fromBlob) return normalizeStore(fromBlob)
    }
    const local = await readJsonFile(file)
    if (local) return normalizeStore(local)
    const old = await readJsonFile(legacy)
    if (old) return normalizeStore(old)
    return emptyStore()
  }

  async function saveUnlocked(store) {
    const payload = { version: 1, members: store.members }
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
    if (token) {
      try {
        await saveBlob(token, payload)
      } catch (error) {
        console.error('[members] blob save failed', error)
      }
    }
  }

  function withLock(fn) {
    const run = chain.then(fn, fn)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    kind: storeKind(env),
    async load() {
      return withLock(loadUnlocked)
    },
    async save(store) {
      return withLock(() => saveUnlocked(store))
    },
    async update(mutator) {
      return withLock(async () => {
        const store = await loadUnlocked()
        const next = await mutator(store)
        const payload = next && typeof next === 'object' ? next : store
        await saveUnlocked(payload)
        return payload
      })
    },
  }
}

export async function ingestSignup(store, record) {
  const member = memberFromSignup(record)
  await store.update((db) => {
    const index = db.members.findIndex((row) => row.id === member.id || normalizeKey(row.email) === normalizeKey(member.email))
    if (index >= 0) {
      db.members[index] = {
        ...db.members[index],
        ...member,
        photoData: db.members[index].photoData || member.photoData,
        notes: db.members[index].notes || member.notes,
        payments: member.payments,
      }
    } else db.members.push(member)
    return db
  })
  return member
}

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
}
