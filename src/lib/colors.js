// Moody "disc" gradients for a dark theme: deep (c) → saturated (b) → light (a).
// `ink` is a light tint for text/tags on the dark background.
export const COLORS = {
  rose: { name: 'Rose', a: '#f5cdd0', b: '#da6290', c: '#4f3486', ink: '#f2a9c0' },
  peach: { name: 'Coral', a: '#f3b07a', b: '#e0566b', c: '#7a3f8c', ink: '#f5b48e' },
  sun: { name: 'Amber', a: '#f7dfb6', b: '#ec9840', c: '#a8403b', ink: '#f3c27a' },
  sage: { name: 'Sage', a: '#d9ecc8', b: '#5fae8a', c: '#23506a', ink: '#9fd6b4' },
  teal: { name: 'Teal', a: '#f0d2c0', b: '#3aa2a4', c: '#22397a', ink: '#8fd3d0' },
  sky: { name: 'Blue', a: '#c9dcff', b: '#5b8fe0', c: '#2a2a72', ink: '#a9c4f5' },
  lavender: { name: 'Indigo', a: '#d9cff7', b: '#7f6fdc', c: '#2f2470', ink: '#c3b6f2' },
  plum: { name: 'Plum', a: '#f2c6e6', b: '#b0569a', c: '#3a2258', ink: '#e2a6d2' },
  clay: { name: 'Rust', a: '#f4d0b8', b: '#c4673f', c: '#4f2638', ink: '#eba98a' },
  stone: { name: 'Stone', a: '#d8d2cc', b: '#7b7380', c: '#2c2832', ink: '#c9c1cb' },
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
  return `linear-gradient(170deg, ${c.c} 0%, ${c.b} 58%, color-mix(in srgb, ${c.a} 65%, ${c.b}) 100%)`
}
export const cssVars = (id, fallback) => {
  const c = color(id, fallback)
  return { '--c-a': c.a, '--c-b': c.b, '--c-c': c.c, '--c-ink': c.ink }
}
