import { useState } from 'react'
import { Check, Icon, go } from './ui.jsx'
import { patch } from '../lib/store.js'
import { habitLogId, isDone, fmtAmount } from '../lib/model.js'
import { cssVars, color } from '../lib/colors.js'

export function HabitCard({ habit, log, date, settings }) {
  if (habit.type === 'water') return <WaterCard habit={habit} log={log} date={date} settings={settings} />
  if (habit.type === 'gym') return <NoteHabitCard habit={habit} log={log} date={date} />
  return <CheckHabitCard habit={habit} log={log} date={date} />
}

const setLog = (habit, date, changes) => patch(habitLogId(habit.id, date), { habitId: habit.id, date, ...changes }, 'habitlog')

function CheckHabitCard({ habit, log, date }) {
  const done = isDone(habit, log)
  return (
    <div className={`card habit check-habit ${done ? 'done' : ''}`} style={cssVars(habit.color, 'sage')}>
      <span className="habit-icon">{habit.icon}</span>
      <span className="habit-name">{habit.name}</span>
      <Check checked={done} color={habit.color} onChange={(v) => setLog(habit, date, { done: v })} label={`Mark ${habit.name} done`} />
    </div>
  )
}

function NoteHabitCard({ habit, log, date }) {
  const done = isDone(habit, log)
  const [open, setOpen] = useState(false)
  const note = log?.note || ''
  return (
    <div className={`card habit note-habit ${done ? 'done' : ''}`} style={cssVars(habit.color, 'sage')}>
      <div className="habit-top">
        <span className="habit-icon">{habit.icon}</span>
        <button className="habit-name link-like" onClick={() => setOpen(!open)}>
          {habit.name}
          {note && !open && <span className="habit-sub">{note.split('\n')[0]}</span>}
        </button>
        <Check checked={done} color={habit.color} onChange={(v) => (setLog(habit, date, { done: v }), v && setOpen(true))} label={`Mark ${habit.name} done`} />
      </div>
      {(open || (done && !note)) && (
        <div className="habit-more">
          <textarea
            rows={2}
            placeholder={habit.type === 'gym' ? 'What did you work out? e.g. legs + 20 min incline walk' : 'Notes…'}
            defaultValue={note}
            onBlur={(e) => e.target.value !== note && setLog(habit, date, { note: e.target.value })}
          />
          {habit.type === 'gym' && (
            <button className="btn ghost small" onClick={() => go('/habits?tab=routine')}>
              <Icon name="note" size={16} /> My routine
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function WaterGlass({ pct, colorId = 'sky', size = 74 }) {
  const c = color(colorId, 'sky')
  const h = 100
  const level = 8 + (1 - pct) * 86
  const id = `wg-${colorId}`
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 80 100" className="glass" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M10 6h60l-7 86a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5z" />
        </clipPath>
        <linearGradient id={`${id}-grad`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="1" stopColor={c.b} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" y="0" width="80" height={h} fill="#fff" opacity="0.6" />
        <path className="wave" d={`M-40 ${level} q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V100 H-40z`} fill={`url(#${id}-grad)`} />
      </g>
      <path d="M10 6h60l-7 86a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function WaterCard({ habit, log, date, settings }) {
  const amount = log?.amount || 0
  const goal = habit.goal || 2000
  const pct = Math.min(1, amount / goal)
  const entries = log?.entries || []
  const add = (ml) => setLog(habit, date, { amount: amount + ml, entries: [...entries, ml] })
  const undo = () => {
    if (!entries.length) return
    const last = entries[entries.length - 1]
    setLog(habit, date, { amount: Math.max(0, amount - last), entries: entries.slice(0, -1) })
  }
  const glasses = Math.round((amount / settings.glass) * 10) / 10
  return (
    <div className={`card habit water ${pct >= 1 ? 'done' : ''}`} style={cssVars(habit.color, 'sky')}>
      <WaterGlass pct={pct} colorId={habit.color} />
      <div className="water-info">
        <div className="habit-name">
          {habit.icon} {habit.name}
        </div>
        <div className="water-amount">
          <strong>{fmtAmount(amount, settings.unit)}</strong> <span className="muted">of {fmtAmount(goal, settings.unit)}</span>
        </div>
        <div className="muted small">
          {glasses} glass{glasses === 1 ? '' : 'es'} {pct >= 1 && '· goal reached 🎉'}
        </div>
        <div className="water-btns">
          <button className="pill-btn" onClick={() => add(settings.glass)}>
            + Glass <span>{fmtAmount(settings.glass, settings.unit)}</span>
          </button>
          <button className="pill-btn" onClick={() => add(settings.bottle)}>
            + Bottle <span>{fmtAmount(settings.bottle, settings.unit)}</span>
          </button>
          {entries.length > 0 && (
            <button className="icon-btn small" onClick={undo} aria-label="Undo last">
              ↺
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
