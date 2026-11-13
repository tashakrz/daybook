import { useMemo, useState } from 'react'
import { save, remove } from '../lib/store.js'
import { today as todayStr, addDays, diffDays, fmtDay, fmtShort, monthGrid, sameMonth, addMonths, fmtMonth, parse, relDays } from '../lib/dates.js'
import { METHODS, PACK_TYPES, phaseLabel, phaseBlurb, segmentStats, groupStats, phasePatterns, dayMarks } from '../lib/cycle.js'
import { getSettings } from '../lib/model.js'
import { Icon, Section, Sheet, Field, Empty, Segmented } from '../components/ui.jsx'
import { openEditor } from '../components/EditorHost.jsx'
import { useCycle } from './Today.jsx'

const PHASE_COLORS = { menstrual: '#E57C8E', follicular: '#E9B949', ovulation: '#5FA8A3', luteal: '#9C8AD0' }

export default function Cycle() {
  const { pred, logs, bc } = useCycle()
  const today = todayStr()
  const settings = getSettings()
  const [tab, setTab] = useState('overview')
  return (
    <div className="page cycle">
      <header className="page-head">
        <div>
          <p className="eyebrow">Cycle · {METHODS[pred.method].label}</p>
          <h1>{headline(pred, today)}</h1>
        </div>
        <button className="btn primary rose" onClick={() => openEditor('period', null, today)}>
          <Icon name="plus" size={18} /> Log today
        </button>
      </header>

      <Segmented
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'stats', label: 'Stats' },
          { value: 'bc', label: 'Birth control' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="cycle-layout">
          <div className="stack">
            <StatusCard pred={pred} today={today} settings={settings} />
            {pred.notes.length > 0 && (
              <div className="card notes-card">
                {pred.notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            )}
          </div>
          <PeriodCalendar pred={pred} logs={logs} settings={settings} />
        </div>
      )}
      {tab === 'stats' && <Stats pred={pred} logs={logs} />}
      {tab === 'bc' && <BirthControl bc={bc} pred={pred} />}

      <p className="fine disclaimer">
        Predictions are estimates based on what you log and are not medical advice. Don’t use them to prevent pregnancy. If bleeding changes suddenly, is very heavy, or periods stop unexpectedly, check in with a doctor.
      </p>
    </div>
  )
}

function headline(pred, today) {
  if (pred.currentlyBleeding) return pred.mode === 'pill' ? 'Withdrawal bleed' : 'On your period'
  if (pred.next?.lateBy) return `Period ${pred.next.lateBy} day${pred.next.lateBy === 1 ? '' : 's'} late`
  if (pred.next?.start) {
    const n = diffDays(today, pred.next.start)
    const word = pred.mode === 'pill' ? 'Bleed' : 'Period'
    return n === 0 ? `${word} expected today` : `${word} in ${n} day${n === 1 ? '' : 's'}`
  }
  if (pred.mode === 'irregular') return 'Tracking your bleeding'
  return 'Your cycle'
}

/* ---------- status: ring / pill pack / irregular summary ---------- */
function StatusCard({ pred, today, settings }) {
  if (pred.mode === 'pill' && pred.packDay) return <PillPack pred={pred} today={today} />
  if (pred.mode === 'natural' && pred.cycleDay) return <Ring pred={pred} today={today} settings={settings} />
  return (
    <div className="card status-card">
      <div className="big-stats">
        {pred.daysSinceBleed != null && (
          <div>
            <strong>{pred.daysSinceBleed}</strong>
            <span>days since last bleed</span>
          </div>
        )}
        {pred.recentBleedDays != null && (
          <div>
            <strong>{pred.recentBleedDays}</strong>
            <span>bleeding/spotting days in last 90</span>
          </div>
        )}
        {pred.next?.start && (
          <div>
            <strong>{fmtShort(pred.next.start)}</strong>
            <span>rough next bleed (±{pred.next.range}d)</span>
          </div>
        )}
      </div>
      {!pred.episodes.length && <Empty>Tap “Log today” on a bleeding day to start.</Empty>}
    </div>
  )
}

