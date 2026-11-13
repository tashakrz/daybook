import { useMemo, useState } from 'react'
import { useItems, save, remove } from '../lib/store.js'
import { today as todayStr, addDays, fmtDay, fmtShort, dow, parse } from '../lib/dates.js'
import { isScheduled, isDone, progress, streak, habitLogId, scheduleText, getSettings, fmtAmount } from '../lib/model.js'
import { cssVars, color } from '../lib/colors.js'
import { Icon, Section, Empty, Segmented, useRoute, go } from '../components/ui.jsx'
import { openEditor } from '../components/EditorHost.jsx'

export default function Habits() {
  const { params } = useRoute()
  const tab = params.tab || 'history'
  return (
    <div className="page habits">
      <header className="page-head">
        <div>
          <p className="eyebrow">Dailies</p>
          <h1>{tab === 'routine' ? 'Workout routine' : tab === 'manage' ? 'Manage dailies' : 'History'}</h1>
        </div>
        {tab === 'manage' && (
          <button className="btn primary" onClick={() => openEditor('habit')}>
            <Icon name="plus" size={18} /> New daily
          </button>
        )}
      </header>
      <Segmented
        options={[
          { value: 'history', label: 'History' },
          { value: 'routine', label: 'Routine' },
          { value: 'manage', label: 'Manage' },
        ]}
        value={tab}
        onChange={(t) => go(`/habits?tab=${t}`)}
      />
      {tab === 'history' && <History />}
      {tab === 'routine' && <Routine />}
      {tab === 'manage' && <Manage />}
    </div>
  )
}

function History() {
  const habits = useItems('habit').filter((h) => !h.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const logs = useItems('habitlog')
  const byId = useMemo(() => Object.fromEntries(logs.map((l) => [l.id, l])), [logs])
  const settings = getSettings()
  if (!habits.length) return <Empty>No dailies yet.</Empty>
  return (
    <div className="stack">
      {habits.map((h) => (
        <HabitHistory key={h.id} h={h} byId={byId} settings={settings} />
      ))}
    </div>
  )
}

function HabitHistory({ h, byId, settings }) {
  const today = todayStr()
  const weeks = 18
  const gridStart = addDays(today, -dow(today) - (weeks - 1) * 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -29 + i))
  const sched30 = last30.filter((d) => isScheduled(h, d))
  const done30 = sched30.filter((d) => isDone(h, byId[habitLogId(h.id, d)])).length
  const s = streak(h, byId, today)
  const c = color(h.color, 'sage')
  const [hover, setHover] = useState(null)
  return (
    <Section
      title={
        <>
          {h.icon} {h.name}
        </>
      }
      action={<span className="muted small">{scheduleText(h)}</span>}
    >
      <div className="card habit-history" style={cssVars(h.color)}>
        <div className="big-stats">
          <div>
            <strong>{s}</strong>
            <span>day streak</span>
          </div>
          <div>
            <strong>{sched30.length ? Math.round((done30 / sched30.length) * 100) : 0}%</strong>
            <span>last 30 days</span>
          </div>
          <div>
            <strong>
              {done30}/{sched30.length}
            </strong>
            <span>days done</span>
          </div>
        </div>

        <div className="heatmap-wrap">
          <div className="heatmap" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }} role="img" aria-label={`${h.name} completion over the last ${weeks} weeks`}>
            {days.map((d) => {
              const future = d > today
              const sched = isScheduled(h, d)
              const p = future ? 0 : progress(h, byId[habitLogId(h.id, d)])
              const style = { gridRow: dow(d) + 1 }
              if (p > 0) style.background = `color-mix(in srgb, ${c.b} ${Math.round(25 + p * 75)}%, ${c.a})`
              if (p >= 1) style.background = c.b
              return (
                <span
                  key={d}
                  className={`hm ${future ? 'future' : ''} ${!sched ? 'off' : ''} ${p > 0 ? 'some' : ''} ${d === today ? 'is-today' : ''}`}
                  style={style}
                  onMouseEnter={() => setHover(d)}
                  onClick={() => setHover(d)}
                />
              )
            })}
          </div>
          <div className="heatmap-key muted small">
            {hover ? <HoverText h={h} d={hover} log={byId[habitLogId(h.id, hover)]} settings={settings} /> : 'Tap a square for details · faded squares = not scheduled'}
          </div>
        </div>

        {h.type === 'water' && <WaterBars h={h} byId={byId} settings={settings} />}
        {h.type === 'gym' && <WorkoutLog h={h} byId={byId} />}
      </div>
    </Section>
  )
}

function HoverText({ h, d, log, settings }) {
  const done = isDone(h, log)
  let t = `${fmtDay(d)}: `
  if (h.type === 'water') t += `${fmtAmount(log?.amount || 0, settings.unit)} of ${fmtAmount(h.goal || 2000, settings.unit)}`
  else t += done ? 'done' : isScheduled(h, d) ? 'not done' : 'not scheduled'
  if (log?.note) t += ` · ${log.note}`
  return <span>{t}</span>
}

