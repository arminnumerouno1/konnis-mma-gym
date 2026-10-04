import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { memberFromSignup, membershipTaken } from './member-model.mjs'

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
  const { get } = await import('@vercel/blob')
  const res = await get(BLOB_PATH, { access: 'private', token, useCache: false })
  if (!res || res.statusCode !== 200 || !res.stream) return null
  return JSON.parse(await new Response(res.stream).text())
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
    if (token) await saveBlob(token, payload)
  }

  function withLock(fn) {
    const run = chain.then(fn, fn)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const docsDir = join(dataDir, 'docs')

  return {
    kind: storeKind(env),
    async putDoc(path, bytes, contentType) {
      if (token) {
        const { put } = await import('@vercel/blob')
        await put(`konni/docs/${path}`, bytes, {
          access: 'private',
          token,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType,
        })
        return
      }
      const target = join(docsDir, path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
    },
    /** First writer wins. A second call returns false and does not replace the file. */
    async putDocOnce(path, bytes, contentType) {
      if (token) {
        const { put } = await import('@vercel/blob')
        try {
          await put(`konni/docs/${path}`, bytes, {
            access: 'private',
            token,
            addRandomSuffix: false,
            allowOverwrite: false,
            contentType,
          })
          return true
        } catch {
          const existing = await this.getDoc(path)
          if (existing) return false
          throw new Error('mail_lock')
        }
      }
      const target = join(docsDir, path)
      await mkdir(dirname(target), { recursive: true })
      try {
        await writeFile(target, bytes, { flag: 'wx' })
        return true
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') return false
        throw error
      }
    },
    async getDoc(path) {
      if (token) {
        const { get } = await import('@vercel/blob')
        const res = await get(`konni/docs/${path}`, { access: 'private', token, useCache: false })
        if (!res || res.statusCode !== 200 || !res.stream) return null
        return Buffer.from(await new Response(res.stream).arrayBuffer())
      }
      try {
        return await readFile(join(docsDir, path))
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
        throw error
      }
    },
    async deleteDoc(path) {
      if (token) {
        const { del } = await import('@vercel/blob')
        await del(`konni/docs/${path}`, { token })
        return
      }
      await rm(join(docsDir, path), { force: true })
    },
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
  const claimed = await claimSignup(store, record)
  if (!claimed.ok) {
    const error = new Error('duplicate')
    error.code = 'duplicate'
    throw error
  }
  return claimed.member
}

export async function claimSignup(store, record) {
  const member = memberFromSignup(record)
  let taken = false
  await store.update((db) => {
    if (membershipTaken(db.members, member.email, member.id)) {
      taken = true
      return db
    }
    const index = db.members.findIndex((row) => row.id === member.id || normalizeKey(row.email) === normalizeKey(member.email))
    if (index >= 0) {
      const prev = db.members[index]
      db.members[index] = {
        ...prev,
        ...member,
        photoData: prev.photoData || member.photoData,
        notes: prev.notes || member.notes,
        bank: prev.bank || member.bank,
        docs: prev.docs || member.docs,
        stripe: prev.stripe || member.stripe,
        payments: member.payments,
      }
    } else db.members.push(member)
    return db
  })
  return taken ? { ok: false, error: 'duplicate' } : { ok: true, member }
}

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
}
