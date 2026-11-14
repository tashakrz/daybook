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
/** Concentric "ink" rings, like ink drawings on paper. Mirrored, soft, with white dots. */
export function InkRings({ size = 260, color = '#e7899f', className = '', dense = 1, style }) {
  const c = size / 2
  const rings = [
    [0.96, 0.08, 0.1],
    [0.8, 0.14, 0.05],
    [0.7, 0.3, 0.01],
    [0.6, 0.12, 0.07],
    [0.44, 0.34, 0.012],
    [0.34, 0.16, 0.05],
    [0.2, 0.42, 0.01],
  ].slice(0, Math.round(7 * dense))
  return (
    <svg className={`ink-rings ${className}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={style}>
      <defs>
        <filter id="ink-soft">
          <feGaussianBlur stdDeviation={size / 260} />
        </filter>
      </defs>
      <g fill="none" stroke={color} filter="url(#ink-soft)">
        {rings.map(([r, o, w], i) => (
          <circle key={i} cx={c} cy={c} r={c * r} strokeOpacity={o} strokeWidth={Math.max(1, size * w)} />
        ))}
        <circle cx={c} cy={c * 0.42} r={c * 0.14} strokeOpacity="0.3" strokeWidth={Math.max(1, size * 0.008)} />
        <circle cx={c} cy={c * 1.58} r={c * 0.14} strokeOpacity="0.3" strokeWidth={Math.max(1, size * 0.008)} />
      </g>
      <g fill="#f4ede4" opacity="0.75">
        <circle cx={c} cy={size * 0.02 + 3} r={Math.max(1.5, size * 0.012)} />
        <circle cx={c} cy={c * 0.42} r={Math.max(1.5, size * 0.01)} />
        <circle cx={c} cy={c * 1.58} r={Math.max(1.5, size * 0.01)} />
        <circle cx={c * 0.32} cy={c} r={Math.max(1, size * 0.007)} />
        <circle cx={c * 1.68} cy={c} r={Math.max(1, size * 0.007)} />
      </g>
    </svg>
  )
}

export function Blobs() {
  return (
    <div className="blobs" aria-hidden="true">
      <div className="glow g1" />
      <div className="glow g2" />
      <InkRings size={420} className="bg-rings r1" />
      <InkRings size={300} color="#8f9ae6" className="bg-rings r2" dense={0.7} />
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
