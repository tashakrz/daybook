import { useItems } from '../lib/store.js'
import { today as todayStr, addDays, diffDays, fmtDay } from '../lib/dates.js'
import { cssVars, DEFAULTS } from '../lib/colors.js'
import { Icon, Section, Empty, Segmented, useLocal } from '../components/ui.jsx'
import { openEditor } from '../components/EditorHost.jsx'
import { AssignmentRow } from './Today.jsx'

export default function School() {
  const [tab, setTab] = useLocal('daybook:school-tab', 'assignments')
  return (
    <div className="page school">
      <header className="page-head">
        <div>
          <p className="eyebrow">School</p>
          <h1>{tab === 'assignments' ? 'Assignments' : tab === 'exams' ? 'Exams & tests' : 'Classes'}</h1>
        </div>
        <button className="btn primary" onClick={() => openEditor(tab === 'assignments' ? 'assignment' : tab === 'exams' ? 'exam' : 'class')}>
          <Icon name="plus" size={18} /> Add
        </button>
      </header>
      <Segmented
        options={[
          { value: 'assignments', label: 'Assignments' },
          { value: 'exams', label: 'Exams' },
          { value: 'classes', label: 'Classes' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'assignments' && <Assignments />}
      {tab === 'exams' && <Exams />}
      {tab === 'classes' && <Classes />}
    </div>
  )
}

function Assignments() {
  const today = todayStr()
  const items = useItems('assignment').sort((a, b) => (a.due + (a.dueTime || '')).localeCompare(b.due + (b.dueTime || '')))
  const classById = Object.fromEntries(useItems('class').map((c) => [c.id, c]))
  const open = items.filter((a) => !a.done)
  const groups = [
    ['Overdue', open.filter((a) => a.due < today)],
    ['Today', open.filter((a) => a.due === today)],
    ['This week', open.filter((a) => a.due > today && a.due <= addDays(today, 7))],
    ['Later', open.filter((a) => a.due > addDays(today, 7))],
  ]
  const done = items.filter((a) => a.done).reverse()
  return (
    <div className="stack">
      {!items.length && <Empty>No assignments yet. Tap Add to create one.</Empty>}
      {groups.map(
        ([title, list]) =>
          list.length > 0 && (
            <Section key={title} title={title} className={title === 'Overdue' ? 'warn' : ''}>
              <ul className="task-list">
                {list.map((a) => (
                  <AssignmentRow key={a.id} a={a} cls={classById[a.classId]} date={today} />
                ))}
              </ul>
            </Section>
          ),
      )}
      {done.length > 0 && (
        <details className="later">
          <summary>{done.length} completed</summary>
          <ul className="task-list">
            {done.slice(0, 50).map((a) => (
              <AssignmentRow key={a.id} a={a} cls={classById[a.classId]} date={today} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Exams() {
  const today = todayStr()
  const items = useItems('exam').sort((a, b) => a.date.localeCompare(b.date))
  const classById = Object.fromEntries(useItems('class').map((c) => [c.id, c]))
  const upcoming = items.filter((x) => x.date >= today)
  const past = items.filter((x) => x.date < today).reverse()
  const Card = ({ x }) => {
    const n = diffDays(today, x.date)
    const cls = classById[x.classId]
    return (
      <button className="card exam-card" style={cssVars(x.color || cls?.color || DEFAULTS.exam)} onClick={() => openEditor('exam', x)}>
        <div className="countdown">
          <strong>{n < 0 ? '✓' : n}</strong>
          <span>{n < 0 ? 'past' : n === 0 ? 'today' : n === 1 ? 'day' : 'days'}</span>
        </div>
        <div>
          <span className="task-title">{x.title}</span>
          <span className="task-meta">{[cls?.name, fmtDay(x.date), x.time, x.location].filter(Boolean).join(' · ')}</span>
          {x.notes && <span className="muted small clamp">{x.notes}</span>}
        </div>
      </button>
    )
  }
  return (
    <div className="stack">
      {!items.length && <Empty>No exams yet. Tap Add to create one.</Empty>}
      <div className="card-grid">
        {upcoming.map((x) => (
          <Card key={x.id} x={x} />
        ))}
      </div>
      {past.length > 0 && (
        <details className="later">
          <summary>{past.length} past</summary>
          <div className="card-grid">
            {past.map((x) => (
              <Card key={x.id} x={x} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function Classes() {
  const classes = useItems('class').sort((a, b) => a.name.localeCompare(b.name))
  const assignments = useItems('assignment')
  const exams = useItems('exam')
  const today = todayStr()
  return (
    <div className="stack">
      {!classes.length && <Empty>Add your classes to colour-code assignments and exams.</Empty>}
      <div className="card-grid">
        {classes.map((c) => {
          const open = assignments.filter((a) => a.classId === c.id && !a.done).length
          const next = exams.filter((x) => x.classId === c.id && x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
          return (
            <button key={c.id} className="card class-card" style={cssVars(c.color)} onClick={() => openEditor('class', c)}>
              <span className="class-swatch" />
              <span className="task-title">{c.name}</span>
              <span className="task-meta">
                {open} open assignment{open === 1 ? '' : 's'}
                {next && ` · next exam ${fmtDay(next.date)}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