function WaterBars({ h, byId, settings }) {
  const today = todayStr()
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i))
  const goal = h.goal || 2000
  const vals = days.map((d) => byId[habitLogId(h.id, d)]?.amount || 0)
  const max = Math.max(goal * 1.25, ...vals)
  const [sel, setSel] = useState(null)
  return (
    <div className="water-chart">
      <h4 className="mini-head">Last 14 days</h4>
      <div className="bars water-bars" role="img" aria-label="Water per day for the last 14 days">
        {days.map((d, i) => (
          <div key={d} className={`bar-col ${sel === d ? 'sel' : ''}`} onMouseEnter={() => setSel(d)} onClick={() => setSel(d)}>
            <span className="plot">
              <span className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }} />
              <span className={`bar ${vals[i] >= goal ? 'full' : ''}`} style={{ height: `${(vals[i] / max) * 100}%` }} />
            </span>
            <span className="bar-label">{parse(d).getDate()}</span>
          </div>
        ))}
      </div>
      <p className="muted small">{sel ? `${fmtDay(sel)}: ${fmtAmount(vals[days.indexOf(sel)], settings.unit)}` : `Dashed line = goal (${fmtAmount(goal, settings.unit)})`}</p>
    </div>
  )
}

function WorkoutLog({ h, byId }) {
  const entries = Object.values(byId)
    .filter((l) => l.habitId === h.id && (l.done || l.note))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
  return (
    <div className="workout-log">
      <h4 className="mini-head">Recent workouts</h4>
      {!entries.length && <p className="muted small">Nothing logged yet.</p>}
      <ul>
        {entries.map((l) => (
          <li key={l.id}>
            <span className="wl-date">{fmtShort(l.date)}</span>
            <span>{l.note || <span className="muted">Done</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- routine notes ---------- */
function Routine() {
  const notes = useItems('routine').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const [openId, setOpenId] = useState(null)
  const add = async () => {
    const id = await save('routine', { title: 'New day', body: '', order: Date.now() })
    setOpenId(id)
  }
  return (
    <div className="stack">
      <p className="muted">Notes for your workout split — e.g. “Push day”, “Legs”, “Cardio”.</p>
      <div className="card-grid two">
        {notes.map((n) => (
          <RoutineNote key={n.id} n={n} open={openId === n.id} onOpen={() => setOpenId(openId === n.id ? null : n.id)} />
        ))}
      </div>
      <button className="btn ghost" onClick={add}>
        <Icon name="plus" size={16} /> Add a routine note
      </button>
    </div>
  )
}

function RoutineNote({ n, open, onOpen }) {
  return (
    <div className="card routine-note">
      {open ? (
        <>
          <input className="title-input" defaultValue={n.title} onBlur={(e) => e.target.value !== n.title && save('routine', { ...n, title: e.target.value })} />
          <textarea rows={10} defaultValue={n.body} placeholder={'Bench 3×8\nIncline DB press 3×10\n…'} onBlur={(e) => e.target.value !== n.body && save('routine', { ...n, body: e.target.value })} />
          <div className="form-actions">
            <button className="btn ghost danger small" onClick={() => window.confirm('Delete this note?') && remove(n.id)}>
              Delete
            </button>
            <button className="btn ghost small" onClick={onOpen}>
              Done
            </button>
          </div>
        </>
      ) : (
        <button className="routine-preview" onClick={onOpen}>
          <strong>{n.title}</strong>
          <span className="muted pre">{n.body || 'Tap to write…'}</span>
        </button>
      )}
    </div>
  )
}

/* ---------- manage ---------- */
function Manage() {
  const habits = useItems('habit').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const move = async (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= habits.length) return
    const a = habits[i]
    const b = habits[j]
    await save('habit', { ...a, order: j })
    await save('habit', { ...b, order: i })
    for (let k = 0; k < habits.length; k++) if (k !== i && k !== j && habits[k].order !== k) await save('habit', { ...habits[k], order: k })
  }
  return (
    <ul className="manage-list">
      {habits.map((h, i) => (
        <li key={h.id} className={`card ${h.archived ? 'archived' : ''}`} style={cssVars(h.color)}>
          <span className="habit-icon">{h.icon}</span>
          <button className="task-body" onClick={() => openEditor('habit', h)}>
            <span className="task-title">{h.name}</span>
            <span className="task-meta">
              {scheduleText(h)}
              {h.archived && ' · paused'}
            </span>
          </button>
          <button className="btn ghost small" onClick={() => save('habit', { ...h, archived: !h.archived })}>
            {h.archived ? 'Resume' : 'Pause'}
          </button>
          <div className="order-btns">
            <button className="icon-btn small" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>
              ↑
            </button>
            <button className="icon-btn small" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === habits.length - 1}>
              ↓
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
