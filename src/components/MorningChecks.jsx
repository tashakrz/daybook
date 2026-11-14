// Morning checks: big cards that take over the screen during the morning window
// until each one is ticked off. Separate from dailies.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useItems, list, get, patch, save, remove } from '../lib/store.js'
import { getSettings } from '../lib/model.js'
import { today as todayStr, fmtLong } from '../lib/dates.js'
import { cssVars } from '../lib/colors.js'
import { Icon, Field, ColorPicker, go } from './ui.jsx'

export const morningLogId = (checkId, date) => `ml:${checkId}:${date}`

const activeChecks = () => list('morning').filter((c) => !c.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
const isChecked = (c, date) => !!get(morningLogId(c.id, date))?.done

export function inMorningWindow(now = new Date()) {
  const s = getSettings()
  const h = now.getHours() + now.getMinutes() / 60
  return s.morningEnabled && h >= s.morningStart && h < s.morningEnd
}
/** Should the morning screen show right now? */
export function isMorningDue() {
  if (!inMorningWindow()) return false
  const date = todayStr()
  const checks = activeChecks()
  return checks.length > 0 && checks.some((c) => !isChecked(c, date))
}

/* open/closed state shared with the reminder pop-up */
let open = false
const ls = new Set()
const setOpen = (v) => {
  open = v
  ls.forEach((l) => l())
  if (!v) window.dispatchEvent(new Event('daybook:morning-closed'))
}
export const useMorningOpen = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => open)
export const openMorning = () => setOpen(true)

export async function toggleCheck(c, date, value) {
  const now = new Date()
  await patch(morningLogId(c.id, date), { checkId: c.id, date, done: value, at: value ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : null }, 'morninglog')
}

const fmtAt = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Watches for app open / return and shows the morning screen when due. */
export function MorningGate() {
  const isOpen = useMorningOpen()
  useEffect(() => {
    let hiddenAt = null
    if (isMorningDue()) setOpen(true)
    const vis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (!open && hiddenAt && Date.now() - hiddenAt > 2 * 60 * 1000 && isMorningDue()) setOpen(true)
    }
    document.addEventListener('visibilitychange', vis)
    // also catch the window opening while the app sits open (e.g. left open overnight)
    const t = setInterval(() => !open && document.visibilityState === 'visible' && isMorningDue() && !sessionStorage.getItem('daybook:morning-later') && setOpen(true), 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      clearInterval(t)
    }
  }, [])
  return isOpen ? <MorningScreen /> : null
}

