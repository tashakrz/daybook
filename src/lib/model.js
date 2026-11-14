// Shared helpers for the app's record kinds.
import { addDays, diffDays, dow, today as todayStr, nextYearly } from './dates.js'
import { get, seed } from './store.js'

/* habits ------------------------------------------------------------- */
export const habitLogId = (habitId, date) => `hl:${habitId}:${date}`
export const periodLogId = (date) => `pl:${date}`

export function isScheduled(h, date) {
  const s = h.schedule || { type: 'daily' }
  if (h.start && date < h.start) return false
  if (s.type === 'weekdays') return (s.days || []).includes(dow(date))
  if (s.type === 'interval') {
    const start = s.start || h.start || date
    const d = diffDays(start, date)
    return d >= 0 && d % Math.max(1, s.every || 1) === 0
  }
  return true
}

export function scheduleText(h) {
  const s = h.schedule || { type: 'daily' }
  if (s.type === 'weekdays') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const d = [...(s.days || [])].sort()
    if (d.length === 7) return 'Every day'
    if (d.join() === '1,2,3,4,5') return 'Weekdays'
    return d.map((i) => names[i]).join(', ') || 'No days chosen'
  }
  if (s.type === 'interval') return s.every > 1 ? `Every ${s.every} days` : 'Every day'
  return 'Every day'
}

export function isDone(h, log) {
  if (!log) return false
  if (h.type === 'water') return (log.amount || 0) >= (h.goal || 2000)
  return !!log.done
}
export function progress(h, log) {
  if (h.type === 'water') return Math.min(1, (log?.amount || 0) / (h.goal || 2000))
  return log?.done ? 1 : 0
}

export function streak(h, logsById, date = todayStr()) {
  let n = 0
  let d = date
  // today not done yet doesn't break the streak
  if (isScheduled(h, d) && !isDone(h, logsById[habitLogId(h.id, d)])) d = addDays(d, -1)
  for (let i = 0; i < 400; i++) {
    if (isScheduled(h, d)) {
      if (isDone(h, logsById[habitLogId(h.id, d)])) n++
      else break
    }
    d = addDays(d, -1)
  }
  return n
}

/* reminders --------------------------------------------------------- */
// mode "day": show from the date on. mode "leadup": show every day until the date (and after, until done).
export function reminderActive(r, date = todayStr()) {
  if (r.done) return false
  if (!r.date) return true
  if (r.mode === 'leadup') return (r.from || r.created || date) <= date
  return r.date <= date
}

/* events ------------------------------------------------------------ */
export function eventOn(e, date) {
  if (e.yearly) return e.date.slice(5) === date.slice(5) && date >= e.date
  const end = e.endDate || e.date
  return date >= e.date && date <= end
}
export function nextOccurrence(e, from = todayStr()) {
  if (e.yearly) return nextYearly(e.date, from)
  return e.date
}

/* settings ---------------------------------------------------------- */
export const DEFAULT_SETTINGS = {
  id: 'settings',
  name: '',
  unit: 'ml',
  glass: 250,
  bottle: 500,
  reminderPopup: true,
  reminderDefaultMode: 'leadup',
  cycleLength: 28,
  periodLength: 5,
  showFertile: true,
  outlookUrl: '',
  outlookColor: 'clay',
  outlookOnToday: true,
  morningEnabled: true,
  morningStart: 7,
  morningEnd: 11,
  outlookTz: -420, // UTC−7: BC stays on daylight time year-round
}
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...(get('settings') || {}) })

export async function seedDefaults() {
  await seed('morning', { id: 'morning-bed', name: 'Made my bed', icon: '🛏️', color: 'peach', order: 0 })
  await seed('morning', { id: 'morning-meds', name: 'Took my ADHD meds', icon: '💊', color: 'lavender', order: 1 })
  await seed('settings', DEFAULT_SETTINGS)
  await seed('habit', {
    id: 'habit-water',
    name: 'Water',
    type: 'water',
    color: 'sky',
    icon: '💧',
    goal: 2000,
    schedule: { type: 'daily' },
    order: 0,
  })
  await seed('habit', {
    id: 'habit-gym',
    name: 'Gym',
    type: 'gym',
    color: 'sage',
    icon: '🏋️',
    schedule: { type: 'weekdays', days: [1, 3, 5] },
    order: 1,
  })
}

export const fmtAmount = (ml, unit) => (unit === 'oz' ? `${Math.round(ml / 29.5735)} oz` : ml >= 1000 ? `${parseFloat((ml / 1000).toFixed(2))} L` : `${ml} ml`)
