// All calendar dates are local "YYYY-MM-DD" strings.
const pad = (n) => String(n).padStart(2, '0')

export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toStr(new Date())
export const addDays = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return toStr(d)
}
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000) // b - a
export const dow = (s) => parse(s).getDay()
export const minDate = (a, b) => (a < b ? a : b)
export const maxDate = (a, b) => (a > b ? a : b)

const fmt = (s, opts) => parse(s).toLocaleDateString(undefined, opts)
export const fmtShort = (s) => fmt(s, { month: 'short', day: 'numeric' })
export const fmtDay = (s) => fmt(s, { weekday: 'short', month: 'short', day: 'numeric' })
export const fmtLong = (s) => fmt(s, { weekday: 'long', month: 'long', day: 'numeric' })
export const fmtMonth = (s) => fmt(s, { month: 'long', year: 'numeric' })
export const fmtWeekday = (s) => fmt(s, { weekday: 'short' })

export function relDays(s, from = today()) {
  const n = diffDays(from, s)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n > 1) return `in ${n} days`
  return `${-n} days ago`
}

export function monthGrid(monthStr) {
  // monthStr: any date in the month. Returns 6 weeks of date strings, weeks start Sunday.
  const d = parse(monthStr)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = addDays(toStr(first), -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
export const sameMonth = (a, b) => a.slice(0, 7) === b.slice(0, 7)
export const addMonths = (s, n) => {
  const d = parse(s)
  return toStr(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
export function weekOf(s) {
  const start = addDays(s, -dow(s))
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Next occurrence (>= from) of a yearly event date. */
export function nextYearly(s, from = today()) {
  const y = parse(from).getFullYear()
  let c = `${y}${s.slice(4)}`
  if (c < from) c = `${y + 1}${s.slice(4)}`
  return c
}
