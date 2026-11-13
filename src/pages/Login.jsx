import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Blobs } from '../components/ui.jsx'

export default function Login({ onLocal, onCancel, notConfigured }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const redirect = window.location.origin + window.location.pathname

  const submit = async (e) => {
    e.preventDefault()
    if (!navigator.onLine) return setMsg({ err: true, text: 'You’re offline. Connect to the internet to sign in.' })
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
        if (error) throw error
        if (!data.session) setMsg({ text: 'Check your email and tap the confirmation link, then come back here and sign in.' })
        setMode('signin')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })
        if (error) throw error
        setMsg({ text: 'If that email has an account, a reset link is on its way.' })
        setMode('signin')
      }
    } catch (err) {
      setMsg({ err: true, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <Blobs />
      <div className="login-card">
        <h1 className="brand">Daybook</h1>
        <p className="muted">School, your cycle and everything else, in one place.</p>
        {notConfigured ? (
          <div className="notice">
            <p>
              Supabase isn’t connected yet. Add your project URL and anon key to <code>src/config.js</code> to turn on accounts and syncing.
            </p>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {mode !== 'reset' && (
              <label className="field">
                <span className="field-label">Password</span>
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            )}
            {msg && <p className={msg.err ? 'error' : 'notice'}>{msg.text}</p>}
            <button className="btn primary wide" disabled={busy}>
              {busy ? '…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
            <div className="login-links">
              {mode === 'signin' ? (
                <>
                  <button type="button" className="link" onClick={() => setMode('signup')}>
                    Create an account
                  </button>
                  <button type="button" className="link" onClick={() => setMode('reset')}>
                    Forgot password?
                  </button>
                </>
              ) : (
                <button type="button" className="link" onClick={() => setMode('signin')}>
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        )}
        <div className="login-alt">
          {onCancel ? (
            <button className="link" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <button className="link" onClick={onLocal}>
              Use without an account (this device only)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NewPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setMsg(error.message)
    else onDone()
  }
  return (
    <div className="login">
      <Blobs />
      <form className="login-card form" onSubmit={submit}>
        <h1 className="brand">New password</h1>
        <label className="field">
          <span className="field-label">New password</span>
          <input type="password" autoComplete="new-password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </label>
        {msg && <p className="error">{msg}</p>}
        <button className="btn primary wide">Save password</button>
      </form>
    </div>
  )
}
