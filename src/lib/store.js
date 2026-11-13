// Local-first data store. Every record lives in IndexedDB on the device and is
// mirrored to Supabase by sync.js. Records: { id, kind, data, updated_at, deleted, dirty }
import { openDB, deleteDB } from 'idb'
import { useMemo, useSyncExternalStore } from 'react'

const dbName = (uid) => `daybook-${uid}`
const openUserDB = (uid) =>
  openDB(dbName(uid), 1, {
    upgrade(db) {
      db.createObjectStore('items', { keyPath: 'id' })
      db.createObjectStore('meta')
    },
  })

let db = null
let currentUser = null
const items = new Map()
const listeners = new Set()
let version = 0
let onChange = null

export const setChangeHandler = (fn) => (onChange = fn)
export const getUser = () => currentUser

function emit() {
  version++
  listeners.forEach((l) => l())
}
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))
const getVersion = () => version

export async function initStore(uid) {
  if (db) db.close()
  db = await openUserDB(uid)
  currentUser = uid
  items.clear()
  for (const r of await db.getAll('items')) items.set(r.id, r)
  emit()
}

export async function readAllFor(uid) {
  const d = await openUserDB(uid)
  const all = await d.getAll('items')
  d.close()
  return all
}

export async function destroyUserData(uid) {
  if (currentUser === uid && db) {
    db.close()
    db = null
    items.clear()
    currentUser = null
  }
  await deleteDB(dbName(uid))
}

/* ---------- reading ---------- */
const view = (r) => ({ id: r.id, ...r.data })

export function list(kind) {
  const out = []
  for (const r of items.values()) if (r.kind === kind && !r.deleted) out.push(view(r))
  return out
}
export function get(id) {
  const r = items.get(id)
  return r && !r.deleted ? view(r) : null
}
export function useVersion() {
  return useSyncExternalStore(subscribe, getVersion)
}
export function useItems(kind) {
  const v = useVersion()
  return useMemo(() => list(kind), [v, kind])
}
export function useItem(id) {
  const v = useVersion()
  return useMemo(() => get(id), [v, id])
}

/* ---------- writing ---------- */
function stamp(prev) {
  let t = Date.now()
  if (prev) t = Math.max(t, Date.parse(prev.updated_at) + 1)
  return new Date(t).toISOString()
}

async function write(rec) {
  items.set(rec.id, rec)
  emit()
  await db.put('items', rec)
  onChange?.()
}

/** Create or replace a record. Returns its id. */
export async function save(kind, obj) {
  const { id: given, ...data } = obj
  const id = given || crypto.randomUUID()
  const prev = items.get(id)
  await write({ id, kind, data, updated_at: stamp(prev), deleted: false, dirty: 1 })
  return id
}

/** Merge changes into an existing record (or create it with `kind`). */
export async function patch(id, changes, kind) {
  const prev = items.get(id)
  const base = prev && !prev.deleted ? prev.data : {}
  await write({ id, kind: prev?.kind || kind, data: { ...base, ...changes }, updated_at: stamp(prev), deleted: false, dirty: 1 })
}

export async function remove(id) {
  const prev = items.get(id)
  if (!prev) return
  await write({ ...prev, data: {}, updated_at: stamp(prev), deleted: true, dirty: 1 })
}

/** Default records written with an ancient timestamp so any synced version wins. */
export async function seed(kind, obj) {
  if (items.has(obj.id)) return
  const { id, ...data } = obj
  const rec = { id, kind, data, updated_at: '2000-01-01T00:00:00.000Z', deleted: false, dirty: 0 }
  items.set(id, rec)
  await db.put('items', rec)
  emit()
}

/** Bring in records from another local database (e.g. "this device only" → account). */
export async function importRecords(records) {
  const tx = db.transaction('items', 'readwrite')
  for (const r of records) {
    const prev = items.get(r.id)
    if (prev && Date.parse(prev.updated_at) >= Date.parse(r.updated_at)) continue
    const rec = { ...r, dirty: 1 }
    items.set(r.id, rec)
    tx.store.put(rec)
  }
  await tx.done
  emit()
  onChange?.()
}

/* ---------- sync helpers ---------- */
export const getDirty = () => [...items.values()].filter((r) => r.dirty)
export const hasDirty = () => [...items.values()].some((r) => r.dirty)

export async function markClean(pushed) {
  const tx = db.transaction('items', 'readwrite')
  for (const p of pushed) {
    const cur = items.get(p.id)
    if (cur && cur.updated_at === p.updated_at && cur.dirty) {
      const rec = { ...cur, dirty: 0 }
      items.set(p.id, rec)
      tx.store.put(rec)
    }
  }
  await tx.done
}

/** Apply rows from the server, last-write-wins by updated_at. */
export async function applyRemote(rows) {
  if (!rows.length) return
  let changed = false
  const tx = db.transaction('items', 'readwrite')
  for (const row of rows) {
    const local = items.get(row.id)
    const remoteT = Date.parse(row.updated_at)
    if (local && Date.parse(local.updated_at) >= remoteT) continue
    const rec = {
      id: row.id,
      kind: row.kind,
      data: row.data || {},
      updated_at: new Date(remoteT).toISOString(),
      deleted: !!row.deleted,
      dirty: 0,
    }
    items.set(row.id, rec)
    tx.store.put(rec)
    changed = true
  }
  await tx.done
  if (changed) emit()
}

export const getMeta = (k) => db?.get('meta', k)
export const setMeta = (k, v) => db?.put('meta', v, k)
