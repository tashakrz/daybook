import { useState } from 'react'
import { patch, hasDirty, getUser, useItems } from '../lib/store.js'
import { getSettings, DEFAULT_SETTINGS } from '../lib/model.js'
import { useSyncState, syncNow } from '../lib/sync.js'
import { Section, Field, Segmented, ColorPicker, go } from '../components/ui.jsx'
import { useOutlook, refreshOutlook, clearOutlook, currentEvents } from '../lib/outlook.js'
import { REMINDER_MODES } from '../components/editors.jsx'
import { supabase } from '../lib/supabase.js'

export default function Settings({ email, onSignOut, onSignIn }) {
  useItems('settings')
  const s = getSettings()
  const set = (k, v) => patch('settings', { [k]: v }, 'settings')
  const sync = useSyncState()
  const local = getUser() === 'local'
  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Make it yours</h1>
        </div>
      </header>
      <div className="settings-grid">
        <Section title="You">
          <div className="card form">
            <Field label="Your name (for the greeting)">
              <input defaultValue={s.name} onBlur={(e) => set('name', e.target.value.trim())} placeholder="Optional" />
            </Field>
          </div>
        </Section>

        <Section title="Account & sync">
          <div className="card">
            {local ? (
              <>
                <p>Using this device only — nothing is backed up or synced.</p>
                {supabase && (
                  <button className="btn primary" onClick={onSignIn}>
                    Sign in to sync (keeps this data)
                  </button>
                )}
              </>
            ) : (
              <>
                <p>
                  Signed in as <strong>{email || '…'}</strong>
                </p>
                <p className="muted small">
                  {sync.status === 'synced' && `Synced ${new Date(sync.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                  {sync.status === 'syncing' && 'Syncing…'}
                  {sync.status === 'offline' && 'Offline — changes are saved on this device and will sync when you’re back online.'}
                  {sync.status === 'error' && `Sync problem: ${sync.error}`}
                  {sync.status === 'signedout' && 'Your session expired. Sign in again to resume syncing.'}
                  {sync.pending && sync.status !== 'syncing' && ' · some changes waiting to upload'}
                </p>
                <div className="form-actions start">
                  <button className="btn ghost small" onClick={() => syncNow()}>
                    Sync now
                  </button>
                  {sync.status === 'signedout' && (
                    <button className="btn primary small" onClick={onSignIn}>
                      Sign in again
                    </button>
                  )}
                  <button
                    className="btn ghost danger small"
                    onClick={() => {
                      const warn = hasDirty() ? '\n\nSome changes haven’t synced yet and will be lost from this device.' : ''
                      if (window.confirm(`Sign out? Your data stays safe in your account and is removed from this device.${warn}`)) onSignOut()
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="Outlook calendar">
          <OutlookSettings s={s} set={set} local={local} />
        </Section>

        <Section title="Water">
          <div className="card form">
            <Field label="Units">
              <Segmented options={[{ value: 'ml', label: 'ml / L' }, { value: 'oz', label: 'oz' }]} value={s.unit} onChange={(v) => set('unit', v)} />
            </Field>
            <div className="row2">
              <Field label="Glass size (ml)">
                <input type="number" inputMode="numeric" defaultValue={s.glass} onBlur={(e) => set('glass', Number(e.target.value) || DEFAULT_SETTINGS.glass)} />
              </Field>
              <Field label="Water bottle size (ml)">
                <input type="number" inputMode="numeric" defaultValue={s.bottle} onBlur={(e) => set('bottle', Number(e.target.value) || DEFAULT_SETTINGS.bottle)} />
              </Field>
            </div>
            <p className="muted small">Change the daily goal under Dailies → Manage → Water.</p>
          </div>
        </Section>

        <Section title="Reminders">
          <div className="card form">
            <label className="toggle-row">
              <input type="checkbox" checked={s.reminderPopup} onChange={(e) => set('reminderPopup', e.target.checked)} />
              Pop up my reminders when I open the app
            </label>
            <Field label="New reminders with a date show…">
              <Segmented options={REMINDER_MODES} value={s.reminderDefaultMode} onChange={(v) => set('reminderDefaultMode', v)} />
            </Field>
          </div>
        </Section>

        <Section title="Cycle">
          <div className="card form">
            <div className="row2">
              <Field label="Typical cycle length" hint="Used until you’ve logged a few cycles">
                <input type="number" min={15} max={60} defaultValue={s.cycleLength} onBlur={(e) => set('cycleLength', Number(e.target.value) || 28)} />
              </Field>
              <Field label="Typical period length">
                <input type="number" min={1} max={14} defaultValue={s.periodLength} onBlur={(e) => set('periodLength', Number(e.target.value) || 5)} />
              </Field>
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={s.showFertile} onChange={(e) => set('showFertile', e.target.checked)} />
              Show estimated fertile window & ovulation
            </label>
            <button className="btn ghost small" onClick={() => go('/cycle')}>
              Birth control is set on the Cycle tab →
            </button>
          </div>
        </Section>

        <Section title="Install on your devices">
          <div className="card install">
            <p>
              <strong>iPhone:</strong> open this site in Safari → Share button → <em>Add to Home Screen</em>.
            </p>
            <p>
              <strong>Mac:</strong> Safari → File → <em>Add to Dock</em> (or Chrome → ⋮ → Cast, save and share → <em>Install page as app</em>).
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}

function OutlookSettings({ s, set, local }) {
  const ol = useOutlook()
  const events = currentEvents(ol)
  const save = async (url) => {
    const v = url.trim()
    if (v === s.outlookUrl) return
    await set('outlookUrl', v)
    if (v) refreshOutlook({ force: true })
    else clearOutlook()
  }
  return (
    <div className="card form">
      <p className="muted small">
        Shows your Outlook events in Daybook (read-only). In Outlook on the web: Settings → Calendar → Shared calendars → Publish a calendar → pick
        your calendar and “Can view all details” → Publish → copy the <strong>ICS</strong> link and paste it here.
      </p>
      {local ? (
        <p className="notice">Sign in to connect Outlook.</p>
      ) : (
        <>
          <Field label="Outlook ICS link">
            <input
              type="url"
              defaultValue={s.outlookUrl}
              placeholder="https://outlook.live.com/owa/calendar/…/calendar.ics"
              onBlur={(e) => save(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Field>
          {s.outlookUrl && (
            <>
              <p className="ol-status muted">
                {ol.status === 'loading' && 'Loading your Outlook calendar…'}
                {ol.status === 'error' && <span className="error">{ol.error}</span>}
                {ol.status === 'offline' && 'Offline. Showing the last copy.'}
                {ol.status !== 'loading' && ol.status !== 'error' && ol.cache?.fetchedAt && events.length >= 0 && ol.cache.url === s.outlookUrl &&
                  ` ${events.length} events · updated ${new Date(ol.cache.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
              </p>
              <div className="form-actions start">
                <button className="btn ghost small" onClick={() => refreshOutlook({ force: true })}>
                  Refresh now
                </button>
              </div>
              <label className="toggle-row">
                <input type="checkbox" checked={s.outlookOnToday} onChange={(e) => set('outlookOnToday', e.target.checked)} />
                Show today’s Outlook events on the Today page
              </label>
              <Field label="Colour for Outlook events">
                <ColorPicker value={s.outlookColor} onChange={(v) => set('outlookColor', v)} />
              </Field>
            </>
          )}
        </>
      )}
    </div>
  )
}
