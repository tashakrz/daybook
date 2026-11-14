import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { isConfigured } from './config.js'
import { initStore, readAllFor, importRecords, destroyUserData, useItems, patch } from './lib/store.js'
import { startSync, stopSync, useSyncState } from './lib/sync.js'
import { seedDefaults, reminderActive, getSettings } from './lib/model.js'
import { today as todayStr, fmtDay } from './lib/dates.js'
import { cssVars, DEFAULTS } from './lib/colors.js'
import { Blobs, Icon, useRoute, go, Sheet, Check } from './components/ui.jsx'
import { EditorHost } from './components/EditorHost.jsx'
import { refreshOutlook, clearOutlook } from './lib/outlook.js'
import Login, { NewPassword } from './pages/Login.jsx'
import Today from './pages/Today.jsx'
import Calendar from './pages/Calendar.jsx'
import School from './pages/School.jsx'
import Cycle from './pages/Cycle.jsx'
import Habits from './pages/Habits.jsx'
import Settings from './pages/Settings.jsx'

const USER_KEY = 'daybook:user'

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem(USER_KEY)) // uid | 'local' | null
  const [email, setEmail] = useState(null)
  const [ready, setReady] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const userRef = useRef(user)
  userRef.current = user

  // open the local database for whoever is signed in
  const openFor = useCallback(async (uid) => {
    setReady(false)
    stopSync()
    await initStore(uid)
    await seedDefaults()
    setReady(true)
    if (uid !== 'local') startSync().catch(() => {})
  }, [])

  const signedIn = useCallback(
    async (session) => {
      const uid = session.user.id
      setEmail(session.user.email)
      setShowLogin(false)
      if (userRef.current === uid) return
      const prev = userRef.current
      localStorage.setItem(USER_KEY, uid)
      setUser(uid)
      if (prev === 'local') {
        // carry over anything made in "this device only" mode
        const old = await readAllFor('local')
        await initStore(uid)
        await importRecords(old.filter((r) => !r.deleted))
        await destroyUserData('local')
      }
      await openFor(uid)
    },
    [openFor],
  )

  useEffect(() => {
    if (user) openFor(user)
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) signedIn(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        // run outside the auth callback (supabase-js recommends not awaiting inside it)
        setTimeout(() => signedIn(session), 0)
      }
    })
    return () => data.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const useLocalOnly = () => {
    localStorage.setItem(USER_KEY, 'local')
    setUser('local')
    openFor('local')
  }

  const signOut = async () => {
    stopSync()
    await supabase?.auth.signOut({ scope: 'local' }).catch(() => {})
    if (user) await destroyUserData(user)
    clearOutlook()
    localStorage.removeItem(USER_KEY)
    setUser(null)
    setEmail(null)
    setReady(false)
    go('/today')
  }

  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />
  if (!user || showLogin)
    return <Login notConfigured={!isConfigured} onLocal={useLocalOnly} onCancel={showLogin ? () => setShowLogin(false) : null} />
  if (!ready)
    return (
      <div className="splash">
        <Blobs />
        <h1 className="brand">Daybook</h1>
      </div>
    )
  return <Shell email={email} onSignOut={signOut} onSignIn={() => setShowLogin(true)} />
}

const TABS = [
  { path: '/today', label: 'Today', icon: 'today' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar' },
  { path: '/school', label: 'School', icon: 'school' },
  { path: '/cycle', label: 'Cycle', icon: 'cycle' },
  { path: '/habits', label: 'Dailies', icon: 'habits' },
]

function Shell({ email, onSignOut, onSignIn }) {
  const { path } = useRoute()
  const page =
    {
      '/today': <Today />,
      '/calendar': <Calendar />,
      '/school': <School />,
      '/cycle': <Cycle />,
      '/habits': <Habits />,
      '/settings': <Settings email={email} onSignOut={onSignOut} onSignIn={onSignIn} />,
    }[path] || <Today />
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])
  useEffect(() => {
    refreshOutlook()
    const onVis = () => document.visibilityState === 'visible' && refreshOutlook()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onVis)
    }
  }, [])
  return (
    <div className="shell">
      <Blobs />
      <nav className="sidebar" aria-label="Main">
        <div className="brand">Daybook</div>
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={path === t.path ? 'on' : ''}>
            <Icon name={t.icon} /> {t.label}
          </a>
        ))}
        <div className="spacer" />
        <a href="#/settings" className={path === '/settings' ? 'on' : ''}>
          <Icon name="gear" /> Settings
        </a>
        <SyncBadge />
      </nav>
      <div className="topbar">
        <SyncBadge />
        <a href="#/settings" className="icon-btn" aria-label="Settings">
          <Icon name="gear" />
        </a>
      </div>
      <main className="main">{page}</main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={path === t.path || (t.path === '/today' && !TABS.some((x) => x.path === path) && path !== '/settings') ? 'on' : ''}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <EditorHost />
      <ReminderPopup />
    </div>
  )
}

function SyncBadge() {
  const s = useSyncState()
  let label = 'This device only'
  let cls = 'local'
  if (s.status === 'synced' && !s.pending) (label = 'Synced'), (cls = 'ok')
  else if (s.status === 'syncing') (label = 'Syncing…'), (cls = 'busy')
  else if (s.status === 'offline') (label = 'Offline · saved on device'), (cls = 'warn')
  else if (s.status === 'error') (label = 'Sync problem'), (cls = 'err')
  else if (s.status === 'signedout') (label = 'Sign in to sync'), (cls = 'err')
  else if (s.pending) (label = 'Waiting to sync'), (cls = 'warn')
  else if (s.status === 'idle' && localStorage.getItem(USER_KEY) !== 'local') (label = 'Connecting…'), (cls = 'busy')
  return (
    <a href="#/settings" className={`sync-badge ${cls}`} title={s.error || label}>
      <i /> <span>{label}</span>
    </a>
  )
}

/** Shows active reminders when the app is opened (and when returning after an hour away). */
function ReminderPopup() {
  const reminders = useItems('reminder')
  useItems('settings')
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState([])
  const date = todayStr()
  const active = reminders.filter((r) => reminderActive(r, date))

  useEffect(() => {
    let hiddenAt = null
    const show = () => {
      if (!getSettings().reminderPopup) return
      setSnapshot(null) // filled from the current list on next render
      setOpen(true)
    }
    const t = setTimeout(show, 600)
    const vis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 60 * 60 * 1000) show()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  useEffect(() => {
    if (open && snapshot === null) {
      if (!active.length) setOpen(false)
      else setSnapshot(active.map((r) => r.id))
    }
  }, [open, snapshot, active])

  if (!open || !snapshot) return null
  const shown = snapshot.map((id) => reminders.find((r) => r.id === id)).filter(Boolean)
  return (
    <Sheet open onClose={() => setOpen(false)} title="Don’t forget">
      <ul className="task-list">
        {shown.map((r) => (
          <li key={r.id} className={`task reminder ${r.done ? 'done' : ''}`} style={cssVars(r.color || DEFAULTS.reminder)}>
            <Check checked={!!r.done} color={r.color || DEFAULTS.reminder} onChange={(v) => patch(r.id, { done: v, doneAt: v ? todayStr() : null })} />
            <div className="task-body">
              <span className="task-title">{r.text}</span>
              {r.date && <span className="task-meta">{r.date < date ? `was due ${fmtDay(r.date)}` : r.date === date ? 'last day today' : `by ${fmtDay(r.date)}`}</span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <button className="btn primary" onClick={() => setOpen(false)}>
          Got it
        </button>
      </div>
    </Sheet>
  )
}
