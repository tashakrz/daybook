// Soft gradient palette used for tasks, classes, events and habits.
export const COLORS = {
  rose: { name: 'Rose', a: '#F4B6B6', b: '#E57C8E', ink: '#B4485D' },
  peach: { name: 'Peach', a: '#FAD6A5', b: '#F19A6B', ink: '#B5622F' },
  sun: { name: 'Sun', a: '#FBE7A1', b: '#E9B949', ink: '#94701A' },
  sage: { name: 'Sage', a: '#D8E8C4', b: '#8DB596', ink: '#4F7A59' },
  teal: { name: 'Teal', a: '#BFE3DC', b: '#5FA8A3', ink: '#2F6F6B' },
  sky: { name: 'Sky', a: '#CFE3F6', b: '#6F9FD8', ink: '#3A659C' },
  lavender: { name: 'Lavender', a: '#E0D8F3', b: '#9C8AD0', ink: '#62529A' },
  plum: { name: 'Plum', a: '#EBC9DF', b: '#B0679A', ink: '#7D3E6A' },
  clay: { name: 'Clay', a: '#EED3C4', b: '#C98568', ink: '#8E5238' },
  stone: { name: 'Stone', a: '#E6E1DA', b: '#9A938A', ink: '#5E5850' },
}
export const COLOR_IDS = Object.keys(COLORS)

// default colour per kind of thing
export const DEFAULTS = {
  school: 'sky',
  exam: 'lavender',
  reminder: 'peach',
  event: 'teal',
  daily: 'sage',
  period: 'rose',
}

export const color = (id, fallback = 'stone') => COLORS[id] || COLORS[fallback]
export const gradient = (id, fallback) => {
  const c = color(id, fallback)
  return `linear-gradient(135deg, ${c.a}, ${c.b})`
}
export const cssVars = (id, fallback) => {
  const c = color(id, fallback)
  return { '--c-a': c.a, '--c-b': c.b, '--c-ink': c.ink }
}
