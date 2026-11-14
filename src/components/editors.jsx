// Add / edit forms for each kind of item, shown in bottom sheets.
import { useState } from 'react'
import { Sheet, Field, ColorPicker, Segmented, Chips } from './ui.jsx'
import { save, remove, useItems } from '../lib/store.js'
import { today, addDays } from '../lib/dates.js'
import { DEFAULTS } from '../lib/colors.js'
import { getSettings } from '../lib/model.js'

function Actions({ onDelete, saveLabel = 'Save', disabled }) {
  return (
    <div className="form-actions">
      {onDelete && (
        <button type="button" className="btn ghost danger" onClick={onDelete}>
          Delete
        </button>
      )}
      <button type="submit" className="btn primary" disabled={disabled}>
        {saveLabel}
      </button>
    </div>
  )
}

function useForm(initial) {
  const [f, setF] = useState(initial)
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }) })
  return [f, setF, bind]
}

const confirmDelete = (what) => window.confirm(`Delete this ${what}?`)

/* ---------- class ---------- */
export function ClassEditor({ item, onClose }) {
  const [f, setF, bind] = useForm(item || { name: '', color: DEFAULTS.school })
  const submit = async (e) => {
    e.preventDefault()
    await save('class', { ...f, name: f.name.trim() })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={item?.id ? 'Edit class' : 'New class'}>
      <form onSubmit={submit} className="form">
        <Field label="Class name">
          <input {...bind('name')} placeholder="e.g. Biology" autoFocus required />
        </Field>
        <Field label="Colour">
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />
        </Field>
        <Actions
          disabled={!f.name.trim()}
          onDelete={item?.id && (() => confirmDelete('class') && remove(item.id).then(onClose))}
        />
      </form>
    </Sheet>
  )
}

const CLASS_COLORS = ['sky', 'lavender', 'teal', 'peach', 'sun', 'plum', 'sage', 'rose', 'clay']
/** Optional class tag. "New class…" creates one on the spot. */
function ClassSelect({ value, onChange }) {
  const classes = useItems('class').sort((a, b) => a.name.localeCompare(b.name))
  const pick = async (v) => {
    if (v !== '__new') return onChange(v || null)
    const name = window.prompt('Class name (e.g. BIOL 150)')?.trim()
    if (!name) return
    const existing = classes.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (existing) return onChange(existing.id)
    const id = await save('class', { name, color: CLASS_COLORS[classes.length % CLASS_COLORS.length] })
    onChange(id)
  }
  return (
    <select value={value || ''} onChange={(e) => pick(e.target.value)}>
      <option value="">No class</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value="__new">＋ New class…</option>
    </select>
  )
}

/* ---------- assignment ---------- */
export function AssignmentEditor({ item, onClose, date }) {
  const [f, setF, bind] = useForm(item || { title: '', classId: null, due: date || addDays(today(), 1), dueTime: '', notes: '', done: false, color: null })
  const submit = async (e) => {
    e.preventDefault()
    await save('assignment', { ...f, title: f.title.trim() })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={item?.id ? 'Edit assignment' : 'New assignment'}>
      <form onSubmit={submit} className="form">
        <Field label="What’s due">
          <input {...bind('title')} placeholder="e.g. Lab report" autoFocus required />
        </Field>
        <Field label="Class">
          <ClassSelect value={f.classId} onChange={(classId) => setF({ ...f, classId })} />
        </Field>
        <div className="row2">
          <Field label="Due date">
            <input type="date" {...bind('due')} required />
          </Field>
          <Field label="Time (optional)">
            <input type="time" {...bind('dueTime')} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={3} {...bind('notes')} />
        </Field>
        <Field label="Colour" hint="Leave unset to use the class colour.">
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color: f.color === color ? null : color })} />
        </Field>
        <Actions disabled={!f.title.trim()} onDelete={item?.id && (() => confirmDelete('assignment') && remove(item.id).then(onClose))} />
      </form>
    </Sheet>
  )
}

