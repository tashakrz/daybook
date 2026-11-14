// Minimal iCalendar (.ics) reader for published Outlook calendars.
// Timed events become absolute instants (using the calendar's own VTIMEZONE
// rules, like Outlook does) and are shown in a chosen display time zone.
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

/** -> { date: 'YYYY-MM-DD', time: 'HH:MM' | null, utc, tzid } (wall-clock in its own zone) */
function parseWhen(value, params = {}) {
  const v = value.trim()
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: null }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, , z] = m
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, utc: !!z, tzid: z ? null : params.TZID || null }
}

/* ---------- time zones ---------- */
const parseOffset = (s) => {
  const m = String(s || '').match(/^([+-])(\d{2})(\d{2})/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}
const wallMs = (date, time) => {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = (time || '00:00').split(':').map(Number)
  return Date.UTC(y, mo - 1, d, h, mi)
}

/** Offset (minutes east of UTC) in effect at a wall-clock time, per a VTIMEZONE. */
function vtzOffset(vtz, date, time) {
  const w = wallMs(date, time)
  const year = Number(date.slice(0, 4))
  let best = null
  for (const c of vtz.parts) {
    const onsets = []
    if (c.rrule && c.rrule.freq === 'YEARLY') {
      for (const y of [year - 1, year]) {
        if (c.rrule.until && `${y}` > c.rrule.until.slice(0, 4)) continue
        if (`${y}` < c.start.date.slice(0, 4)) continue
        const m = (c.rrule.bymonth?.[0] || Number(c.start.date.slice(5, 7))) - 1
        const days = monthCandidates(y, m, c.rrule.byday || c.rrule.bymonthday ? c.rrule : { ...c.rrule, bymonthday: [Number(c.start.date.slice(8, 10))] }, c.start.date)
        if (days[0]) onsets.push(days[0])
      }
    } else onsets.push(c.start.date)
    for (const d of onsets) {
      const t = wallMs(d, c.start.time)
      if (t <= w && (!best || t > best.t)) best = { t, off: c.offsetTo }
    }
  }
  if (best) return best.off
  return vtz.parts[0]?.offsetFrom ?? vtz.parts[0]?.offsetTo ?? 0
}

/** Offset of an IANA zone at a UTC instant (minutes east), or null if unknown. */
function ianaOffset(tz, ms) {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms) / 60000)
  } catch {
    return null
  }
}

/** Absolute instant (ms) for a wall-clock time, or null for a "floating" time. */
function toInstant(date, time, when, zones) {
  const w = wallMs(date, time)
  if (when.utc) return w
  if (!when.tzid) return null
  const vtz = zones[when.tzid]
  if (vtz) return w - vtzOffset(vtz, date, time) * 60000
  const guess = ianaOffset(when.tzid, w)
  if (guess == null) return null
  const off = ianaOffset(when.tzid, w - guess * 60000)
  return w - off * 60000
}

/**
 * Display zone: 'device', a number (fixed offset in minutes east of UTC, e.g. -420),
 * or an IANA name. Returns { date, time } for an instant.
 */
export function inZone(ms, zone) {
  let d
  if (zone === 'device' || zone == null || zone === '') {
    d = new Date(ms)
    return { date: toStr(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
  }
  const off = typeof zone === 'number' ? zone : ianaOffset(zone, ms) ?? -new Date(ms).getTimezoneOffset()
  d = new Date(ms + off * 60000)
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
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
  const zones = {}
  let cur = null
  let depth = 0
  let tz = null
  let tzPart = null
  for (const line of lines) {
    if (line === 'BEGIN:VTIMEZONE') {
      tz = { tzid: null, parts: [] }
      continue
    }
    if (tz) {
      if (line === 'END:VTIMEZONE') {
        if (tz.tzid) zones[tz.tzid] = tz
        tz = null
      } else if (line === 'BEGIN:STANDARD' || line === 'BEGIN:DAYLIGHT') tzPart = {}
      else if (line === 'END:STANDARD' || line === 'END:DAYLIGHT') {
        if (tzPart?.start) tz.parts.push(tzPart)
        tzPart = null
      } else {
        const p = parseLine(line)
        if (!p) continue
        if (!tzPart && p.name === 'TZID') tz.tzid = p.value
        else if (tzPart && p.name === 'DTSTART') tzPart.start = parseWhen(p.value)
        else if (tzPart && p.name === 'TZOFFSETTO') tzPart.offsetTo = parseOffset(p.value)
        else if (tzPart && p.name === 'TZOFFSETFROM') tzPart.offsetFrom = parseOffset(p.value)
        else if (tzPart && p.name === 'RRULE') tzPart.rrule = parseRRule(p.value)
      }
      continue
    }
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
    const base = { title: e.title || '(No title)', location: e.location || '' }
    const starts =
      e.rrule && !e.recurrenceId
        ? expand(e.start.date, e.rrule, addDays(to, 1)).filter((d) => !e.exdates.has(d) && !overridden.get(e.uid)?.has(d))
        : [e.start.date]

    if (allDay) {
      let spanDays = 0
      if (e.end) spanDays = Math.max(0, diffDays(e.start.date, e.end.date) - 1)
      else if (e.duration) {
        const m = e.duration.match(/P(?:(\d+)W)?(?:(\d+)D)?/)
        if (m) spanDays = Math.max(0, (Number(m[1]) || 0) * 7 + (Number(m[2]) || 0) - 1)
      }
      for (const d of starts) {
        const endDate = addDays(d, spanDays)
        if (endDate < from || d > to) continue
        out.push({ id: `${e.uid || e.title}:${d}`, ...base, allDay: true, date: d, endDate })
      }
      continue
    }

    // timed: duration from the original start/end, each occurrence anchored in its own zone
    const s0 = toInstant(e.start.date, e.start.time, e.start, zones)
    let durMs = 0
    if (e.end && e.end.time != null) {
      const e0 = toInstant(e.end.date, e.end.time, e.end, zones)
      durMs = s0 != null && e0 != null ? e0 - s0 : wallMs(e.end.date, e.end.time) - wallMs(e.start.date, e.start.time)
    } else if (e.duration) {
      const m = e.duration.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/)
      if (m) durMs = ((+m[1] || 0) * 7 * 1440 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0)) * 60000
    }
    durMs = Math.max(0, durMs)
    for (const d of starts) {
      if (addDays(d, 2) < from || d > addDays(to, 1)) continue
      const id = `${e.uid || e.title}:${d}`
      const ms = toInstant(d, e.start.time, e.start, zones)
      if (ms == null) {
        // floating time: same wall clock everywhere
        const w = wallMs(d, e.start.time) + durMs
        const end = inZone(w, 0)
        out.push({ id, ...base, allDay: false, floating: true, date: d, time: e.start.time, endDate: end.date, endTime: durMs ? end.time : null })
      } else out.push({ id, ...base, allDay: false, startMs: ms, endMs: ms + durMs })
    }
  }
  return out
}

/** Give each event local date/time fields in the display zone, sorted. */
export function localize(events, zone) {
  return events
    .map((e) => {
      if (e.allDay || e.floating) return e
      const s = inZone(e.startMs, zone)
      let end = inZone(Math.max(e.startMs, e.endMs), zone)
      let endDate = end.date
      if (end.time === '00:00' && endDate > s.date) endDate = addDays(endDate, -1)
      return { ...e, date: s.date, time: s.time, endDate, endTime: e.endMs > e.startMs ? end.time : null }
    })
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
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
