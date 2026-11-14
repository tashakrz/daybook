// Minimal iCalendar (.ics) reader for published Outlook calendars.
// Times with a TZID are treated as wall-clock times (fine when the calendar and
// this device share a time zone); UTC times ("Z") are converted to local time.
import { addDays, toStr, parse as parseDate, diffDays } from './dates.js'

const pad = (n) => String(n).padStart(2, '0')

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

function parseLine(line) {
  const i = line.indexOf(':')
  if (i < 0) return null
  const head = line.slice(0, i)
  const value = line.slice(i + 1)
  const [name, ...ps] = head.split(';')
  const params = {}
  for (const p of ps) {
    const [k, v = ''] = p.split('=')
    params[k.toUpperCase()] = v.replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value }
}

const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()

/** -> { date: 'YYYY-MM-DD', time: 'HH:MM' | null } */
function parseWhen(value, params = {}) {
  const v = value.trim()
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: null }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, , z] = m
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
    return { date: toStr(dt), time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
  }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` }
}

function parseRRule(v) {
  const r = {}
  for (const part of v.split(';')) {
    const [k, val] = part.split('=')
    r[k.toUpperCase()] = val
  }
  return {
    freq: r.FREQ,
    interval: Math.max(1, Number(r.INTERVAL) || 1),
    count: r.COUNT ? Number(r.COUNT) : null,
    until: r.UNTIL ? parseWhen(r.UNTIL)?.date : null,
    byday: r.BYDAY ? r.BYDAY.split(',') : null,
    bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null,
    bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number) : null,
    bysetpos: r.BYSETPOS ? r.BYSETPOS.split(',').map(Number) : null,
    wkst: r.WKST,
  }
}

const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()

/** Dates (YYYY-MM-DD) in a month matching BYDAY / BYMONTHDAY rules. */
function monthCandidates(y, m, rule, startDate) {
  const n = daysInMonth(y, m)
  const all = Array.from({ length: n }, (_, i) => toStr(new Date(y, m, i + 1)))
  let out
  if (rule.byday) {
    out = []
    for (const bd of rule.byday) {
      const mm = bd.match(/^([+-]?\d+)?([A-Z]{2})$/)
      if (!mm) continue
      const wd = DAYS[mm[2]]
      const matches = all.filter((d) => parseDate(d).getDay() === wd)
      if (mm[1]) {
        const k = Number(mm[1])
        const pick = k > 0 ? matches[k - 1] : matches[matches.length + k]
        if (pick) out.push(pick)
      } else out.push(...matches)
    }
    if (rule.bymonthday) out = out.filter((d) => rule.bymonthday.includes(parseDate(d).getDate()))
  } else if (rule.bymonthday) {
    out = rule.bymonthday.map((k) => (k > 0 ? all[k - 1] : all[n + k])).filter(Boolean)
  } else {
    const day = parseDate(startDate).getDate()
    out = day <= n ? [all[day - 1]] : []
  }
  out = [...new Set(out)].sort()
  if (rule.bysetpos) out = rule.bysetpos.map((p) => (p > 0 ? out[p - 1] : out[out.length + p])).filter(Boolean)
  return out
}

/** All occurrence start dates of a recurring event up to `to`. */
function expand(startDate, rule, to) {
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) return [startDate]
  const out = []
  const limit = rule.until && rule.until < to ? rule.until : to
  const s = parseDate(startDate)
  let produced = 0
  for (let i = 0; i < 5000; i++) {
    let cands = []
    if (rule.freq === 'DAILY') cands = [addDays(startDate, i * rule.interval)]
    else if (rule.freq === 'WEEKLY') {
      const weekStart = addDays(startDate, -s.getDay() + i * 7 * rule.interval)
      const days = rule.byday ? rule.byday.map((b) => DAYS[b.slice(-2)]).filter((x) => x != null) : [s.getDay()]
      cands = [...new Set(days)].sort().map((wd) => addDays(weekStart, wd))
    } else if (rule.freq === 'MONTHLY') {
      const d = new Date(s.getFullYear(), s.getMonth() + i * rule.interval, 1)
      cands = monthCandidates(d.getFullYear(), d.getMonth(), rule, startDate)
    } else {
      const y = s.getFullYear() + i * rule.interval
      const months = rule.bymonth ? rule.bymonth.map((m) => m - 1) : [s.getMonth()]
      const r = rule.byday || rule.bymonthday ? rule : { ...rule, bymonthday: [s.getDate()] }
      for (const m of months) cands.push(...monthCandidates(y, m, r, startDate))
    }
    let done = false
    for (const d of cands.sort()) {
      if (d < startDate) continue
      if (d > limit || (rule.count != null && produced >= rule.count)) {
        done = true
        break
      }
      produced++
      out.push(d)
    }
    if (done) break
  }
  return out
}

/**
 * Parse an .ics file into concrete events between `from` and `to` (inclusive).
 * Each event: { id, title, location, date, endDate, time, endTime, allDay }
 */
export function parseIcs(text, from, to) {
  const lines = unfold(text)
  const raw = []
  let cur = null
  let depth = 0
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { exdates: new Set() }
      depth = 0
      continue
    }
    if (!cur) continue
    if (line.startsWith('BEGIN:')) depth++
    else if (line.startsWith('END:') && line !== 'END:VEVENT') depth--
    if (line === 'END:VEVENT') {
      raw.push(cur)
      cur = null
      continue
    }
    if (depth > 0) continue // skip VALARM etc.
    const p = parseLine(line)
    if (!p) continue
    if (p.name === 'SUMMARY') cur.title = unescape(p.value)
    else if (p.name === 'LOCATION') cur.location = unescape(p.value)
    else if (p.name === 'UID') cur.uid = p.value
    else if (p.name === 'DTSTART') cur.start = parseWhen(p.value, p.params)
    else if (p.name === 'DTEND') cur.end = parseWhen(p.value, p.params)
    else if (p.name === 'DURATION') cur.duration = p.value
    else if (p.name === 'RRULE') cur.rrule = parseRRule(p.value)
    else if (p.name === 'EXDATE') for (const v of p.value.split(',')) {
      const w = parseWhen(v, p.params)
      if (w) cur.exdates.add(w.date)
    }
    else if (p.name === 'RECURRENCE-ID') cur.recurrenceId = parseWhen(p.value, p.params)?.date
    else if (p.name === 'STATUS') cur.status = p.value.toUpperCase()
    else if (p.name === 'X-MICROSOFT-CDO-BUSYSTATUS' || p.name === 'TRANSP') cur[p.name] = p.value
  }

  // overrides of single occurrences
  const overridden = new Map()
  for (const e of raw) if (e.recurrenceId && e.uid) {
    if (!overridden.has(e.uid)) overridden.set(e.uid, new Set())
    overridden.get(e.uid).add(e.recurrenceId)
  }

  const out = []
  for (const e of raw) {
    if (!e.start || e.status === 'CANCELLED') continue
    const allDay = e.start.time == null
    // length in days (all-day DTEND is exclusive)
    let spanDays = 0
    if (e.end) {
      spanDays = diffDays(e.start.date, e.end.date)
      if (allDay || (e.end.time === '00:00' && spanDays > 0)) spanDays -= 1
      spanDays = Math.max(0, spanDays)
    } else if (e.duration) {
      const m = e.duration.match(/P(?:(\d+)W)?(?:(\d+)D)?/)
      if (m) spanDays = Math.max(0, (Number(m[1]) || 0) * 7 + (Number(m[2]) || 0) - (allDay ? 1 : 0))
    }
    const starts =
      e.rrule && !e.recurrenceId
        ? expand(e.start.date, e.rrule, to).filter((d) => !e.exdates.has(d) && !overridden.get(e.uid)?.has(d))
        : [e.start.date]
    for (const d of starts) {
      const endDate = addDays(d, spanDays)
      if (endDate < from || d > to) continue
      out.push({
        id: `${e.uid || e.title}:${d}`,
        title: e.title || '(No title)',
        location: e.location || '',
        date: d,
        endDate,
        time: allDay ? null : e.start.time,
        endTime: allDay ? null : e.end?.time || null,
        allDay,
      })
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
}

export const icsEventOn = (e, date) => date >= e.date && date <= e.endDate

const fmtT = (t) => {
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
export function fmtTimeRange(e, date) {
  if (e.allDay) return 'All day'
  const start = e.date === date ? fmtT(e.time) : 'Until'
  if (e.date !== e.endDate) return e.date === date ? `${start} →` : `${start} ${e.endTime ? fmtT(e.endTime) : ''}`
  return e.endTime ? `${start} – ${fmtT(e.endTime)}` : start
}
