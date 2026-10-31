import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { memberFromSignup, membershipTaken } from './member-model.mjs'

const FILE_NAME = 'members.json'
const LEGACY_NAME = 'memberships.json'
const BLOB_PATH = 'konni/members.json'
const UPDATE_RETRIES = 5

function emptyStore() {
  return { version: 1, rev: 0, members: [], issuedFirst50: [], revokedInvites: [], invoiceYear: null, invoiceSeq: 0 }
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
  const issuedFirst50 = Array.isArray(parsed.issuedFirst50) ? parsed.issuedFirst50 : []
  const revokedInvites = Array.isArray(parsed.revokedInvites) ? parsed.revokedInvites : []
  const invoiceYear = parsed.invoiceYear || null
  const invoiceSeq = Number(parsed.invoiceSeq) || 0
  const rev = Number(parsed.rev) || 0
  if (Array.isArray(parsed.members)) {
    return { version: 1, rev, members: parsed.members, issuedFirst50, revokedInvites, invoiceYear, invoiceSeq }
  }
  if (Array.isArray(parsed.memberships)) {
    return {
      version: 1,
      rev,
      members: parsed.memberships.map((row) => memberFromSignup(row)),
      issuedFirst50,
      revokedInvites,
      invoiceYear,
      invoiceSeq,
    }
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
  const body = JSON.stringify(store)
  await put(BLOB_PATH, body, {
    access: 'private',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
  // Hourly backup snapshot — best-effort, never blocks the primary write.
  try {
    const stamp = new Date().toISOString().slice(0, 13)
    await put(`konni/backups/members-${stamp}.json`, body, {
      access: 'private',
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
  } catch (error) {
    console.warn('[member-store] backup skipped', String(error?.message || error).slice(0, 120))
  }
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
    const payload = {
      version: 1,
      rev: Number(store.rev) || 0,
      members: store.members,
      issuedFirst50: store.issuedFirst50 ?? [],
      revokedInvites: store.revokedInvites ?? [],
      invoiceYear: store.invoiceYear ?? null,
      invoiceSeq: Number(store.invoiceSeq) || 0,
    }
    await mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmp, `${JSON.stringify(payload)}\n`, 'utf8')
    await rename(tmp, file)
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
        let lastError = null
        for (let attempt = 0; attempt < UPDATE_RETRIES; attempt += 1) {
          const store = await loadUnlocked()
          const baseRev = Number(store.rev) || 0
          const next = await mutator(store)
          const payload = next && typeof next === 'object' ? next : store
          const recheck = await loadUnlocked()
          if ((Number(recheck.rev) || 0) !== baseRev) {
            lastError = new Error('conflict')
            continue
          }
          payload.rev = baseRev + 1
          await saveUnlocked(payload)
          return payload
        }
        throw lastError || new Error('conflict')
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
