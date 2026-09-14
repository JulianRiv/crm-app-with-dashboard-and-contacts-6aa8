import { useState } from 'react'
import { changePassword, deleteAccount, initialsFrom, isEmail, updateProfile } from '../auth.js'
import { fmtDate } from '../format.js'

export default function Settings({ user, store, onUserChange, onSignOut }) {
  const [profile, setProfile] = useState({ name: user.name, email: user.email })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileSaved, setProfileSaved] = useState(false)

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSaved, setPwSaved] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const counts = store.data
  // Same rule the sidebar and topbar use, so the preview matches after saving.
  const initials = initialsFrom(profile.name, profile.email)

  function saveProfile(e) {
    e.preventDefault()
    const errors = {}
    if (!profile.name.trim()) errors.name = 'Enter your name.'
    if (!profile.email.trim()) errors.email = 'Enter your email address.'
    else if (!isEmail(profile.email)) errors.email = 'Enter a valid email address, like you@company.com.'
    setProfileErrors(errors)
    setProfileSaved(false)
    if (Object.keys(errors).length > 0) return

    const result = updateProfile(user.id, profile)
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

  function removeAccount(e) {
    e.preventDefault()
    if (confirmText.trim().toLowerCase() !== 'delete') {
      setDeleteError('Type delete to confirm.')
      return
    }
    const result = deleteAccount(user.id)
    if (!result.ok) {
      setDeleteError(result.error)
      return
    }
    onSignOut()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your account details and the data stored for it in this browser.</p>
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
          These records belong to this account only. Other accounts on this browser cannot see them.
        </p>
        {store.isEmpty && (
          <p className="muted small">
            Nothing stored yet. Add a contact, company or deal and it will show up here.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={store.clearAll} disabled={store.isEmpty}>
            Clear all records
          </button>
        </div>
      </section>

      <section className="card settings-card danger-zone" aria-labelledby="sec-danger">
        <div className="card-head">
          <h2 id="sec-danger">Delete account</h2>
        </div>
        <p className="muted">
          Deleting removes your login and every contact, company, deal and note stored under it in this
          browser. There is no undo and no backup.
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
              disabled={confirmText.trim().toLowerCase() !== 'delete'}
            >
              Delete this account
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