function Ring({ pred, today, settings }) {
  const L = pred.cycleLength
  const day = Math.min(pred.cycleDay, L + (pred.next?.lateBy || 0))
  const total = Math.max(L, day)
  const ovDay = L - 13
  const showFertile = settings.showFertile
  const segs = [
    ['menstrual', 1, pred.periodLen],
    ['follicular', pred.periodLen + 1, ovDay - 2],
    ['ovulation', ovDay - 1, ovDay + 1],
    ['luteal', ovDay + 2, total],
  ].filter(([, a, b]) => b >= a)
  const R = 92
  const C = 2 * Math.PI * R
  const arc = (a, b) => ({ len: ((b - a + 1) / total) * C, off: -((a - 1) / total) * C })
  const angle = ((day - 0.5) / total) * 2 * Math.PI - Math.PI / 2
  const mx = 120 + R * Math.cos(angle)
  const my = 120 + R * Math.sin(angle)
  return (
    <div className="card ring-card">
      <svg viewBox="0 0 240 240" className="ring" role="img" aria-label={`Cycle day ${pred.cycleDay}, ${phaseLabel(pred.phase)} phase`}>
        <circle cx="120" cy="120" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
        {segs.map(([p, a, b]) => {
          const { len, off } = arc(a, b)
          return (
            <circle
              key={p}
              cx="120"
              cy="120"
              r={R}
              fill="none"
              stroke={PHASE_COLORS[p]}
              strokeOpacity={p === pred.phase ? 1 : 0.4}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - 3)} ${C}`}
              strokeDashoffset={off}
              transform="rotate(-90 120 120)"
              strokeLinecap="round"
            >
              <title>{`${phaseLabel(p)}: days ${a}–${b}`}</title>
            </circle>
          )
        })}
        <circle cx={mx} cy={my} r="11" fill="#fff" stroke="var(--ink)" strokeWidth="2.5" />
        <text x="120" y="104" textAnchor="middle" className="ring-small">
          Day
        </text>
        <text x="120" y="142" textAnchor="middle" className="ring-big">
          {pred.cycleDay}
        </text>
        <text x="120" y="166" textAnchor="middle" className="ring-small">
          {phaseLabel(pred.phase)}
        </text>
      </svg>
      <div className="ring-info">
        <p className="phase-blurb">{phaseBlurb(pred.phase)}</p>
        <dl className="kv">
          {pred.next && (
            <>
              <dt>Next period</dt>
              <dd>
                {pred.next.lateBy ? `${pred.next.lateBy} days late` : `${fmtDay(pred.next.start)} · ${relDays(pred.next.start, today)}`}
                <span className="muted"> ±{pred.next.range}d</span>
              </dd>
            </>
          )}
          {showFertile && pred.fertile && pred.fertile.end >= today && (
            <>
              <dt>Fertile window</dt>
              <dd>
                {fmtShort(pred.fertile.start)} – {fmtShort(pred.fertile.end)}
              </dd>
            </>
          )}
          {showFertile && pred.ovulation && pred.ovulation >= today && (
            <>
              <dt>Ovulation (est.)</dt>
              <dd>{fmtDay(pred.ovulation)}</dd>
            </>
          )}
          <dt>Confidence</dt>
          <dd className={`conf conf-${pred.confidence}`}>{pred.confidence}</dd>
        </dl>
        <div className="phase-legend">
          {Object.entries(PHASE_COLORS).map(([p, c]) => (
            <span key={p}>
              <i style={{ background: c }} /> {phaseLabel(p)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function PillPack({ pred, today }) {
  const active = pred.pack.active
  return (
    <div className="card pack-card">
      <div className="pack-head">
        <div>
          <strong className="big">Day {pred.packDay}</strong>
          <span className="muted"> of 28 · {pred.inPlacebo ? 'break / placebo days' : 'active pills'}</span>
        </div>
        {pred.next?.start && (
          <span className="tag soft" style={{ '--c-a': '#F4B6B6', '--c-ink': '#B4485D' }}>
            Next bleed ~{fmtShort(pred.next.start)}
          </span>
        )}
      </div>
      <div className="pack" role="img" aria-label={`Pill pack, day ${pred.packDay} of 28`}>
        {Array.from({ length: 28 }, (_, i) => {
          const d = i + 1
          return <span key={d} className={`pill ${d > active ? 'placebo' : ''} ${d < pred.packDay ? 'past' : ''} ${d === pred.packDay ? 'now' : ''}`} title={`Day ${d}`} />
        })}
      </div>
      <p className="muted small">
        {active < 28 ? `Bleeds usually start about ${pred.bleedOffset} day${pred.bleedOffset === 1 ? '' : 's'} into your break${pred.confidence === 'high' ? ' (learned from your logs)' : ''}.` : 'No scheduled break.'}{' '}
        New pack starts {fmtDay(addDays(today, 28 - pred.packDay + 1))}.
      </p>
    </div>
  )
}

/* ---------- calendar ---------- */
function PeriodCalendar({ pred, logs }) {
  const today = todayStr()
  const [month, setMonth] = useState(today)
  const logByDate = useMemo(() => Object.fromEntries(logs.map((l) => [l.date, l])), [logs])
  return (
    <div className="card period-cal">
      <div className="section-head">
        <h3>{fmtMonth(month)}</h3>
        <div className="head-actions">
          <button className="icon-btn soft" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <Icon name="left" />
          </button>
          <button className="icon-btn soft" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <Icon name="right" />
          </button>
        </div>
      </div>
      <div className="pc-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="pc-wd">
            {d}
          </span>
        ))}
        {monthGrid(month).map((d) => {
          const m = dayMarks(d, pred, logByDate)
          const log = logByDate[d]
          const hasSymptoms = log && (log.feelings?.length || log.pain?.length || log.sex?.length || log.discharge)
          return (
            <button
              key={d}
              disabled={d > today}
              className={`pc-day ${sameMonth(d, month) ? '' : 'other'} ${d === today ? 'is-today' : ''} ${m.flow ? 'flow-' + m.flow : ''} ${m.predicted ? 'predicted' : ''} ${m.fertile ? 'fertile' : ''} ${m.ovulation ? 'ovulation' : ''} ${m.placebo ? 'placebo' : ''}`}
              onClick={() => openEditor('period', null, d)}
              aria-label={fmtDay(d)}
            >
              {parse(d).getDate()}
              {hasSymptoms && <i className="sym" />}
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><i className="lg flow" /> Period</span>
        <span><i className="lg predicted" /> Predicted</span>
        {pred.mode === 'natural' && <span><i className="lg fertile" /> Fertile (est.)</span>}
        {pred.mode === 'natural' && <span><i className="lg ov" /> Ovulation (est.)</span>}
        {pred.mode === 'pill' && <span><i className="lg placebo" /> Pill break</span>}
        <span><i className="lg sym" /> Symptoms logged</span>
      </div>
    </div>
  )
}

/* ---------- stats ---------- */
const r1 = (x) => (x == null || isNaN(x) ? '–' : Math.round(x * 10) / 10)

function StatRow({ cycleStats: c, periodStats: p }) {
  return (
    <div className="stat-row">
      <div>
        <strong>{c.n ? r1(c.avg) : '–'}</strong>
        <span>avg cycle (days)</span>
      </div>
      <div>
        <strong>{c.n > 1 ? `±${r1(c.sd)}` : '–'}</strong>
        <span>variation{c.n > 1 ? ` · ${c.min}–${c.max}d` : ''}</span>
      </div>
      <div>
        <strong>{p.n ? r1(p.avg) : '–'}</strong>
        <span>avg period (days)</span>
      </div>
      <div>
        <strong>{c.n || 0}</strong>
        <span>cycles</span>
      </div>
    </div>
  )
}

function Stats({ pred, logs }) {
  const segs = segmentStats(pred)
  const groups = groupStats(pred)
  const patterns = phasePatterns(pred, logs)
  const recent = pred.cycles.filter((c) => !c.crosses && c.length >= 10 && c.length <= 120).slice(-12)
  const max = Math.max(35, ...recent.map((c) => c.length))
  if (!pred.episodes.length) return <Empty>Log a few periods to see your statistics.</Empty>
  return (
    <div className="stats-layout">
      <Section title="Off vs on hormonal birth control">
        <div className="card-grid two">
          <div className="card stat-card">
            <h4>Off hormonal BC</h4>
            <StatRow {...groups.off} />
          </div>
          <div className="card stat-card">
            <h4>On hormonal BC</h4>
            <StatRow {...groups.on} />
          </div>
        </div>
      </Section>

      {recent.length > 0 && (
        <Section title="Recent cycle lengths">
          <div className="card">
            <div className="bars" role="img" aria-label="Bar chart of recent cycle lengths">
              {recent.map((c) => {
                const hormonal = METHODS[c.method]?.hormonal
                return (
                  <div key={c.start} className="bar-col" title={`${fmtShort(c.start)}: ${c.length} days (${METHODS[c.method].short})`}>
                    <span className="plot">
                      <span className={`bar ${hormonal ? 'on' : 'off'}`} style={{ height: `${(c.length / max) * 100}%` }}>
                        <span className="bar-val">{c.length}</span>
                      </span>
                    </span>
                    <span className="bar-label">{fmtShort(c.start).replace(' ', ' ')}</span>
                  </div>
                )
              })}
            </div>
            <div className="legend">
              <span><i className="lg bar-off" /> Off hormonal BC</span>
              <span><i className="lg bar-on" /> On hormonal BC</span>
            </div>
          </div>
        </Section>
      )}

      <Section title="By birth control period">
        <div className="stack">
          {segs.map((s) => (
            <div className="card stat-card" key={s.seg.start}>
              <h4>
                {METHODS[s.seg.method].label}
                <span className="muted small">
                  {' '}
                  · {fmtShort(s.from)}
                  {s.from.slice(0, 4) !== (s.to || todayStr()).slice(0, 4) ? ` ${s.from.slice(0, 4)}` : ''} – {s.to ? fmtShort(s.to) + ' ' + s.to.slice(0, 4) : 'now'}
                </span>
              </h4>
              <StatRow cycleStats={s.cycleStats} periodStats={s.periodStats} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Patterns by phase">
        <div className="card-grid two">
          {Object.entries(patterns).map(([p, v]) => (
            <div className="card pattern-card" key={p} style={{ '--phase': PHASE_COLORS[p] }}>
              <h4>
                <i className="phase-dot" /> {phaseLabel(p)}
              </h4>
              {v.top.length ? (
                <ul>
                  {v.top.map((t) => (
                    <li key={t.tag}>
                      {t.tag} <span className="muted">· {t.pct}% of logged days</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Not enough logs yet.</p>
              )}
            </div>
          ))}
        </div>
        <p className="fine">Patterns use cycles while off hormonal birth control, where phases apply.</p>
      </Section>
    </div>
  )
}

/* ---------- birth control ---------- */
function BirthControl({ bc, pred }) {
  const [editing, setEditing] = useState(null)
  const sorted = [...bc].sort((a, b) => b.start.localeCompare(a.start))
  const current = pred.segment
  return (
    <div className="stack">
      <div className="card bc-current">
        <p className="eyebrow">Right now</p>
        <h3>{METHODS[current.method].label}</h3>
        <p className="muted">
          {current.implicit ? 'No method recorded.' : `Since ${fmtDay(current.start)}`}
          {current.bc?.packType && ` · ${PACK_TYPES[current.bc.packType].label}`}
        </p>
        <button className="btn primary" onClick={() => setEditing({ start: todayStr(), method: current.method === 'none' ? 'combined' : 'none', switching: true })}>
          I started / stopped / changed method
        </button>
        {current.bc && (
          <button className="btn ghost small" onClick={() => setEditing(current.bc)}>
            Edit current
          </button>
        )}
      </div>
      <Section title="History">
        {!sorted.length && <Empty>Add past methods too (e.g. “Combined pill, Jan 2023 – Aug 2025”) so your stats are split correctly.</Empty>}
        <ul className="bc-list">
          {sorted.map((b) => (
            <li key={b.id} className="card" onClick={() => setEditing(b)}>
              <strong>{METHODS[b.method].label}</strong>
              <span className="muted">
                {fmtDay(b.start)} – {b.end ? fmtDay(b.end) : 'now'}
              </span>
            </li>
          ))}
        </ul>
        <button className="btn ghost" onClick={() => setEditing({ start: '', end: '', method: 'combined' })}>
          <Icon name="plus" size={16} /> Add a past method
        </button>
      </Section>
      {editing && <BcEditor item={editing} bcList={bc} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BcEditor({ item, bcList, onClose }) {
  const [f, setF] = useState({ packType: '21-7', packStart: '', end: '', ...item })
  const isPill = f.method === 'combined'
  const submit = async (e) => {
    e.preventDefault()
    const { switching, ...rest } = f
    if (switching) {
      // close any open-ended method that started before this one
      for (const b of bcList) if (!b.end && b.start < f.start) await save('bc', { ...b, end: addDays(f.start, -1) })
    }
    if (rest.method === 'none' && switching) {
      await save('bc', { method: 'none', start: rest.start, end: '' })
    } else {
      await save('bc', { ...rest, end: rest.end || '', packStart: isPill ? rest.packStart || rest.start : '' })
    }
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={f.switching ? 'Change birth control' : item.id ? 'Edit method' : 'Add a past method'}>
      <form className="form" onSubmit={submit}>
        <Field label="Method">
          <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {Object.entries(METHODS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="row2">
          <Field label={f.switching ? 'Starting' : 'From'}>
            <input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required />
          </Field>
          {!f.switching && (
            <Field label="Until" hint="Empty = still using">
              <input type="date" value={f.end || ''} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} />
            </Field>
          )}
        </div>
        {isPill && (
          <>
            <Field label="Pack type">
              <Segmented
                options={Object.entries(PACK_TYPES).map(([k, p]) => ({ value: k, label: k === 'continuous' ? 'Continuous' : k }))}
                value={f.packType}
                onChange={(packType) => setF({ ...f, packType })}
              />
            </Field>
            <Field label="Day 1 of your current (or any) pack" hint="Used to place your break week. Any pack’s first day works.">
              <input type="date" value={f.packStart || ''} onChange={(e) => setF({ ...f, packStart: e.target.value })} />
            </Field>
          </>
        )}
        <div className="form-actions">
          {item.id && (
            <button type="button" className="btn ghost danger" onClick={() => window.confirm('Delete this method?') && remove(item.id).then(onClose)}>
              Delete
            </button>
          )}
          <button className="btn primary" type="submit" disabled={!f.start}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
