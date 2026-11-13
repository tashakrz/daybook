import { useEffect, useMemo, useState } from 'react'
import { useItems, patch, save } from '../lib/store.js'
import { today as todayStr, addDays, fmtLong, fmtDay, fmtWeekday, weekOf, relDays, diffDays, parse } from '../lib/dates.js'
import { isScheduled, isDone, reminderActive, getSettings, nextOccurrence, eventOn, habitLogId } from '../lib/model.js'
import { cssVars, DEFAULTS } from '../lib/colors.js'
import { predict, phaseLabel, METHODS } from '../lib/cycle.js'
import { HabitCard } from '../components/HabitCards.jsx'
import { Check, Icon, Section, Empty, go, Segmented } from '../components/ui.jsx'
import { openEditor } from '../components/EditorHost.jsx'
import { REMINDER_MODES } from '../components/editors.jsx'

export function useToday() {
  // re-render when the date changes while the app stays open
  const [d, setD] = useState(todayStr())
  useEffect(() => {
    const t = setInterval(() => {
      const n = todayStr()
      if (n !== d) setD(n)
    }, 60000)
    return () => clearInterval(t)
  }, [d])
  return d
}

export function useCycle() {
  const logs = useItems('periodlog')
  const bc = useItems('bc')
  const settingsItem = useItems('settings')
  const date = todayStr()
  return useMemo(() => ({ pred: predict({ logs, bc, settings: getSettings(), today: date }), logs, bc }), [logs, bc, settingsItem, date])
}