/* ---------- exam ---------- */
export function ExamEditor({ item, onClose, date }) {
  const [f, setF, bind] = useForm(item || { title: '', classId: null, date: date || addDays(today(), 7), time: '', location: '', notes: '', color: null })
  const submit = async (e) => {
    e.preventDefault()
    await save('exam', { ...f, title: f.title.trim() })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={item?.id ? 'Edit exam' : 'New exam or test'}>
      <form onSubmit={submit} className="form">
        <Field label="Exam / test">
          <input {...bind('title')} placeholder="e.g. Midterm" autoFocus required />
        </Field>
        <Field label="Class">
          <ClassSelect value={f.classId} onChange={(classId) => setF({ ...f, classId })} />
        </Field>
        <div className="row2">
          <Field label="Date">
            <input type="date" {...bind('date')} required />
          </Field>
          <Field label="Time">
            <input type="time" {...bind('time')} />
          </Field>
        </div>
        <Field label="Where">
          <input {...bind('location')} placeholder="Room, building…" />
        </Field>
        <Field label="Study notes">
          <textarea rows={3} {...bind('notes')} />
        </Field>
        <Field label="Colour" hint="Leave unset to use lavender.">
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color: f.color === color ? null : color })} />
        </Field>
        <Actions disabled={!f.title.trim()} onDelete={item?.id && (() => confirmDelete('exam') && remove(item.id).then(onClose))} />
      </form>
    </Sheet>
  )
}

/* ---------- reminder ---------- */
export const REMINDER_MODES = [
  { value: 'leadup', label: 'Every day until then' },
  { value: 'day', label: 'Only on the day' },
]
export function ReminderEditor({ item, onClose, date }) {
  const s = getSettings()
  const [f, setF, bind] = useForm(item || { text: '', date: date || '', mode: s.reminderDefaultMode, color: DEFAULTS.reminder, done: false })
  const submit = async (e) => {
    e.preventDefault()
    await save('reminder', { ...f, text: f.text.trim(), created: f.created || today() })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={item?.id ? 'Edit reminder' : 'New reminder'}>
      <form onSubmit={submit} className="form">
        <Field label="Remind me to…">
          <input {...bind('text')} autoFocus required />
        </Field>
        <Field label="Last day to do it" hint="Leave empty to keep it on your list until you tick it off.">
          <input type="date" {...bind('date')} />
        </Field>
        {f.date && (
          <Field label="Show it">
            <Segmented options={REMINDER_MODES} value={f.mode} onChange={(mode) => setF({ ...f, mode })} />
          </Field>
        )}
        <Field label="Colour">
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />
        </Field>
        <Actions disabled={!f.text.trim()} onDelete={item?.id && (() => confirmDelete('reminder') && remove(item.id).then(onClose))} />
      </form>
    </Sheet>
  )
}

/* ---------- important date / event ---------- */
export function EventEditor({ item, onClose, date }) {
  const [f, setF, bind] = useForm(item || { title: '', date: date || today(), endDate: '', time: '', yearly: false, notes: '', color: DEFAULTS.event })
  const submit = async (e) => {
    e.preventDefault()
    await save('event', { ...f, title: f.title.trim(), endDate: f.endDate && f.endDate > f.date ? f.endDate : '' })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={item?.id ? 'Edit date' : 'New important date'}>
      <form onSubmit={submit} className="form">
        <Field label="What’s happening">
          <input {...bind('title')} placeholder="e.g. Mom’s birthday, spring break" autoFocus required />
        </Field>
        <div className="row2">
          <Field label="Date">
            <input type="date" {...bind('date')} required />
          </Field>
          <Field label="Ends (optional)">
            <input type="date" {...bind('endDate')} min={f.date} />
          </Field>
        </div>
        <Field label="Time (optional)">
          <input type="time" {...bind('time')} />
        </Field>
        <label className="toggle-row">
          <input type="checkbox" checked={!!f.yearly} onChange={(e) => setF({ ...f, yearly: e.target.checked })} />
          Repeats every year
        </label>
        <Field label="Notes">
          <textarea rows={2} {...bind('notes')} />
        </Field>
        <Field label="Colour">
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />
        </Field>
        <Actions disabled={!f.title.trim()} onDelete={item?.id && (() => confirmDelete('date') && remove(item.id).then(onClose))} />
      </form>
    </Sheet>
  )
}

