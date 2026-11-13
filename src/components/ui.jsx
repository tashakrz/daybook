import { useEffect, useState, useSyncExternalStore } from 'react'
import { COLORS, COLOR_IDS, cssVars } from '../lib/colors.js'

/* ---------- tiny hash router ---------- */
const subscribeHash = (cb) => (window.addEventListener('hashchange', cb), () => window.removeEventListener('hashchange', cb))
export function useRoute() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash)
  const [path, query = ''] = (hash.replace(/^#/, '') || '/today').split('?')
  return { path, params: Object.fromEntries(new URLSearchParams(query)) }
}
export const go = (to) => (window.location.hash = to)

/* ---------- icons ---------- */
const P = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  calendar: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 9.5h16M8.5 2.5v3M15.5 2.5v3',
  school: 'M3 8.5 12 4l9 4.5-9 4.5zM7 10.5v4.5c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5M21 8.5V14',
  cycle: 'M12 3.5c3 3.6 6 7.2 6 10.3a6 6 0 0 1-12 0c0-3.1 3-6.7 6-10.3z',
  habits: 'M5 19V11M10 19V6M15 19v-5M20 19V9',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.4a7.5 7.5 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2.6 1.5l.5 2.4h4l.5-2.4a7.5 7.5 0 0 0 2.6-1.5l2.3.9 2-3.4z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  cloud: 'M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5z',
  note: 'M6 3.5h9l3 3v14H6zM9 10h6M9 14h6M9 18h3',
}
export function Icon({ name, size = 22, stroke = 1.6, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  )
}

/* ---------- decorative background ---------- */
export function Blobs() {
  return (
    <div className="blobs" aria-hidden="true">
      <svg viewBox="0 0 600 600" className="blob b1">
        <defs>
          <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#F7C9C0" />
            <stop offset="1" stopColor="#E9B6D6" />
          </linearGradient>
        </defs>
        <path fill="url(#g1)" d="M421 75c62 39 112 116 104 190-8 75-74 146-150 186-76 41-162 50-226 12C85 425 43 340 60 262 77 184 152 113 228 77c76-37 131-41 193-2z" />
      </svg>
      <svg viewBox="0 0 600 600" className="blob b2">
        <defs>
          <linearGradient id="g2" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#C9E1D3" />
            <stop offset="1" stopColor="#CFE0F3" />
          </linearGradient>
        </defs>
        <path fill="url(#g2)" d="M447 140c51 54 69 141 38 211-31 69-111 121-195 128-83 7-169-30-201-96-33-66-12-161 43-220 56-58 146-79 216-70 41 6 72 19 99 47z" />
      </svg>
      <svg viewBox="0 0 600 600" className="blob b3">
        <defs>
          <linearGradient id="g3" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#FBE3B4" />
            <stop offset="1" stopColor="#F6C7A8" />
          </linearGradient>
        </defs>
        <path fill="url(#g3)" d="M398 98c55 31 90 92 92 155 2 64-29 130-82 168-54 39-130 50-191 25S108 359 101 294c-7-66 26-139 81-181 55-43 160-46 216-15z" />
      </svg>
    </div>
  )
}

/* ---------- building blocks ---------- */
export function Sheet({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('locked')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('locked')
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Check({ checked, onChange, color = 'sage', label, size = 30 }) {
  return (
    <button
      type="button"
      className={`check ${checked ? 'on' : ''}`}
      style={{ ...cssVars(color), width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      aria-pressed={checked}
      aria-label={label}
    >
      {checked && <Icon name="check" size={size * 0.6} stroke={2.4} />}
    </button>
  )
}

export function Chips({ options, value, onChange, multi, color = 'rose', small }) {
  const sel = multi ? value || [] : value
  const isOn = (o) => (multi ? sel.includes(o.value) : sel === o.value)
  return (
    <div className={`chips ${small ? 'small' : ''}`} style={cssVars(color)}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={`chip ${isOn(o) ? 'on' : ''}`}
          onClick={() => {
            if (multi) onChange(isOn(o) ? sel.filter((v) => v !== o.value) : [...sel, o.value])
            else onChange(isOn(o) ? null : o.value)
          }}
        >
          {o.icon && <span className="chip-ico">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button type="button" key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ColorPicker({ value, onChange }) {
  return (
    <div className="swatches">
      {COLOR_IDS.map((id) => (
        <button
          type="button"
          key={id}
          title={COLORS[id].name}
          aria-label={COLORS[id].name}
          className={`swatch ${value === id ? 'on' : ''}`}
          style={cssVars(id)}
          onClick={() => onChange(id)}
        />
      ))}
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`section ${className}`}>
      {(title || action) && (
        <div className="section-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      return s == null ? initial : JSON.parse(s)
    } catch {
      return initial
    }
  })
  const set = (x) => {
    setV(x)
    try {
      localStorage.setItem(key, JSON.stringify(x))
    } catch {
      /* storage unavailable */
    }
  }
  return [v, set]
}
