import { useState } from 'react'
import { Sheet, Chips, Icon } from './ui.jsx'
import { useItem, patch, remove } from '../lib/store.js'
import { periodLogId } from '../lib/model.js'
import { addDays, fmtLong, today } from '../lib/dates.js'
import { useItems } from '../lib/store.js'
import { buildSegments, segmentAt, METHODS } from '../lib/cycle.js'

export const OPTIONS = {
  flow: [
    { value: 'spotting', label: 'Spotting', icon: '·' },
    { value: 'light', label: 'Light', icon: '💧' },
    { value: 'medium', label: 'Medium', icon: '💧💧' },
    { value: 'heavy', label: 'Heavy', icon: '💧💧💧' },
  ],
  feelings: [
    { value: 'happy', label: 'Happy', icon: '😊' },
    { value: 'calm', label: 'Calm', icon: '😌' },
    { value: 'energetic', label: 'Energetic', icon: '⚡' },
    { value: 'confident', label: 'Confident', icon: '💪' },
    { value: 'sensitive', label: 'Sensitive', icon: '🥺' },
    { value: 'sad', label: 'Sad', icon: '😢' },
    { value: 'anxious', label: 'Anxious', icon: '😰' },
    { value: 'irritable', label: 'Irritable', icon: '😤' },
    { value: 'mood swings', label: 'Mood swings', icon: '🎢' },
    { value: 'tired', label: 'Tired', icon: '😴' },
    { value: 'cravings', label: 'Cravings', icon: '🍫' },
    { value: 'unfocused', label: 'Unfocused', icon: '🌫️' },
  ],
  pain: [
    { value: 'cramps', label: 'Cramps' },
    { value: 'headache', label: 'Headache' },
    { value: 'backache', label: 'Lower back' },
    { value: 'tender breasts', label: 'Tender breasts' },
    { value: 'bloating', label: 'Bloating' },
    { value: 'nausea', label: 'Nausea' },
    { value: 'ovulation pain', label: 'Ovulation pain' },
    { value: 'acne', label: 'Acne' },
    { value: 'digestion', label: 'Upset stomach' },
  ],
  painLevel: [
    { value: 1, label: 'Mild' },
    { value: 2, label: 'Moderate' },
    { value: 3, label: 'Severe' },
  ],
  sex: [
    { value: 'none', label: 'Didn’t have sex' },
    { value: 'protected', label: 'Protected sex' },
    { value: 'unprotected', label: 'Unprotected sex' },
    { value: 'solo', label: 'Masturbation' },
    { value: 'high drive', label: 'High sex drive' },
    { value: 'low drive', label: 'Low sex drive' },
  ],
  discharge: [
    { value: 'none', label: 'None / dry' },
    { value: 'sticky', label: 'Sticky' },
    { value: 'creamy', label: 'Creamy' },
    { value: 'egg white', label: 'Egg white' },
    { value: 'watery', label: 'Watery' },
    { value: 'unusual', label: 'Unusual' },
  ],
  pill: [
    { value: 'taken', label: 'Taken' },
    { value: 'late', label: 'Late' },
    { value: 'missed', label: 'Missed' },
    { value: 'double', label: 'Took 2' },
  ],
}
export const labelFor = (group, value) => OPTIONS[group]?.find((o) => o.value === value)?.label || value

const FIELDS = ['flow', 'feelings', 'pain', 'painLevel', 'sex', 'discharge', 'pill', 'notes']

export function PeriodLogSheet({ date: initialDate, onClose }) {
  const [date, setDate] = useState(initialDate || today())
  const id = periodLogId(date)
  const log = useItem(id) || {}
  const bc = useItems('bc')
  const seg = segmentAt(buildSegments(bc), date)
  const onPill = seg.method === 'combined' || seg.method === 'minipill'

  const update = async (k, v) => {
    const next = { ...log, date, [k]: v }
    delete next.id
    const empty = FIELDS.every((f) => next[f] == null || next[f] === '' || (Array.isArray(next[f]) && !next[f].length))
    if (empty) await remove(id)
    else await patch(id, { [k]: v, date }, 'periodlog')
  }

  return (
    <Sheet open onClose={onClose} title="Cycle log" wide>
      <div className="date-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <Icon name="left" />
        </button>
        <strong>{date === today() ? 'Today' : fmtLong(date)}</strong>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day" disabled={date >= today()}>
          <Icon name="right" />
        </button>
      </div>
      <div className="log-groups">
        <LogGroup title="Flow">
          <Chips options={OPTIONS.flow} value={log.flow || null} onChange={(v) => update('flow', v)} color="rose" />
        </LogGroup>
        <LogGroup title="Feelings">
          <Chips multi options={OPTIONS.feelings} value={log.feelings} onChange={(v) => update('feelings', v)} color="peach" />
        </LogGroup>
        <LogGroup title="Pain & body">
          <Chips multi options={OPTIONS.pain} value={log.pain} onChange={(v) => update('pain', v)} color="plum" />
          {log.pain?.length > 0 && (
            <div className="sub">
              <span className="muted">How bad?</span>
              <Chips small options={OPTIONS.painLevel} value={log.painLevel ?? null} onChange={(v) => update('painLevel', v)} color="plum" />
            </div>
          )}
        </LogGroup>
        <LogGroup title="Sex & drive">
          <Chips multi options={OPTIONS.sex} value={log.sex} onChange={(v) => update('sex', v)} color="lavender" />
        </LogGroup>
        <LogGroup title="Discharge">
          <Chips options={OPTIONS.discharge} value={log.discharge || null} onChange={(v) => update('discharge', v)} color="teal" />
        </LogGroup>
        {onPill && (
          <LogGroup title={`${METHODS[seg.method].short} today`}>
            <Chips options={OPTIONS.pill} value={log.pill || null} onChange={(v) => update('pill', v)} color="sage" />
          </LogGroup>
        )}
        <LogGroup title="Notes">
          <textarea rows={3} defaultValue={log.notes || ''} key={date} onBlur={(e) => e.target.value !== (log.notes || '') && update('notes', e.target.value)} placeholder="Anything else…" />
        </LogGroup>
      </div>
      <p className="fine">Changes save automatically.</p>
    </Sheet>
  )
}

function LogGroup({ title, children }) {
  return (
    <div className="log-group">
      <h4>{title}</h4>
      {children}
    </div>
  )
}