export default function Today() {
  const date = useToday()
  const settings = getSettings()
  useItems('settings')
  const habits = useItems('habit').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const logs = useItems('habitlog')
  const assignments = useItems('assignment')
  const exams = useItems('exam')
  const reminders = useItems('reminder')
  const events = useItems('event')
  const classes = useItems('class')
  const { pred } = useCycle()

  const logById = useMemo(() => Object.fromEntries(logs.map((l) => [l.id, l])), [logs])
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]))
  const todays = habits.filter((h) => !h.archived && isScheduled(h, date))
  const doneCount = todays.filter((h) => isDone(h, logById[habitLogId(h.id, date)])).length

  const soon = addDays(date, 7)
  const dueSoon = assignments.filter((a) => !a.done && a.due <= soon).sort((a, b) => (a.due + (a.dueTime || '')).localeCompare(b.due + (b.dueTime || '')))
  const recentlyDone = assignments.filter((a) => a.done && a.doneAt === date)
  const activeRem = reminders.filter((r) => reminderActive(r, date)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  const laterRem = reminders.filter((r) => !r.done && !reminderActive(r, date))
  const doneRem = reminders.filter((r) => r.done && r.doneAt === date)

  const upcoming = [
    ...events.map((e) => ({ id: e.id, date: nextOccurrence(e, date), title: e.title, color: e.color || DEFAULTS.event, kind: 'event', item: e })),
    ...exams.filter((x) => x.date >= date).map((x) => ({ id: x.id, date: x.date, title: x.title + (classById[x.classId] ? ` · ${classById[x.classId].name}` : ''), color: x.color || DEFAULTS.exam, kind: 'exam', item: x })),
  ]
    .filter((u) => u.date >= date && u.date <= addDays(date, 45))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
  const ongoing = events.filter((e) => !e.yearly && e.endDate && e.date < date && e.endDate >= date)

  const hour = new Date().getHours()
  const greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page today">
      <header className="page-head">
        <div>
          <p className="eyebrow">{fmtLong(date)}</p>
          <h1>
            {greet}
            {settings.name ? `, ${settings.name}` : ''}
          </h1>
        </div>
        <CycleChip pred={pred} />
      </header>

      <WeekStrip date={date} habits={habits} logById={logById} assignments={assignments} events={events} exams={exams} pred={pred} />

      {(upcoming.length > 0 || ongoing.length > 0) && (
        <div className="upcoming">
          <span className="upcoming-label">Coming up</span>
          <ul>
            {ongoing.map((e) => (
              <li key={'on' + e.id} style={cssVars(e.color || DEFAULTS.event)} onClick={() => openEditor('event', e)}>
                <i className="dot" /> {e.title} <span className="muted">· until {fmtDay(e.endDate)}</span>
              </li>
            ))}
            {upcoming.map((u) => (
              <li key={u.kind + u.id} style={cssVars(u.color)} onClick={() => openEditor(u.kind, u.item)}>
                <i className="dot" />
                <span className="up-date">{u.date === date ? 'Today' : fmtDay(u.date)}</span> {u.kind === 'exam' && '📝 '}
                {u.title} <span className="muted">· {relDays(u.date, date)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="today-grid">
        <Section
          title={
            <>
              Dailies <span className="count">{doneCount}/{todays.length}</span>
            </>
          }
          action={
            <button className="link" onClick={() => go('/habits')}>
              History →
            </button>
          }
          className="dailies"
        >
          {todays.length === 0 && <Empty>Nothing scheduled today.</Empty>}
          <div className="habit-list">
            {todays.map((h) => (
              <HabitCard key={h.id} habit={h} log={logById[habitLogId(h.id, date)]} date={date} settings={settings} />
            ))}
          </div>
        </Section>

        <div className="today-col">
          <Section
            title="Due soon"
            action={
              <button className="icon-btn soft" onClick={() => openEditor('assignment')} aria-label="Add assignment">
                <Icon name="plus" />
              </button>
            }
          >
            {dueSoon.length === 0 && recentlyDone.length === 0 && <Empty>No assignments due this week. 🌿</Empty>}
            <ul className="task-list">
              {dueSoon.map((a) => (
                <AssignmentRow key={a.id} a={a} cls={classById[a.classId]} date={date} />
              ))}
              {recentlyDone.map((a) => (
                <AssignmentRow key={a.id} a={a} cls={classById[a.classId]} date={date} />
              ))}
            </ul>
          </Section>

          <Section title="Reminders">
            <QuickReminder />
            <ul className="task-list">
              {activeRem.map((r) => (
                <ReminderRow key={r.id} r={r} date={date} />
              ))}
              {doneRem.map((r) => (
                <ReminderRow key={r.id} r={r} date={date} />
              ))}
            </ul>
            {laterRem.length > 0 && (
              <details className="later">
                <summary>
                  {laterRem.length} scheduled for later
                </summary>
                <ul className="task-list">
                  {laterRem
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((r) => (
                      <ReminderRow key={r.id} r={r} date={date} />
                    ))}
                </ul>
              </details>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function CycleChip({ pred }) {
  let text = null
  if (pred.mode === 'pill' && pred.packDay) text = `Pack day ${pred.packDay}${pred.inPlacebo ? ' · break' : ''}`
  else if (pred.currentlyBleeding) text = 'On your period'
  else if (pred.cycleDay && pred.phase) text = `Day ${pred.cycleDay} · ${phaseLabel(pred.phase)}`
  else if (pred.next?.start) text = `Period ${relDays(pred.next.start)}`
  else if (pred.mode === 'irregular') text = METHODS[pred.method].short
  if (!text) return null
  return (
    <button className="cycle-chip" onClick={() => go('/cycle')} style={cssVars('rose')}>
      <Icon name="cycle" size={16} /> {text}
    </button>
  )
}

function WeekStrip({ date, habits, logById, assignments, events, exams, pred }) {
  const days = weekOf(date)
  return (
    <div className="week-strip">
      {days.map((d) => {
        const sched = habits.filter((h) => !h.archived && isScheduled(h, d))
        const done = sched.filter((h) => isDone(h, logById[habitLogId(h.id, d)])).length
        const pct = sched.length ? done / sched.length : 0
        const hasDue = assignments.some((a) => !a.done && a.due === d)
        const hasEvent = events.some((e) => eventOn(e, d)) || exams.some((x) => x.date === d)
        const period = pred.episodes?.some((e) => d >= e.start && d <= e.end) || pred.futurePeriods?.some((p) => d >= p.start && d <= p.end)
        return (
          <button key={d} className={`wk-day ${d === date ? 'is-today' : ''} ${d > date ? 'future' : ''}`} onClick={() => go(`/calendar?d=${d}`)}>
            <span className="wk-name">{fmtWeekday(d).slice(0, 2)}</span>
            <span className="wk-num" style={{ '--p': d <= date ? pct : 0 }}>
              {parse(d).getDate()}
            </span>
            <span className="wk-dots">
              {hasDue && <i style={cssVars('sky')} />}
              {hasEvent && <i style={cssVars('teal')} />}
              {period && <i style={cssVars('rose')} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function AssignmentRow({ a, cls, date }) {
  const colorId = a.color || cls?.color || DEFAULTS.school
  const days = diffDays(date, a.due)
  const when = a.done ? 'done' : days < 0 ? `overdue · ${fmtDay(a.due)}` : days === 0 ? `due today${a.dueTime ? ' ' + a.dueTime : ''}` : days === 1 ? 'due tomorrow' : `due ${fmtDay(a.due)}`
  return (
    <li className={`task ${a.done ? 'done' : ''} ${!a.done && days < 0 ? 'overdue' : ''}`} style={cssVars(colorId)}>
      <Check checked={!!a.done} color={colorId} onChange={(v) => patch(a.id, { done: v, doneAt: v ? todayStr() : null })} label="Mark done" />
      <button className="task-body" onClick={() => openEditor('assignment', a)}>
        <span className="task-title">{a.title}</span>
        <span className="task-meta">
          {cls && <span className="tag">{cls.name}</span>} {when}
        </span>
      </button>
    </li>
  )
}

function ReminderRow({ r, date }) {
  const colorId = r.color || DEFAULTS.reminder
  let when = ''
  if (r.date) {
    const d = diffDays(date, r.date)
    when = d < 0 ? `was due ${fmtDay(r.date)}` : d === 0 ? 'last day today' : r.mode === 'leadup' ? `${d} day${d === 1 ? '' : 's'} left · ${fmtDay(r.date)}` : fmtDay(r.date)
  }
  return (
    <li className={`task reminder ${r.done ? 'done' : ''} ${r.date && r.date < date && !r.done ? 'overdue' : ''}`} style={cssVars(colorId)}>
      <Check checked={!!r.done} color={colorId} onChange={(v) => patch(r.id, { done: v, doneAt: v ? todayStr() : null })} label="Mark done" />
      <button className="task-body" onClick={() => openEditor('reminder', r)}>
        <span className="task-title">{r.text}</span>
        {when && <span className="task-meta">{when}</span>}
      </button>
    </li>
  )
}

function QuickReminder() {
  const s = getSettings()
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [mode, setMode] = useState(s.reminderDefaultMode)
  const [open, setOpen] = useState(false)
  const add = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    await save('reminder', { text: text.trim(), date, mode, color: DEFAULTS.reminder, done: false, created: todayStr() })
    setText('')
    setDate('')
    setOpen(false)
  }
  return (
    <form className="quick-add" onSubmit={add}>
      <div className="quick-row">
        <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setOpen(true)} placeholder="Jot a reminder…" aria-label="New reminder" />
        <button className="icon-btn soft" type="submit" aria-label="Add reminder" disabled={!text.trim()}>
          <Icon name="plus" />
        </button>
      </div>
      {open && (
        <div className="quick-opts">
          <label>
            <span className="muted small">By</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {date && <Segmented options={REMINDER_MODES} value={mode} onChange={setMode} />}
        </div>
      )}
    </form>
  )
}
