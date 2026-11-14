import { useMemo, useState } from 'react'
import { useItems } from '../lib/store.js'
import { monthGrid, sameMonth, addMonths, fmtMonth, fmtLong, parse, today as todayStr, diffDays } from '../lib/dates.js'
import { eventOn, isScheduled, isDone, habitLogId, reminderActive } from '../lib/model.js'
import { cssVars, DEFAULTS } from '../lib/colors.js'
import { dayMarks } from '../lib/cycle.js'
import { Icon, useRoute, go, Empty } from '../components/ui.jsx'
import { openEditor } from '../components/EditorHost.jsx'
import { AssignmentRow, useCycle } from './Today.jsx'
import { labelFor } from '../components/PeriodLogSheet.jsx'
import { useOutlook, currentEvents } from '../lib/outlook.js'
import { icsEventOn, fmtTimeRange } from '../lib/ics.js'
import { getSettings } from '../lib/model.js'

export default function Calendar() {
  const { params } = useRoute()
  const today = todayStr()
  const selected = params.d || today
  const [month, setMonth] = useState(selected)
  const select = (d) => go(`/calendar?d=${d}`)

  const assignments = useItems('assignment')
  const exams = useItems('exam')
  const events = useItems('event')
  const reminders = useItems('reminder')
  const classes = useItems('class')
  const habits = useItems('habit').filter((h) => !h.archived)
  const habitLogs = useItems('habitlog')
  const { pred, logs } = useCycle()
  const logByDate = useMemo(() => Object.fromEntries(logs.map((l) => [l.date, l])), [logs])
  const hlById = useMemo(() => Object.fromEntries(habitLogs.map((l) => [l.id, l])), [habitLogs])
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]))
  const outlook = currentEvents(useOutlook())
  useItems('settings')
  const olColor = getSettings().outlookColor

  const days = monthGrid(month)
  const itemsOn = (d) => ({
    events: events.filter((e) => eventOn(e, d)),
    exams: exams.filter((x) => x.date === d),
    assignments: assignments.filter((a) => a.due === d),
    reminders: reminders.filter((r) => r.date === d || (!r.done && d === today && reminderActive(r, d) && !r.date)),
    outlook: outlook.filter((e) => icsEventOn(e, d)),
  })

  return (
    <div className="page calendar">
      <header className="page-head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>{fmtMonth(month)}</h1>
        </div>
        <div className="head-actions">
          <button className="icon-btn soft" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <Icon name="left" />
          </button>
          <button className="btn ghost small" onClick={() => (setMonth(today), select(today))}>
            Today
          </button>
          <button className="icon-btn soft" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <Icon name="right" />
          </button>
        </div>
      </header>

      <div className="cal-layout">
        <div className="month panel">
          <div className="month-head">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="month-grid">
            {days.map((d) => {
              const it = itemsOn(d)
              const pm = dayMarks(d, pred, logByDate)
              const chips = [
                ...it.events.map((e) => ({ k: e.id, t: e.title, c: e.color || DEFAULTS.event })),
                ...it.exams.map((x) => ({ k: x.id, t: '📝 ' + x.title, c: x.color || DEFAULTS.exam })),
                ...it.assignments.map((a) => ({ k: a.id, t: a.title, c: a.color || classById[a.classId]?.color || DEFAULTS.school, done: a.done })),
                ...it.reminders.filter((r) => r.date === d).map((r) => ({ k: r.id, t: r.text, c: r.color || DEFAULTS.reminder, done: r.done })),
                // view-only Outlook events: plain text, listed after your own items
                ...it.outlook.map((e) => ({ k: e.id, t: e.title, time: e.time && e.date === d ? e.time.replace(/^0/, '') : null, c: olColor, plain: true })),
              ]
              return (
                <button
                  key={d}
                  className={`cell ${sameMonth(d, month) ? '' : 'other'} ${d === today ? 'is-today' : ''} ${d === selected ? 'is-sel' : ''} ${pm.flow ? 'flow-' + pm.flow : ''} ${pm.predicted ? 'predicted' : ''} ${pm.fertile ? 'fertile' : ''}`}
                  onClick={() => (select(d), sameMonth(d, month) || setMonth(d))}
                >
                  <span className="cell-num">
                    {parse(d).getDate()}
                    {pm.ovulation && <i className="ov" title="Estimated ovulation" />}
                  </span>
                  <span className="cell-chips">
                    {chips.slice(0, 4).map((c) =>
                      c.plain ? (
                        <span key={c.k} className="mini plain" style={cssVars(c.c)}>
                          <i />
                          {c.time && <span className="mini-time">{c.time}</span>}
                          {c.t}
                        </span>
                      ) : (
                        <span key={c.k} className={`mini ${c.done ? 'done' : ''}`} style={cssVars(c.c)}>
                          {c.t}
                        </span>
                      ),
                    )}
                    {chips.length > 4 && <span className="more">+{chips.length - 4}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="legend">
            <span><i className="lg flow" /> Period</span>
            <span><i className="lg predicted" /> Predicted</span>
            <span><i className="lg fertile" /> Fertile window (estimate)</span>
          </div>
        </div>

        <DayPanel
          date={selected}
          items={itemsOn(selected)}
          classById={classById}
          olColor={olColor}
          habits={habits}
          hlById={hlById}
          log={logByDate[selected]}
          marks={dayMarks(selected, pred, logByDate)}
        />
      </div>
    </div>
  )
}

function DayPanel({ date, items, olColor, classById, habits, hlById, log, marks }) {
  const today = todayStr()
  const sched = habits.filter((h) => isScheduled(h, date))
  const empty = !items.events.length && !items.exams.length && !items.assignments.length && !items.reminders.length && !items.outlook.length
  return (
    <aside className="day-panel panel">
      <div className="section-head">
        <h3>{date === today ? 'Today' : fmtLong(date)}</h3>
        <button className="icon-btn soft" onClick={() => openEditor('add', null, date)} aria-label="Add to this day">
          <Icon name="plus" />
        </button>
      </div>

      {empty && <Empty>Nothing planned.</Empty>}
      <ul className="agenda">
        {items.events.map((e) => (
          <li key={e.id} style={cssVars(e.color || DEFAULTS.event)} onClick={() => openEditor('event', e)}>
            <i className="bar" />
            <div>
              <strong>{e.title}</strong>
              <span className="muted small">
                {e.time || 'Important date'}
                {e.yearly && ' · yearly'}
              </span>
            </div>
          </li>
        ))}
        {items.outlook.map((e) => (
          <li key={e.id} style={cssVars(olColor)} className="readonly">
            <i className="bar" />
            <div>
              <strong>{e.title}</strong>
              <span className="muted small">
                {[e.allDay ? 'All day' : fmtTimeRange(e, date), e.location, 'Outlook'].filter(Boolean).join(' · ')}
              </span>
            </div>
          </li>
        ))}
        {items.exams.map((x) => (
          <li key={x.id} style={cssVars(x.color || DEFAULTS.exam)} onClick={() => openEditor('exam', x)}>
            <i className="bar" />
            <div>
              <strong>📝 {x.title}</strong>
              <span className="muted small">
                {[classById[x.classId]?.name, x.time, x.location].filter(Boolean).join(' · ') || 'Exam'}
              </span>
            </div>
          </li>
        ))}
        {items.reminders.map((r) => (
          <li key={r.id} style={cssVars(r.color || DEFAULTS.reminder)} onClick={() => openEditor('reminder', r)} className={r.done ? 'done' : ''}>
            <i className="bar" />
            <div>
              <strong>🔔 {r.text}</strong>
              <span className="muted small">{r.done ? 'Done' : 'Reminder'}</span>
            </div>
          </li>
        ))}
      </ul>
      {items.assignments.length > 0 && (
        <>
          <h4 className="mini-head">Due</h4>
          <ul className="task-list">
            {items.assignments.map((a) => (
              <AssignmentRow key={a.id} a={a} cls={classById[a.classId]} date={today} />
            ))}
          </ul>
        </>
      )}

      {(log || marks.predicted || marks.fertile || marks.placebo) && (
        <div className="cycle-day" style={cssVars('rose')} onClick={() => openEditor('period', null, date)}>
          <h4 className="mini-head">Cycle</h4>
          <p>
            {log?.flow && <span className="tag">{labelFor('flow', log.flow)} flow</span>}
            {marks.predicted && <span className="tag soft">Predicted period</span>}
            {marks.ovulation ? <span className="tag soft">Estimated ovulation</span> : marks.fertile && <span className="tag soft">Fertile window (estimate)</span>}
            {marks.placebo && <span className="tag soft">Pill break / placebo</span>}
            {[...(log?.feelings || []), ...(log?.pain || [])].map((t) => (
              <span className="tag soft" key={t}>
                {t}
              </span>
            ))}
          </p>
        </div>
      )}
      {date <= today && (
        <button className="btn ghost small" onClick={() => openEditor('period', null, date)} style={cssVars('rose')}>
          <Icon name="cycle" size={16} /> {log ? 'Edit cycle log' : 'Log cycle'}
        </button>
      )}

      {date <= today && sched.length > 0 && (
        <>
          <h4 className="mini-head">Dailies</h4>
          <ul className="daily-recap">
            {sched.map((h) => {
              const l = hlById[habitLogId(h.id, date)]
              const done = isDone(h, l)
              return (
                <li key={h.id} className={done ? 'done' : ''} style={cssVars(h.color)}>
                  <span>{done ? '●' : '○'}</span> {h.icon} {h.name}
                  {h.type === 'water' && l?.amount ? <span className="muted"> · {l.amount} ml</span> : null}
                  {l?.note && <span className="muted"> · {l.note}</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {date > today && diffDays(today, date) <= 1 && sched.length > 0 && <p className="muted small">{sched.length} dailies scheduled.</p>}
    </aside>
  )
}