function MorningScreen() {
  useItems('morninglog')
  const checks = useItems('morning')
    .filter((c) => !c.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const date = todayStr()
  const done = checks.filter((c) => isChecked(c, date)).length
  const allDone = checks.length > 0 && done === checks.length
  const name = getSettings().name

  useEffect(() => {
    if (!allDone) return
    const t = setTimeout(() => {
      setOpen(false)
      go('/today')
    }, 1400)
    return () => clearTimeout(t)
  }, [allDone])

  useEffect(() => {
    document.body.classList.add('locked')
    return () => document.body.classList.remove('locked')
  }, [])

  const later = () => {
    try {
      sessionStorage.setItem('daybook:morning-later', '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  return (
    <div className="morning" role="dialog" aria-modal="true" aria-label="Morning checks">
      <div className="morning-inner">
        <p className="eyebrow">{fmtLong(date)}</p>
        <h1>{allDone ? 'You’re all set ✨' : `Good morning${name ? ', ' + name : ''}`}</h1>
        <p className="muted">{allDone ? 'Taking you to the rest of your day…' : `Before anything else · ${done} of ${checks.length} done`}</p>
        <div className="morning-cards">
          {checks.map((c) => {
            const log = get(morningLogId(c.id, date))
            const on = !!log?.done
            return (
              <button key={c.id} className={`morning-card ${on ? 'on' : ''}`} style={cssVars(c.color, 'peach')} onClick={() => toggleCheck(c, date, !on)} aria-pressed={on}>
                <span className="mc-icon">{c.icon}</span>
                <span className="mc-name">{c.name}</span>
                <span className="mc-state">{on ? `Done · ${fmtAt(log.at)}` : 'Tap when done'}</span>
                <span className="mc-check">{on && <Icon name="check" size={26} stroke={2.4} />}</span>
              </button>
            )
          })}
        </div>
        {!allDone && (
          <button className="link morning-later" onClick={later}>
            Not now
          </button>
        )}
      </div>
    </div>
  )
}

/** Small reminder on Today when morning checks aren't finished. */
export function MorningStrip() {
  useItems('morninglog')
  useItems('settings')
  const checks = useItems('morning').filter((c) => !c.archived)
  const date = todayStr()
  const st = getSettings()
  if (!st.morningEnabled || !checks.length || new Date().getHours() < st.morningStart) return null
  const done = checks.filter((c) => isChecked(c, date)).length
  if (done === checks.length) return null
  return (
    <button className="morning-strip" onClick={openMorning}>
      <span>☀️ Morning checks</span>
      <span className="muted">
        {done}/{checks.length} · finish →
      </span>
    </button>
  )
}

/** Settings section. */
export function MorningSettings({ s, set }) {
  const checks = useItems('morning').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const [editing, setEditing] = useState(null)
  const move = async (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= checks.length) return
    await save('morning', { ...checks[i], order: j })
    await save('morning', { ...checks[j], order: i })
  }
  const add = async () => {
    const id = await save('morning', { name: '', icon: '✨', color: 'peach', order: checks.length })
    setEditing(id)
  }
  const hours = Array.from({ length: 24 }, (_, h) => h)
  const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })
  return (
    <div className="card form">
      <label className="toggle-row">
        <input type="checkbox" checked={s.morningEnabled} onChange={(e) => set('morningEnabled', e.target.checked)} />
        Show morning checks when I open the app
      </label>
      <div className="row2">
        <Field label="From">
          <select value={s.morningStart} onChange={(e) => set('morningStart', Number(e.target.value))}>
            {hours.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Until">
          <select value={s.morningEnd} onChange={(e) => set('morningEnd', Number(e.target.value))}>
            {hours.filter((h) => h > s.morningStart).map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ul className="manage-list">
        {checks.map((c, i) => (
          <li key={c.id} className="card" style={cssVars(c.color, 'peach')}>
            {editing === c.id ? (
              <div className="form mc-edit">
                <div className="row2 narrow-first">
                  <input className="emoji-input" defaultValue={c.icon} maxLength={4} onBlur={(e) => save('morning', { ...c, icon: e.target.value || '✨' })} aria-label="Icon" />
                  <input defaultValue={c.name} autoFocus placeholder="e.g. Drink a glass of water" onBlur={(e) => save('morning', { ...c, name: e.target.value.trim() || 'Morning check' })} aria-label="Name" />
                </div>
                <ColorPicker value={c.color} onChange={(color) => save('morning', { ...c, color })} />
                <div className="form-actions">
                  <button className="btn ghost danger small" onClick={() => window.confirm('Delete this morning check?') && remove(c.id)}>
                    Delete
                  </button>
                  <button className="btn ghost small" onClick={() => setEditing(null)}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="habit-icon">{c.icon}</span>
                <button className="task-body" onClick={() => setEditing(c.id)}>
                  <span className="task-title">{c.name || 'Untitled'}</span>
                  <span className="task-meta">{c.archived ? 'Paused' : 'Tap to edit'}</span>
                </button>
                <button className="btn ghost small" onClick={() => save('morning', { ...c, archived: !c.archived })}>
                  {c.archived ? 'Resume' : 'Pause'}
                </button>
                <div className="order-btns">
                  <button className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button className="icon-btn small" onClick={() => move(i, 1)} disabled={i === checks.length - 1} aria-label="Move down">
                    ↓
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="form-actions start">
        <button className="btn ghost small" onClick={add}>
          <Icon name="plus" size={16} /> Add a morning check
        </button>
        <button className="btn ghost small" onClick={openMorning}>
          Preview
        </button>
      </div>
    </div>
  )
}
