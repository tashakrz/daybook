import { useState } from 'react'
import { Icon, Sheet, go } from './ui.jsx'
import { patch } from '../lib/store.js'
import { habitLogId, isDone, fmtAmount } from '../lib/model.js'
import { cssVars } from '../lib/colors.js'
import { fmtLong, today } from '../lib/dates.js'

const setLog = (habit, date, changes) => patch(habitLogId(habit.id, date), { habitId: habit.id, date, ...changes }, 'habitlog')

/** Big square tile for a daily: tap to tick off. Water fills up; gym/notes gets a note button. */
export function HabitTile({ habit, log, date, settings }) {
  if (habit.type === 'water') return <WaterTile habit={habit} log={log} date={date} settings={settings} />
  return <CheckTile habit={habit} log={log} date={date} />
}

function CheckTile({ habit, log, date }) {
  const done = isDone(habit, log)
  const [noteOpen, setNoteOpen] = useState(false)
  const hasNote = habit.type === 'gym'
  return (
    <>
      <button
        className={`tile disc ${done ? 'done' : ''}`}
        style={cssVars(habit.color, 'sage')}
        onClick={() => {
          setLog(habit, date, { done: !done })
          if (!done && hasNote && !log?.note) setNoteOpen(true)
        }}
        aria-pressed={done}
      >
        <span className="tile-top">
          <span className="tile-icon">{habit.icon}</span>
          <span className="tile-check">{done && <Icon name="check" size={16} stroke={2.4} />}</span>
        </span>
        <span className="tile-name">{habit.name}</span>
        <span className="tile-sub">{log?.note ? log.note.split('\n')[0] : done ? 'done' : 'tap when done'}</span>
        {hasNote && (
          <span
            className="tile-note"
            role="button"
            tabIndex={0}
            aria-label="Add a note"
            onClick={(e) => {
              e.stopPropagation()
              setNoteOpen(true)
            }}
          >
            <Icon name="edit" size={15} />
          </span>
        )}
      </button>
      {noteOpen && <NoteSheet habit={habit} log={log} date={date} onClose={() => setNoteOpen(false)} />}
    </>
  )
}

function NoteSheet({ habit, log, date, onClose }) {
  const [text, setText] = useState(log?.note || '')
  const close = () => {
    if (text !== (log?.note || '')) setLog(habit, date, { note: text })
    onClose()
  }
  return (
    <Sheet open onClose={close} title={`${habit.icon} ${habit.name}${date === today() ? '' : ' · ' + fmtLong(date)}`}>
      <div className="form">
        <textarea
          rows={4}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={habit.type === 'gym' ? 'What did you work out? e.g. legs + 20 min incline walk' : 'Notes…'}
        />
        <div className="form-actions">
          {habit.type === 'gym' && (
            <button className="btn ghost small" onClick={() => (close(), go('/habits?tab=routine'))}>
              <Icon name="note" size={16} /> My routine
            </button>
          )}
          <button className="btn primary" onClick={close}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function WaterTile({ habit, log, date, settings }) {
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
  return (
    <div className={`tile water-tile ${pct >= 1 ? 'done' : ''}`} style={{ ...cssVars(habit.color, 'sky'), '--fill': pct }}>
      <span className="water-fill disc" aria-hidden="true" />
      <span className="tile-top">
        <span className="tile-icon">{habit.icon}</span>
        {entries.length > 0 && (
          <button className="tile-undo" onClick={undo} aria-label="Undo last">
            ↺
          </button>
        )}
      </span>
      <span className="tile-name">{fmtAmount(amount, settings.unit)}</span>
      <span className="tile-sub">of {fmtAmount(goal, settings.unit)}{pct >= 1 ? ' 🎉' : ''}</span>
      <span className="tile-btns">
        <button onClick={() => add(settings.glass)} aria-label="Add a glass">+ glass</button>
        <button onClick={() => add(settings.bottle)}>+ bottle</button>
      </span>
    </div>
  )
}