/* ---------- habit / daily ---------- */
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export function HabitEditor({ item, onClose }) {
  const [f, setF, bind] = useForm(
    item || { name: '', type: 'check', icon: '✨', color: DEFAULTS.daily, schedule: { type: 'daily' }, goal: 2000, order: Date.now() },
  )
  const s = f.schedule || { type: 'daily' }
  const setSched = (patch) => setF({ ...f, schedule: { ...s, ...patch } })
  const submit = async (e) => {
    e.preventDefault()
    const schedule = s.type === 'interval' ? { ...s, every: Math.max(1, Number(s.every) || 1), start: s.start || today() } : s
    await save('habit', { ...f, name: f.name.trim(), goal: Number(f.goal) || 2000, schedule })
    onClose()
  }
  const builtIn = item?.id === 'habit-water' || item?.id === 'habit-gym'
  return (
    <Sheet open onClose={onClose} title={item?.id ? 'Edit daily' : 'New daily'}>
      <form onSubmit={submit} className="form">
        <div className="row2 narrow-first">
          <Field label="Icon">
            <input {...bind('icon')} maxLength={4} className="emoji-input" />
          </Field>
          <Field label="Name">
            <input {...bind('name')} placeholder="e.g. Skincare, read 10 pages" autoFocus={!item} required />
          </Field>
        </div>
        {!builtIn && (
          <Field label="Kind">
            <Segmented
              options={[
                { value: 'check', label: 'Checkmark' },
                { value: 'water', label: 'Amount (water)' },
                { value: 'gym', label: 'Check + notes' },
              ]}
              value={f.type}
              onChange={(type) => setF({ ...f, type })}
            />
          </Field>
        )}
        {f.type === 'water' && (
          <Field label="Daily goal (ml)" hint="2000 ml ≈ 8 glasses ≈ 68 oz">
            <input type="number" inputMode="numeric" min={100} step={50} {...bind('goal')} />
          </Field>
        )}
        <Field label="Repeats">
          <Segmented
            options={[
              { value: 'daily', label: 'Every day' },
              { value: 'weekdays', label: 'Some days' },
              { value: 'interval', label: 'Every few days' },
            ]}
            value={s.type}
            onChange={(type) => setSched({ type, days: s.days || [1, 2, 3, 4, 5], every: s.every || 2 })}
          />
        </Field>
        {s.type === 'weekdays' && (
          <div className="weekday-pick">
            {WEEKDAYS.map((d, i) => {
              const on = (s.days || []).includes(i)
              return (
                <button type="button" key={i} className={on ? 'on' : ''} onClick={() => setSched({ days: on ? s.days.filter((x) => x !== i) : [...(s.days || []), i] })}>
                  {d}
                </button>
              )
            })}
          </div>
        )}
        {s.type === 'interval' && (
          <div className="row2">
            <Field label="Every … days">
              <input type="number" min={1} inputMode="numeric" value={s.every || 2} onChange={(e) => setSched({ every: e.target.value })} />
            </Field>
            <Field label="Starting">
              <input type="date" value={s.start || today()} onChange={(e) => setSched({ start: e.target.value })} />
            </Field>
          </div>
        )}
        <Field label="Colour">
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />
        </Field>
        <Actions
          disabled={!f.name.trim()}
          onDelete={item?.id && (() => confirmDelete('daily (and its history)') && remove(item.id).then(onClose))}
        />
      </form>
    </Sheet>
  )
}

/* ---------- quick pick of what to add for a date ---------- */
export function AddMenu({ date, onClose, onPick }) {
  return (
    <Sheet open onClose={onClose} title="Add to this day">
      <Chips
        color="stone"
        options={[
          { value: 'event', label: 'Important date', icon: '📌' },
          { value: 'assignment', label: 'Assignment', icon: '📚' },
          { value: 'exam', label: 'Exam / test', icon: '📝' },
          { value: 'reminder', label: 'Reminder', icon: '🔔' },
        ]}
        value={null}
        onChange={(v) => v && onPick(v, date)}
      />
    </Sheet>
  )
}
