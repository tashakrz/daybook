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

const QUESTIONS = { 'made my bed': 'Did you make your bed?', 'took my adhd meds': 'Did you take your ADHD meds?' }
export const questionFor = (c) => c.question || QUESTIONS[(c.name || '').trim().toLowerCase()] || `${c.name}?`
/** Big question with the last word in italics. */
function Question({ text }) {
  const words = text.split(' ')
  const last = words.pop()
  return (
    <h1 className="mq">
      {words.join(' ')} <em>{last}</em>
    </h1>
  )
}

const useWide = () => {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 760px)') : null
  return useSyncExternalStore(
    (l) => (mq?.addEventListener('change', l), () => mq?.removeEventListener('change', l)),
    () => !!mq?.matches,
  )
}

function MorningScreen() {
  useItems('morninglog')
  const checks = useItems('morning')
    .filter((c) => !c.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const date = todayStr()
  const wide = useWide()
  const [skipped, setSkipped] = useState([])
  const done = checks.filter((c) => isChecked(c, date)).length
  const allDone = checks.length > 0 && done === checks.length
  const current = checks.find((c) => !isChecked(c, date) && !skipped.includes(c.id))
  const name = getSettings().name

  const later = () => {
    try {
      sessionStorage.setItem('daybook:morning-later', '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  useEffect(() => {
    if (!allDone) return
    const t = setTimeout(() => {
      setOpen(false)
      go('/today')
    }, 1300)
    return () => clearTimeout(t)
  }, [allDone])

  // phone: every remaining check skipped → close for now
  useEffect(() => {
    if (!wide && !allDone && !current && checks.length) later()
  }, [wide, allDone, current, checks.length])

  useEffect(() => {
    if (wide) return
    document.body.classList.add('locked')
    return () => document.body.classList.remove('locked')
  }, [wide])

  if (wide) {
    // laptop: a small floating window, not a takeover
    return (
      <div className="morning-window" role="dialog" aria-label="Morning checks">
        <div className="mw-head">
          <span className="eyebrow">{allDone ? 'All set ✨' : `Good morning${name ? ', ' + name : ''} · ${done} of ${checks.length}`}</span>
          <button className="icon-btn small" onClick={later} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
        {checks.map((c) => {
          const log = get(morningLogId(c.id, date))
          const on = !!log?.done
          return (
            <button key={c.id} className={`mw-row ${on ? 'on' : ''}`} style={cssVars(c.color, 'peach')} onClick={() => toggleCheck(c, date, !on)} aria-pressed={on}>
              <span className="mw-icon">{c.icon}</span>
              <span className="mw-text">
                <strong>{questionFor(c)}</strong>
                <span>{on ? `Done · ${fmtAt(log.at)}` : 'Click when done'}</span>
              </span>
              <span className="mw-check disc">{on && <Icon name="check" size={18} stroke={2.4} />}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // phone: one question per screen
  const idx = current ? checks.indexOf(current) : checks.length
  const after = current ? checks.slice(idx + 1).find((c) => !isChecked(c, date) && !skipped.includes(c.id)) : null
  return (
    <div className="morning" role="dialog" aria-modal="true" aria-label="Morning checks">
      <div className="morning-inner">
        <div className="m-prog">
          {checks.map((c) => (
            <i key={c.id} className={isChecked(c, date) ? 'on' : c === current ? 'cur' : ''} />
          ))}
        </div>
        {allDone || !current ? (
          <div className="m-done">
            <span className="eyebrow">Good morning{name ? ', ' + name : ''}</span>
            <h1 className="mq">
              You’re all <em>set.</em>
            </h1>
            <p className="m-sub">Taking you to the rest of your day…</p>
          </div>
        ) : (
          <>
            <span className="eyebrow">
              Good morning · {done + 1} of {checks.length}
            </span>
            <span className="m-icon">{current.icon}</span>
            <Question text={questionFor(current)} />
            <p className="m-sub">Just this one thing first.</p>
            <button className="m-disc disc" style={cssVars(current.color, 'peach')} onClick={() => toggleCheck(current, date, true)}>
              Done
            </button>
            <button className="link m-later" onClick={() => setSkipped([...skipped, current.id])}>
              not yet
            </button>
            {after && (
              <div className="m-next">
                <span>Next</span>
                <span>
                  {after.icon} {after.name}
                </span>
              </div>
            )}
          </>
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
