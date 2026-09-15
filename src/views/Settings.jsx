import { useRef, useState } from 'react'
import {
  changePassword,
  deleteAccount,
  exportAccountData,
  initialsFrom,
  isEmail,
  updateProfile
} from '../auth.js'
import { COLLECTIONS } from '../store.js'
import { fmtDate } from '../format.js'

function countOf(payload) {
  return COLLECTIONS.reduce((n, name) => n + (Array.isArray(payload[name]) ? payload[name].length : 0), 0)
}

export default function Settings({ user, store, onUserChange, onSignOut }) {
  const fileRef = useRef(null)
  const [transfer, setTransfer] = useState({ tone: '', message: '' })

  const [profile, setProfile] = useState({ name: user.name, email: user.email })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileSaved, setProfileSaved] = useState(false)

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSaved, setPwSaved] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const counts = store.data
  // Same rule the sidebar and topbar use, so the preview matches after saving.
  const initials = initialsFrom(profile.name, profile.email)

  async function saveProfile(e) {
    e.preventDefault()
    const errors = {}
    if (!profile.name.trim()) errors.name = 'Enter your name.'
    if (!profile.email.trim()) errors.email = 'Enter your email address.'
    else if (!isEmail(profile.email)) errors.email = 'Enter a valid email address, like you@company.com.'
    setProfileErrors(errors)
    setProfileSaved(false)
    if (Object.keys(errors).length > 0) return

    const result = await updateProfile(user.id, profile)
    if (!result.ok) {
      setProfileErrors({ [result.field || 'form']: result.error })
      return
    }
    onUserChange(result.user)
    setProfile({ name: result.user.name, email: result.user.email })
    setProfileSaved(true)
  }

  async function savePassword(e) {
    e.preventDefault()
    if (pwBusy) return
    const errors = {}
    if (!pw.currentPassword) errors.currentPassword = 'Enter your current password.'
    if (!pw.newPassword) errors.newPassword = 'Enter a new password.'
    else if (pw.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.'
    if (pw.confirm !== pw.newPassword) errors.confirm = 'Both passwords must match.'
    setPwErrors(errors)
    setPwSaved(false)
    if (Object.keys(errors).length > 0) return

    setPwBusy(true)
    try {
      const result = await changePassword(user.id, {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword
      })
      if (!result.ok) {
        setPwErrors({ [result.field || 'form']: result.error })
        return
      }
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
      setPwSaved(true)
    } finally {
      setPwBusy(false)
    }
  }

  async function exportData() {
    setTransfer({ tone: '', message: 'Preparing your export…' })
    // The file is built from what the database holds right now, not from the
    // copy in this tab, so an export is always complete.
    const result = await exportAccountData()
    if (!result.ok) {
      setTransfer({ tone: 'error', message: result.error })
      return
    }
    try {
      const payload = result.payload
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const stamp = new Date().toISOString().slice(0, 10)
      const link = document.createElement('a')
      link.href = url
      link.download = `pipeline-crm-${stamp}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setTransfer({ tone: 'ok', message: `Exported ${countOf(store.data)} records.` })
    } catch {
      setTransfer({ tone: 'error', message: 'The browser blocked the download. Try again.' })
    }
  }

  async function importData(e) {
    const file = e.target.files && e.target.files[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setTransfer({ tone: '', message: '' })
    let records = null
    try {
      const parsed = JSON.parse(await file.text())
      records = parsed && parsed.records && typeof parsed.records === 'object' ? parsed.records : parsed
      if (!records || typeof records !== 'object' || !COLLECTIONS.some((name) => Array.isArray(records[name]))) {
        setTransfer({ tone: 'error', message: 'That file is not a Pipeline CRM export. Nothing was changed.' })
        return
      }
    } catch {
      setTransfer({ tone: 'error', message: 'That file could not be read as JSON. Nothing was changed.' })
      return
    }
    const incoming = countOf(records)
    const proceed = window.confirm(
      `Replace this account's ${countOf(store.data)} records with ${incoming} from the file? This overwrites what is stored now.`
    )
    if (!proceed) {
      setTransfer({ tone: '', message: 'Import cancelled. Nothing was changed.' })
      return
    }
    store.replaceAll(records)
    setTransfer({ tone: 'ok', message: `Imported ${incoming} records into this account.` })
  }

  async function removeAccount(e) {
    e.preventDefault()
    if (deleteBusy) return
    if (confirmText.trim().toLowerCase() !== 'delete') {
      setDeleteError('Type delete to confirm.')
      return
    }
    setDeleteBusy(true)
    try {
      // The server cascades every company, contact, deal and note from the
      // user row and clears the session cookie, so there is nothing left to
      // sign out of: skip the logout call and drop straight to the login card.
      const result = await deleteAccount()
      if (!result.ok) {
        setDeleteError(result.error)
        return
      }
      onSignOut({ serverCall: false })
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your account details and the records stored for it on the server.</p>
        </div>
      </div>

      <section className="card settings-card" aria-labelledby="sec-profile">
        <div className="card-head">
          <h2 id="sec-profile">Profile</h2>
          <span className="chip">Member since {fmtDate(user.createdAt)}</span>
        </div>
        <div className="profile-row">
          <span className="avatar lg" aria-hidden="true">
            {initials || 'U'}
          </span>
          <div>
            <p className="profile-name">{user.name}</p>
            <p className="muted small">{user.email}</p>
          </div>
        </div>
        <form className="form" onSubmit={saveProfile} noValidate>
          {profileErrors.form && (
            <p className="form-alert" role="alert">
              {profileErrors.form}
            </p>
          )}
          <div className="form-row">
            <div className="field grow">
              <label htmlFor="set-name">Full name</label>
              <input
                id="set-name"
                type="text"
                value={profile.name}
                onChange={(e) => {
                  setProfile((p) => ({ ...p, name: e.target.value }))
                  setProfileSaved(false)
                }}
                autoComplete="name"
                aria-invalid={profileErrors.name ? 'true' : undefined}
              />
              {profileErrors.name && <p className="error">{profileErrors.name}</p>}
            </div>
            <div className="field grow">
              <label htmlFor="set-email">Email</label>
              <input
                id="set-email"
                type="email"
                value={profile.email}
                onChange={(e) => {
                  setProfile((p) => ({ ...p, email: e.target.value }))
                  setProfileSaved(false)
                }}
                autoComplete="email"
                aria-invalid={profileErrors.email ? 'true' : undefined}
              />
              {profileErrors.email && <p className="error">{profileErrors.email}</p>}
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Save profile
            </button>
            {profileSaved && (
              <p className="ok-msg" role="status">
                Profile saved.
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="card settings-card" aria-labelledby="sec-password">
        <div className="card-head">
          <h2 id="sec-password">Password</h2>
        </div>
        <form className="form" onSubmit={savePassword} noValidate>
          {pwErrors.form && (
            <p className="form-alert" role="alert">
              {pwErrors.form}
            </p>
          )}
          <div className="field">
            <label htmlFor="pw-current">Current password</label>
            <input
              id="pw-current"
              type="password"
              value={pw.currentPassword}
              onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              autoComplete="current-password"
              aria-invalid={pwErrors.currentPassword ? 'true' : undefined}
            />
            {pwErrors.currentPassword && <p className="error">{pwErrors.currentPassword}</p>}
          </div>
          <div className="form-row">
            <div className="field grow">
              <label htmlFor="pw-new">New password</label>
              <input
                id="pw-new"
                type="password"
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                autoComplete="new-password"
                aria-invalid={pwErrors.newPassword ? 'true' : undefined}
              />
              {pwErrors.newPassword ? (
                <p className="error">{pwErrors.newPassword}</p>
              ) : (
                <p className="hint">At least 8 characters.</p>
              )}
            </div>
            <div className="field grow">
              <label htmlFor="pw-confirm">Confirm new password</label>
              <input
                id="pw-confirm"
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
                aria-invalid={pwErrors.confirm ? 'true' : undefined}
              />
              {pwErrors.confirm && <p className="error">{pwErrors.confirm}</p>}
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Change password'}
            </button>
            {pwSaved && (
              <p className="ok-msg" role="status">
                Password updated.
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="card settings-card" aria-labelledby="sec-data">
        <div className="card-head">
          <h2 id="sec-data">Your data</h2>
        </div>
        <ul className="stat-row">
          <li>
            <span className="stat-value">{counts.contacts.length}</span>
            <span className="muted small">Contacts</span>
          </li>
          <li>
            <span className="stat-value">{counts.companies.length}</span>
            <span className="muted small">Companies</span>
          </li>
          <li>
            <span className="stat-value">{counts.deals.length}</span>
            <span className="muted small">Deals</span>
          </li>
          <li>
            <span className="stat-value">{counts.activities.length}</span>
            <span className="muted small">Notes and activities</span>
          </li>
        </ul>
        <p className="muted small">
          These records live in Postgres under your account id. They stay there when you log out and load
          again from any browser you log in from. No other account can read them.
        </p>
        {store.error && (
          <p className="form-alert" role="alert">
            {store.error}
          </p>
        )}
        {store.isEmpty && !store.error && (
          <p className="muted small">
            Nothing stored yet. Add a contact, company or deal and it will show up here.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn primary" onClick={exportData} disabled={store.isEmpty}>
            Export data
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current && fileRef.current.click()}>
            Import data
          </button>
          <button type="button" className="btn" onClick={store.clearAll} disabled={store.isEmpty}>
            Clear all records
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={importData}
            aria-label="Choose a Pipeline CRM export file to import"
          />
        </div>
        {transfer.message && (
          <p className={transfer.tone === 'error' ? 'error' : 'ok-msg'} role="status">
            {transfer.message}
          </p>
        )}
        <p className="hint">
          Export writes a JSON file of every contact, company, deal and note in this account. Import asks
          you to confirm before it replaces what is stored now.
        </p>
      </section>

      <section className="card settings-card danger-zone" aria-labelledby="sec-danger">
        <div className="card-head">
          <h2 id="sec-danger">Delete account</h2>
        </div>
        <p className="muted">
          Deleting removes your login and every contact, company, deal and note stored under it in the
          database. There is no undo and no backup. Export your data first if you want a copy.
        </p>
        <form className="form" onSubmit={removeAccount} noValidate>
          <div className="field">
            <label htmlFor="confirm-delete">Type delete to confirm</label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setDeleteError('')
              }}
              autoComplete="off"
              placeholder="delete"
              aria-invalid={deleteError ? 'true' : undefined}
            />
            {deleteError && <p className="error">{deleteError}</p>}
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn danger-solid"
              disabled={deleteBusy || confirmText.trim().toLowerCase() !== 'delete'}
            >
              {deleteBusy ? 'Deleting…' : 'Delete this account'}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
