import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const FILE_NAME = 'admin-auth.json'
const BLOB_PATH = 'konni/admin-auth.json'

export const LOGIN_WINDOW_MS = 10 * 60 * 1000
export const LOGIN_MAX = 8
export const LOCKOUT_MS = 15 * 60 * 1000
export const LOGIN_FAIL_DELAY_MS = 400
export const PROOF_INVITE_WINDOW_MS = 10 * 60 * 1000
export const PROOF_INVITE_MAX = 8
export const CRON_SECRET_MIN = 24
export const SESSION_MS = 4 * 60 * 60 * 1000
export const ADMIN_COOKIE = 'konni_admin'
export const ADMIN_COOKIE_HOST = '__Host-konni_admin'

function emptyState() {
  return {
    version: 1,
    sessionEpoch: 1,
    logins: {},
    proofInvites: [],
  }
}

function normalize(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  return {
    version: 1,
    sessionEpoch: Number.isFinite(Number(raw.sessionEpoch)) ? Math.max(1, Math.floor(Number(raw.sessionEpoch))) : 1,
    logins: raw.logins && typeof raw.logins === 'object' ? raw.logins : {},
    proofInvites: Array.isArray(raw.proofInvites) ? raw.proofInvites : [],
  }
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function pruneLogins(logins, now) {
  const next = {}
  for (const [ip, row] of Object.entries(logins || {})) {
    const fails = Array.isArray(row?.fails) ? row.fails.filter((t) => now - t < LOGIN_WINDOW_MS) : []
    const lockedUntil = Number(row?.lockedUntil) || 0
    if (!fails.length && lockedUntil <= now) continue
    next[ip] = { fails, lockedUntil: lockedUntil > now ? lockedUntil : 0 }
  }
  return next
}

function pruneProofInvites(rows, now) {
  return (rows || []).filter((row) => row && now - Number(row.at || 0) < PROOF_INVITE_WINDOW_MS)
}

export function createAdminAuthStore({ dataDir, env = process.env }) {
  const file = join(dataDir, FILE_NAME)
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() || ''
  let chain = Promise.resolve()

  async function loadUnlocked() {
    if (token) {
      const { get } = await import('@vercel/blob')
      const res = await get(BLOB_PATH, { access: 'private', token, useCache: false })
      if (res && res.statusCode === 200 && res.stream) {
        return normalize(JSON.parse(await new Response(res.stream).text()))
      }
    }
    return normalize(await readJsonFile(file))
  }

  async function saveUnlocked(db) {
    const payload = normalize(db)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
    if (token) {
      const { put } = await import('@vercel/blob')
      await put(BLOB_PATH, JSON.stringify(payload), {
        access: 'private',
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
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
    load: () => withLock(loadUnlocked),
    update: (mutator) =>
      withLock(async () => {
        const db = await loadUnlocked()
        const next = (await mutator(db)) ?? db
        await saveUnlocked(next)
        return next
      }),
    async sessionEpoch() {
      const db = await this.load()
      return db.sessionEpoch
    },
    async bumpSessionEpoch() {
      const db = await this.update((state) => {
        state.sessionEpoch = (Number(state.sessionEpoch) || 1) + 1
        return state
      })
      return db.sessionEpoch
    },
    async loginStatus(ip) {
      const now = Date.now()
      const key = String(ip || 'unknown')
      const db = await this.update((state) => {
        state.logins = pruneLogins(state.logins, now)
        return state
      })
      const row = db.logins[key] || { fails: [], lockedUntil: 0 }
      if (row.lockedUntil > now) {
        return { ok: false, locked: true, retryAfterMs: row.lockedUntil - now, fails: row.fails.length }
      }
      if (row.fails.length >= LOGIN_MAX) {
        return { ok: false, locked: true, retryAfterMs: LOCKOUT_MS, fails: row.fails.length }
      }
      return { ok: true, locked: false, fails: row.fails.length }
    },
    async recordLoginFailure(ip) {
      const now = Date.now()
      const key = String(ip || 'unknown')
      const db = await this.update((state) => {
        state.logins = pruneLogins(state.logins, now)
        const row = state.logins[key] || { fails: [], lockedUntil: 0 }
        row.fails = [...row.fails, now].filter((t) => now - t < LOGIN_WINDOW_MS)
        if (row.fails.length >= LOGIN_MAX) row.lockedUntil = now + LOCKOUT_MS
        state.logins[key] = row
        return state
      })
      const row = db.logins[key] || { fails: [], lockedUntil: 0 }
      return {
        locked: row.lockedUntil > now,
        retryAfterMs: Math.max(0, (row.lockedUntil || 0) - now),
        fails: row.fails.length,
      }
    },
    async clearLoginFailures(ip) {
      const key = String(ip || 'unknown')
      await this.update((state) => {
        if (state.logins?.[key]) delete state.logins[key]
        return state
      })
    },
    /** Caps proof-only invite relays to distinct recipients per window. */
    async claimProofInvite(email) {
      const now = Date.now()
      const normalized = String(email || '')
        .trim()
        .toLowerCase()
      if (!normalized) return { ok: false, error: 'email' }
      let allowed = false
      await this.update((state) => {
        state.proofInvites = pruneProofInvites(state.proofInvites, now)
        const already = state.proofInvites.some((row) => row.email === normalized)
        if (already) {
          allowed = true
          return state
        }
        if (state.proofInvites.length >= PROOF_INVITE_MAX) {
          allowed = false
          return state
        }
        state.proofInvites.push({ email: normalized, at: now })
        allowed = true
        return state
      })
      return { ok: allowed, error: allowed ? undefined : 'rate' }
    },
  }
}

export function adminCookieName(secure) {
  return secure ? ADMIN_COOKIE_HOST : ADMIN_COOKIE
}

export function readAdminCookie(header, secure) {
  const preferred = adminCookieName(secure)
  const primary = cookieValue(header, preferred)
  if (primary) return primary
  // Migration / local fallback: accept the legacy name too.
  if (preferred !== ADMIN_COOKIE) {
    const legacy = cookieValue(header, ADMIN_COOKIE)
    if (legacy) return legacy
  }
  return cookieValue(header, ADMIN_COOKIE_HOST)
}

function cookieValue(header, name) {
  if (!header) return ''
  const prefix = `${name}=`
  const hit = String(header)
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : ''
}

export function buildAdminCookie(token, secure) {
  const name = adminCookieName(secure)
  const base = `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_MS / 1000)}`
  return secure ? `${base}; Secure` : base
}

export function clearAdminCookies(secure) {
  const max = 'Max-Age=0'
  const common = `Path=/; HttpOnly; SameSite=Strict; ${max}`
  const host = `${ADMIN_COOKIE_HOST}=; ${common}; Secure`
  const legacy = secure ? `${ADMIN_COOKIE}=; ${common}; Secure` : `${ADMIN_COOKIE}=; ${common}`
  // Clear both names so a host-cookie cutover invalidates old sessions.
  return [host, legacy]
}

export async function sleep(ms) {
  if (!ms || ms < 1) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}
