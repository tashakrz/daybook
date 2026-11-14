// Read-only Outlook calendar: fetched through the "outlook-ics" Supabase function,
// parsed on the device and cached so it still shows offline.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase.js'
import { parseIcs, localize } from './ics.js'
import { addDays, today } from './dates.js'
import { getSettings } from './model.js'
import { getUser } from './store.js'

const KEY = 'daybook:outlook-cache'
const VERSION = 2 // bump when the cached event shape changes
const STALE_MS = 30 * 60 * 1000

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}
let cache = load() // { v, url, fetchedAt, events, uid }
if (cache?.v !== VERSION) cache = null
let state = { status: 'idle', error: null }
const ls = new Set()
const emit = () => ls.forEach((l) => l())
let snapshot = { cache, ...state }
const set = (patch) => {
  state = { ...state, ...patch }
  snapshot = { cache, ...state }
  emit()
}

export function useOutlook() {
  return useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => snapshot)
}

/** Events for the signed-in user's current link, in the chosen time zone. */
let memo = { events: null, zone: null, out: [] }
export function currentEvents(snap) {
  const s = getSettings()
  const c = snap.cache
  if (!s.outlookUrl || !c || c.url !== s.outlookUrl || c.uid !== getUser()) return []
  if (memo.events !== c.events || memo.zone !== s.outlookTz) memo = { events: c.events, zone: s.outlookTz, out: localize(c.events, s.outlookTz) }
  return memo.out
}

export async function refreshOutlook({ force = false } = {}) {
  const url = getSettings().outlookUrl
  if (!url) return
  if (!supabase || getUser() === 'local') return set({ status: 'error', error: 'Sign in to connect Outlook.' })
  if (!force && cache?.url === url && cache.uid === getUser() && Date.now() - cache.fetchedAt < STALE_MS) return
  if (!navigator.onLine) return set({ status: 'offline' })
  if (state.status === 'loading') return
  set({ status: 'loading', error: null })
  try {
    const { data, error } = await supabase.functions.invoke('outlook-ics', { body: { url } })
    if (error) {
      let msg = error.message
      try {
        msg = (await error.context?.json())?.error || msg
      } catch {
        /* keep generic message */
      }
      if (/Failed to send|not found|404/i.test(msg)) msg = 'Couldn’t reach the outlook-ics function. Is it deployed?'
      throw new Error(msg)
    }
    const t = today()
    const events = parseIcs(data.ics, addDays(t, -120), addDays(t, 400))
    cache = { v: VERSION, url, uid: getUser(), fetchedAt: Date.now(), events }
    try {
      localStorage.setItem(KEY, JSON.stringify(cache))
    } catch {
      /* storage full or blocked: keep in memory */
    }
    set({ status: 'ok', error: null })
  } catch (e) {
    set({ status: 'error', error: e.message || String(e) })
  }
}

export function clearOutlook() {
  cache = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  set({ status: 'idle', error: null })
}
