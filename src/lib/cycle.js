// Cycle maths: periods, cycles, birth-control-aware predictions and stats.
// Everything is an estimate. Nothing here is suitable for preventing pregnancy.
import { addDays, diffDays, today as todayStr } from './dates.js'

export const METHODS = {
  none: { label: 'No birth control', short: 'No BC', hormonal: false, mode: 'natural' },
  condoms: { label: 'Condoms only', short: 'Condoms', hormonal: false, mode: 'natural' },
  combined: { label: 'Combined pill', short: 'Pill', hormonal: true, mode: 'pill' },
  minipill: { label: 'Mini-pill (progestin-only)', short: 'Mini-pill', hormonal: true, mode: 'irregular' },
  hormonal_iud: { label: 'Hormonal IUD', short: 'Hormonal IUD', hormonal: true, mode: 'irregular' },
  copper_iud: { label: 'Copper IUD', short: 'Copper IUD', hormonal: false, mode: 'natural' },
  implant: { label: 'Implant', short: 'Implant', hormonal: true, mode: 'irregular' },
}

export const PACK_TYPES = {
  '21-7': { label: '21 active + 7 break/placebo', active: 21 },
  '24-4': { label: '24 active + 4 placebo', active: 24 },
  continuous: { label: 'Continuous (skipping placebos)', active: 28 },
}

export const FLOWS = ['spotting', 'light', 'medium', 'heavy']
const BLEED = new Set(['light', 'medium', 'heavy'])
const LUTEAL = 14
const PHASES = {
  menstrual: { label: 'Period', blurb: 'Menstrual phase' },
  follicular: { label: 'Follicular', blurb: 'Energy often rises as estrogen climbs' },
  ovulation: { label: 'Ovulation', blurb: 'Estimated ovulation window' },
  luteal: { label: 'Luteal', blurb: 'Progesterone rises; PMS can show up late in this phase' },
}
export const phaseLabel = (p) => PHASES[p]?.label || ''
export const phaseBlurb = (p) => PHASES[p]?.blurb || ''

