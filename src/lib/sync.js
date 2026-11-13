// Two-way sync between the local store and the Supabase `items` table.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase.js'
import { getUser, getDirty, markClean, applyRemote, getMeta, setMeta, setChangeHandler, hasDirty } from './store.js'

const PAGE = 1000
let state = { status: 'idle', lastSynced: null, error: null, pending: false }
const listeners = new Set()
const set = (patch) => {
  state = { ...state, ...patch, pending: hasDirty() }
  listeners.forEach((l) => l())
}
export const useSyncState = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )

let running = false
let again = false
let timer = null
let channel = null

export function scheduleSync(delay = 1500) {
  clearTimeout(timer)
  timer = setTimeout(syncNow, delay)
}

export async function syncNow() {
  const uid = getUser()
  if (!supabase || !uid || uid === 'local') return
  if (!navigator.onLine) return set({ status: 'offline' })
  if (running) return void (again = true)
  running = true
  set({ status: 'syncing' })
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session || data.session.user.id !== uid) return set({ status: 'signedout' })

    // 1. push local changes
    const dirty = getDirty()
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200)
      const rows = chunk.map((r) => ({
        id: r.id,
        user_id: uid,
        kind: r.kind,
        data: r.data,
        updated_at: r.updated_at,
        deleted: r.deleted,
      }))
      const { data: stored, error } = await supabase
        .from('items')
        .upsert(rows, { onConflict: 'user_id,id' })
        .select('id, kind, data, updated_at, deleted')
      if (error) throw error
      await markClean(chunk)
      await applyRemote(stored || []) // picks up any newer server copy that won
    }

    // 2. pull remote changes (with a small overlap window to catch late commits)
    const last = (await getMeta('lastPull')) || '1970-01-01T00:00:00.000Z'
    let cursor = new Date(Date.parse(last) - 120000).toISOString()
    let maxSeen = last
    for (;;) {
      const { data: rows, error } = await supabase
        .from('items')
        .select('id, kind, data, updated_at, deleted, server_updated_at')
        .eq('user_id', uid)
        .gt('server_updated_at', cursor)
        .order('server_updated_at', { ascending: true })
        .limit(PAGE)
      if (error) throw error
      await applyRemote(rows)
      if (rows.length) {
        cursor = rows[rows.length - 1].server_updated_at
        if (Date.parse(cursor) > Date.parse(maxSeen)) maxSeen = new Date(Date.parse(cursor)).toISOString()
      }
      if (rows.length < PAGE) break
    }
    await setMeta('lastPull', maxSeen)
    set({ status: 'synced', lastSynced: new Date().toISOString(), error: null })
  } catch (e) {
    console.warn('sync failed', e)
    set({ status: navigator.onLine ? 'error' : 'offline', error: e.message || String(e) })
  } finally {
    running = false
    if (again) {
      again = false
      scheduleSync(300)
    }
  }
}

let started = false
export function startSync() {
  setChangeHandler(() => {
    set({})
    scheduleSync()
  })
  if (!started) {
    started = true
    window.addEventListener('online', () => syncNow())
    window.addEventListener('offline', () => set({ status: 'offline' }))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncNow()
    })
    setInterval(() => syncNow(), 5 * 60 * 1000)
  }
  const uid = getUser()
  if (supabase && uid && uid !== 'local') {
    channel?.unsubscribe()
    channel = supabase
      .channel(`items-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${uid}` }, () =>
        scheduleSync(400),
      )
      .subscribe()
  }
  return syncNow()
}

export function stopSync() {
  channel?.unsubscribe()
  channel = null
  setChangeHandler(null)
}
