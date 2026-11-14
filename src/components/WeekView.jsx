// Weekly time-block view for the Calendar page.
import { useEffect, useRef, useState } from 'react'
import { weekOf, parse, fmtWeekday, today as todayStr } from '../lib/dates.js'
import { cssVars, DEFAULTS } from '../lib/colors.js'
import { dayMarks } from '../lib/cycle.js'
import { openEditor } from './EditorHost.jsx'

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const fmtHour = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' }).replace(':00', '')
const fmtT = (min) => {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '').replace(/:00$/, '')
}

/** Timed blocks and all-day items for one day. */
function dayContent(d, it, classById, olColor) {
  const blocks = []
  const allDay = []
  for (const e of it.outlook) {
    if (e.allDay) {
      allDay.push({ k: e.id, t: e.title, c: olColor, outlook: true })
      continue
    }
    const start = e.date === d ? toMin(e.time) : 0
    const end = e.endDate === d || !e.endTime ? (e.endTime && e.endDate === d ? toMin(e.endTime) : start + 60) : 24 * 60
    blocks.push({ k: e.id, t: e.title, sub: e.location, start, end: Math.max(end, start + 15), c: olColor, outlook: true })
  }
  for (const x of it.exams) {
    const c = x.color || classById[x.classId]?.color || DEFAULTS.exam
    if (x.time) blocks.push({ k: x.id, t: '📝 ' + x.title, sub: x.location, start: toMin(x.time), end: toMin(x.time) + 60, c, open: () => openEditor('exam', x) })
    else allDay.push({ k: x.id, t: '📝 ' + x.title, c, open: () => openEditor('exam', x) })
  }
  for (const e of it.events) {
    const c = e.color || DEFAULTS.event
    if (e.time && e.date === d) blocks.push({ k: e.id, t: e.title, start: toMin(e.time), end: toMin(e.time) + 60, c, open: () => openEditor('event', e) })
    else allDay.push({ k: e.id, t: e.title, c, open: () => openEditor('event', e) })
  }
  for (const a of it.assignments)
    allDay.push({ k: a.id, t: (a.dueTime ? `Due ${fmtT(toMin(a.dueTime))} · ` : 'Due · ') + a.title, c: a.color || classById[a.classId]?.color || DEFAULTS.school, done: a.done, open: () => openEditor('assignment', a) })
  for (const r of it.reminders.filter((r) => r.date === d))
    allDay.push({ k: r.id, t: '🔔 ' + r.text, c: r.color || DEFAULTS.reminder, done: r.done, open: () => openEditor('reminder', r) })

  // side-by-side columns for overlapping blocks
  blocks.sort((a, b) => a.start - b.start || b.end - a.end)
  let cluster = []
  let clusterEnd = -1
  const flush = () => {
    const cols = []
    for (const b of cluster) {
      let i = cols.findIndex((end) => end <= b.start)
      if (i < 0) i = cols.push(0) - 1
      cols[i] = b.end
      b.col = i
    }
    for (const b of cluster) b.cols = cols.length
    cluster = []
  }
  for (const b of blocks) {
    if (b.start >= clusterEnd && cluster.length) flush()
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.end)
  }
  flush()
  return { blocks, allDay }
}

export function WeekView({ selected, select, itemsOn, classById, olColor, pred, logByDate }) {
  const today = todayStr()
  const days = weekOf(selected)
  const content = days.map((d) => dayContent(d, itemsOn(d), classById, olColor))
  const all = content.flatMap((c) => c.blocks)
  const startH = Math.min(8, ...all.map((b) => Math.floor(b.start / 60)))
  const endH = Math.max(20, ...all.map((b) => Math.ceil(b.end / 60)))
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)
  const hasAllDay = content.some((c) => c.allDay.length)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const scroller = useRef(null)
  useEffect(() => {
    // on phones the grid scrolls: start near the first event (or 8am)
    const el = scroller.current
    if (!el || el.scrollHeight <= el.clientHeight) return
    const first = Math.min(...all.map((b) => b.start), 8 * 60)
    el.scrollTop = Math.max(0, ((first - startH * 60) / 60) * parseFloat(getComputedStyle(el).getPropertyValue('--hour-h')) - 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]])

  return (
    <div className="week panel">
      <div className="wv-head">
        <span className="wv-gutter" />
        {days.map((d) => {
          const m = dayMarks(d, pred, logByDate)
          return (
            <button key={d} className={`wv-day ${d === today ? 'is-today' : ''} ${d === selected ? 'is-sel' : ''}`} onClick={() => select(d)}>
              <span className="wv-wd">{fmtWeekday(d)}</span>
              <span className="wv-num">{parse(d).getDate()}</span>
              <i className={`wv-cycle ${m.flow ? 'flow' : m.predicted ? 'predicted' : m.fertile ? 'fertile' : ''}`} />
            </button>
          )
        })}
      </div>

      {hasAllDay && (
        <div className="wv-allday">
          <span className="wv-gutter wv-label">all day</span>
          {content.map((c, i) => (
            <div key={days[i]} className="wv-allday-col" onClick={() => select(days[i])}>
              {c.allDay.map((a) => (
                <button
                  key={a.k}
                  className={`wv-chip ${a.outlook ? 'outlook' : ''} ${a.done ? 'done' : ''}`}
                  style={cssVars(a.c)}
                  title={a.t}
                  onClick={(e) => {
                    e.stopPropagation()
                    a.open ? a.open() : select(days[i])
                  }}
                >
                  {a.t}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="wv-scroll" ref={scroller}>
        <div className="wv-body" style={{ '--rows': hours.length }}>
          <div className="wv-gutter wv-hours">
            {hours.map((h) => (
              <span key={h}>{fmtHour(h)}</span>
            ))}
          </div>
          {content.map((c, i) => {
            const d = days[i]
            return (
              <div key={d} className={`wv-col ${d === selected ? 'is-sel' : ''}`} onClick={() => select(d)}>
                {c.blocks.map((b) => (
                  <button
                    key={b.k}
                    className={`wv-block ${b.outlook ? 'outlook' : ''}`}
                    style={{
                      ...cssVars(b.c),
                      top: `calc(${(b.start - startH * 60) / 60} * var(--hour-h))`,
                      height: `calc(${(b.end - b.start) / 60} * var(--hour-h) - 2px)`,
                      left: `calc(${(b.col / b.cols) * 100}% + 1px)`,
                      width: `calc(${100 / b.cols}% - 2px)`,
                    }}
                    title={`${fmtT(b.start)}–${fmtT(b.end)} ${b.t}${b.sub ? ' · ' + b.sub : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      b.open ? b.open() : select(d)
                    }}
                  >
                    <span className="wv-time">{fmtT(b.start)}</span>
                    <span className="wv-title">{b.t}</span>
                    {b.sub && b.end - b.start >= 75 && <span className="wv-sub">{b.sub.split(' (')[0]}</span>}
                  </button>
                ))}
                {d === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                  <i className="wv-now" style={{ top: `calc(${(nowMin - startH * 60) / 60} * var(--hour-h))` }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