/* ---------- basic statistics ---------- */
export function stats(nums) {
  const n = nums.length
  if (!n) return { n: 0 }
  const avg = nums.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(nums.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0
  return { n, avg, sd, min: Math.min(...nums), max: Math.max(...nums) }
}
const median = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

/* ---------- birth control segments ---------- */
/** Contiguous segments [{method, start, end|null, bc}] covering all time. */
export function buildSegments(bcList) {
  const sorted = [...bcList].filter((b) => b.start).sort((a, b) => (a.start < b.start ? -1 : 1))
  const segs = []
  let cursor = '0000-01-01'
  sorted.forEach((b, i) => {
    if (b.start > cursor) segs.push({ method: 'none', start: cursor, end: addDays(b.start, -1), implicit: true })
    const nextStart = sorted[i + 1]?.start
    let end = b.end || (nextStart ? addDays(nextStart, -1) : null)
    if (nextStart && end && end >= nextStart) end = addDays(nextStart, -1)
    segs.push({ method: b.method, start: b.start, end, bc: b })
    cursor = end ? addDays(end, 1) : '9999-12-31'
  })
  if (cursor !== '9999-12-31') segs.push({ method: 'none', start: cursor, end: null, implicit: true })
  return segs
}
export const segmentAt = (segs, date) => segs.find((s) => s.start <= date && (!s.end || s.end >= date)) || segs[segs.length - 1]

/* ---------- periods & cycles ---------- */
export function episodes(logs) {
  const days = logs.filter((l) => BLEED.has(l.flow)).map((l) => l.date).sort()
  const eps = []
  for (const d of days) {
    const last = eps[eps.length - 1]
    if (last && diffDays(last.end, d) <= 2) last.end = d
    else eps.push({ start: d, end: d })
  }
  eps.forEach((e) => (e.length = diffDays(e.start, e.end) + 1))
  return eps
}

export function cyclesFrom(eps, segs) {
  const out = []
  for (let i = 0; i < eps.length - 1; i++) {
    const start = eps[i].start
    const next = eps[i + 1].start
    const seg = segmentAt(segs, start)
    const crosses = seg.end && next > seg.end
    out.push({ start, length: diffDays(start, next), periodLength: eps[i].length, method: seg.method, seg, crosses })
  }
  return out
}
const validCycle = (c) => !c.crosses && c.length >= 10 && c.length <= 120

/* ---------- prediction ---------- */
export function predict({ logs, bc, settings = {}, today = todayStr() }) {
  const segs = buildSegments(bc)
  const seg = segmentAt(segs, today)
  const method = seg.method
  const info = METHODS[method] || METHODS.none
  const eps = episodes(logs)
  const cycles = cyclesFrom(eps, segs)
  const lastEp = eps[eps.length - 1]
  const currentlyBleeding = !!lastEp && lastEp.end >= addDays(today, -1) && lastEp.start <= today
  const notes = []
  const base = { method, info, segment: seg, segments: segs, episodes: eps, cycles, currentlyBleeding, notes, futurePeriods: [], futureFertile: [], placebo: [] }

  if (info.mode === 'pill') return { ...base, ...predictPill(seg, eps, segs, today, notes) }

  const sameMethodCycles = cycles.filter((c) => validCycle(c) && (info.mode === 'natural' ? !METHODS[c.method]?.hormonal : c.method === method))
  const recent = sameMethodCycles.slice(-6)
  const cs = stats(recent.map((c) => c.length))
  const ps = stats(eps.filter((e) => segmentAt(segs, e.start).method === method).slice(-6).map((e) => e.length))
  const periodLen = Math.round(ps.n ? ps.avg : settings.periodLength || 5)

  // was hormonal birth control stopped recently?
  const idx = segs.indexOf(seg)
  const prevSeg = segs[idx - 1]
  const adjusting = info.mode === 'natural' && prevSeg && METHODS[prevSeg.method]?.hormonal && diffDays(seg.start, today) < 120

  if (info.mode === 'irregular') {
    const regular = cs.n >= 3 && cs.sd / cs.avg <= 0.2 && cs.avg >= 18 && cs.avg <= 60
    const since = lastEp ? diffDays(lastEp.end, today) : null
    const recentBleedDays = logs.filter((l) => l.flow && l.date > addDays(today, -90) && l.date <= today).length
    notes.push(
      method === 'minipill'
        ? 'The mini-pill often makes bleeding irregular, lighter or absent, so a fixed cycle isn’t assumed.'
        : `A${method === 'implant' ? 'n implant' : ' hormonal IUD'} often makes bleeding irregular, lighter or stop altogether, so a fixed cycle isn’t assumed.`,
    )
    if (!regular) {
      if (cs.n < 3) notes.push('Log your bleeding for a few months on this method. If it settles into a pattern, predictions will turn on.')
      else notes.push('Your bleeding on this method has been irregular, so there’s no prediction right now.')
      return { ...base, mode: 'irregular', periodLen, cycleStats: cs, daysSinceBleed: since, recentBleedDays, confidence: 'none' }
    }
    notes.push('Your bleeding on this method has been fairly regular, so here’s a rough estimate.')
    const r = projectNatural({ anchor: lastEp.start, avg: cs.avg, sd: cs.sd + 2, periodLen, today, fertile: false })
    return { ...base, mode: 'irregular', periodLen, cycleStats: cs, daysSinceBleed: since, recentBleedDays, confidence: 'low', ...r }
  }

  // natural (no hormonal method)
  if (!lastEp) {
    notes.push('Log your period days and predictions will appear.')
    return { ...base, mode: 'natural', periodLen, cycleStats: cs, confidence: 'none' }
  }
  let avg = cs.n ? cs.avg : settings.cycleLength || 28
  let sd = cs.n >= 2 ? cs.sd : 3
  let anchor = lastEp.start
  if (adjusting) {
    notes.push('After stopping hormonal birth control, cycles can take a few months to settle. Predictions use a wider range for now.')
    sd += 3
    if (anchor < seg.start) anchor = seg.start // no natural bleed yet since stopping
  }
  if (!cs.n) notes.push(`Using a typical ${avg}-day cycle until you’ve logged a couple of periods.`)
  if (cs.n && cs.n < 3) notes.push('Predictions get better after a few more logged cycles.')
  if (cs.n >= 3 && cs.sd > 7) notes.push('Your cycle length varies a lot, so the estimate has a wide range.')
  let confidence = cs.n >= 6 && cs.sd <= 2 ? 'high' : cs.n >= 3 && cs.sd <= 4 ? 'medium' : 'low'
  if (adjusting) confidence = 'low'
  const r = projectNatural({ anchor, avg, sd, periodLen, today, fertile: true, currentlyBleeding })
  if (r.rolled) {
    notes.push('No period logged for a while. Log your latest one to sharpen predictions.')
    confidence = 'low'
  }
  return { ...base, mode: 'natural', periodLen, cycleStats: cs, confidence, adjusting, ...r }
}

function projectNatural({ anchor, avg, sd, periodLen, today, fertile, currentlyBleeding }) {
  const len = Math.max(15, Math.round(avg))
  const range = Math.min(7, Math.max(1, Math.round(sd)))
  let start = addDays(anchor, len)
  let rolled = false
  let lateBy = 0
  if (start <= today && !currentlyBleeding) {
    const over = diffDays(start, today)
    if (over > len) {
      while (start <= today) start = addDays(start, len)
      anchor = addDays(start, -len)
      rolled = true
    } else {
      lateBy = over
    }
  }
  const cycleDay = diffDays(anchor, today) + 1
  const futurePeriods = []
  const futureFertile = []
  for (let k = 0; k < 4; k++) {
    const s = k === 0 && lateBy ? today : addDays(start, k * len)
    futurePeriods.push({ start: s, end: addDays(s, periodLen - 1) })
    if (fertile) {
      const ov = addDays(addDays(start, k * len), -LUTEAL)
      if (ov >= today || k === 0) futureFertile.push({ start: addDays(ov, -5), end: addDays(ov, 1), ov })
    }
  }
  // fertile window of the current cycle
  const ovulation = fertile ? addDays(start, -LUTEAL) : null
  let phase = null
  if (fertile) {
    const ovDay = diffDays(anchor, ovulation) + 1
    if (currentlyBleeding || cycleDay <= periodLen) phase = 'menstrual'
    else if (cycleDay < ovDay - 1) phase = 'follicular'
    else if (cycleDay <= ovDay + 1) phase = 'ovulation'
    else phase = 'luteal'
  } else if (currentlyBleeding) phase = 'menstrual'
  const fertileNow = fertile ? { start: addDays(ovulation, -5), end: addDays(ovulation, 1) } : null
  if (fertileNow && !futureFertile.some((f) => f.ov === ovulation)) futureFertile.unshift({ ...fertileNow, ov: ovulation })
  return {
    cycleDay,
    cycleLength: len,
    phase,
    next: { start, range, lateBy },
    ovulation,
    fertile: fertileNow,
    futurePeriods,
    futureFertile,
    rolled,
  }
}

function predictPill(seg, eps, segs, today, notes) {
  const bc = seg.bc || {}
  const pack = PACK_TYPES[bc.packType] || PACK_TYPES['21-7']
  const periodLen = 4
  if (!bc.packStart) {
    notes.push('Add the date you started your current pack (in Birth control below) to see withdrawal bleed predictions.')
    return { mode: 'pill', confidence: 'none', periodLen, pack }
  }
  const packDay = (((diffDays(bc.packStart, today) % 28) + 28) % 28) + 1
  const packStartCur = addDays(today, -(packDay - 1))
  const inPlacebo = pack.active < 28 && packDay > pack.active

  // learn the usual delay between starting placebos and bleeding
  const pillEps = eps.filter((e) => segmentAt(segs, e.start) === seg)
  const offsets = pillEps
    .map((e) => (((diffDays(bc.packStart, e.start) % 28) + 28) % 28) - pack.active)
    .filter((o) => o >= -3 && o <= 7)
  const offset = median(offsets) ?? 2
  const lens = pillEps.slice(-6).map((e) => e.length)
  const bleedLen = Math.round(lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : periodLen)

  const placebo = []
  const futurePeriods = []
  if (pack.active < 28) {
    for (let k = -1; k < 4; k++) {
      const ps = addDays(packStartCur, k * 28 + pack.active)
      placebo.push({ start: ps, end: addDays(ps, 28 - pack.active - 1) })
      const bs = addDays(ps, offset)
      const be = addDays(bs, bleedLen - 1)
      if (be >= today) futurePeriods.push({ start: bs, end: be })
    }
    notes.push('On the combined pill, the bleed during your break or placebo days is a withdrawal bleed, not a true period. The pill stops ovulation when taken correctly, so no fertile window is shown.')
  } else {
    notes.push('Taking active pills continuously usually means no scheduled bleed. Breakthrough spotting is common, especially in the first few months.')
  }
  const next = futurePeriods.find((p) => p.start >= today) || futurePeriods[0]
  return {
    mode: 'pill',
    confidence: offsets.length >= 2 ? 'high' : 'medium',
    periodLen: bleedLen,
    pack,
    packDay,
    inPlacebo,
    phase: inPlacebo ? 'placebo' : 'active',
    placebo,
    futurePeriods,
    next: next ? { start: next.start, range: 1, lateBy: 0 } : null,
    bleedOffset: offset,
  }
}

/* ---------- stats by birth control period ---------- */
export function segmentStats(pred, today = todayStr()) {
  const { segments, cycles, episodes: eps } = pred
  const firstLog = eps[0]?.start
  return segments
    .filter((s) => (!s.end || !firstLog || s.end >= firstLog) && s.start <= today)
    .map((s) => {
      const cyc = cycles.filter((c) => c.seg === s && validCycle(c))
      const per = eps.filter((e) => segmentAt(segments, e.start) === s)
      const cstat = stats(cyc.map((c) => c.length))
      const pstat = stats(per.map((e) => e.length))
      return {
        seg: s,
        from: s.start === '0000-01-01' ? firstLog || s.end : s.start,
        to: s.end && s.end < today ? s.end : null,
        cycles: cyc,
        cycleStats: cstat,
        periodStats: pstat,
        periods: per.length,
      }
    })
    .filter((x) => x.periods > 0 || !x.seg.implicit)
    .reverse()
}

export function groupStats(pred) {
  const groups = { off: [], on: [] }
  for (const c of pred.cycles) if (validCycle(c)) groups[METHODS[c.method]?.hormonal ? 'on' : 'off'].push(c)
  const per = { off: [], on: [] }
  for (const e of pred.episodes) per[METHODS[segmentAt(pred.segments, e.start).method]?.hormonal ? 'on' : 'off'].push(e.length)
  return {
    off: { cycleStats: stats(groups.off.map((c) => c.length)), periodStats: stats(per.off) },
    on: { cycleStats: stats(groups.on.map((c) => c.length)), periodStats: stats(per.on) },
  }
}

/* ---------- symptom patterns by phase (no AI, just counting) ---------- */
export function phasePatterns(pred, logs) {
  const counts = { menstrual: {}, follicular: {}, ovulation: {}, luteal: {} }
  const days = { menstrual: 0, follicular: 0, ovulation: 0, luteal: 0 }
  const natural = pred.cycles.filter((c) => validCycle(c) && !METHODS[c.method]?.hormonal && c.length <= 60)
  for (const l of logs) {
    const c = natural.find((c) => l.date >= c.start && diffDays(c.start, l.date) < c.length)
    if (!c) continue
    const day = diffDays(c.start, l.date) + 1
    const ovDay = c.length - LUTEAL
    const phase = day <= c.periodLength ? 'menstrual' : day < ovDay - 1 ? 'follicular' : day <= ovDay + 1 ? 'ovulation' : 'luteal'
    const tags = [...(l.feelings || []), ...(l.pain || [])]
    if (!tags.length) continue
    days[phase]++
    for (const t of tags) counts[phase][t] = (counts[phase][t] || 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).map(([p, c]) => [
      p,
      {
        days: days[p],
        top: Object.entries(c)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tag, n]) => ({ tag, pct: Math.round((n / days[p]) * 100) })),
      },
    ]),
  )
}

/** What to draw on a calendar day. */
export function dayMarks(date, pred, logByDate) {
  const log = logByDate[date]
  const m = { flow: log?.flow || null, logged: !!log }
  if (!m.flow) {
    if (pred.futurePeriods?.some((p) => date >= p.start && date <= p.end)) m.predicted = true
  }
  const f = pred.futureFertile?.find((f) => date >= f.start && date <= f.end)
  if (f) {
    m.fertile = true
    if (f.ov === date) m.ovulation = true
  }
  if (pred.placebo?.some((p) => date >= p.start && date <= p.end)) m.placebo = true
  return m
}
