import { useEffect, useRef, useState } from 'react'
import { isEmail, logIn, signUp } from '../auth.js'

const BLANK = { name: '', email: '', password: '', confirm: '' }

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const firstFieldRef = useRef(null)

  const isSignUp = mode === 'signup'

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [mode])

  const set = (field) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev
      const next = { ...prev }
      delete next[field]
      delete next.form
      return next
    })
  }

  function validate() {
    const next = {}
    if (isSignUp && !form.name.trim()) next.name = 'Enter your name.'
    if (!form.email.trim()) next.email = 'Enter your email address.'
    else if (!isEmail(form.email)) next.email = 'Enter a valid email address, like you@company.com.'
    if (!form.password) next.password = 'Enter your password.'
    else if (isSignUp && form.password.length < 8) next.password = 'Use at least 8 characters.'
    if (isSignUp && form.confirm !== form.password) next.confirm = 'Both passwords must match.'
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      const result = isSignUp
        ? await signUp({ name: form.name, email: form.email, password: form.password })
        : await logIn({ email: form.email, password: form.password })
      if (!result.ok) {
        setErrors({ [result.field || 'form']: result.error })
        return
      }
      setForm(BLANK)
      onAuthed(result.user)
    } finally {
      setBusy(false)
    }
  }

  function switchTo(next) {
    setMode(next)
    setErrors({})
    setForm((f) => ({ ...BLANK, email: f.email }))
  }

  return (
    <div className="auth-page">
      <main className="auth-card" id="main">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            PC
          </span>
          <span className="brand-name">Pipeline CRM</span>
        </div>
        <h1 className="auth-title">{isSignUp ? 'Create your account' : 'Log in to your pipeline'}</h1>
        <p className="auth-sub">
          {isSignUp
            ? 'Your contacts, companies and deals are stored on the server under your account only.'
            : 'Pick up your pipeline where you left it, from any browser you log in from.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            id="tab-login"
            aria-selected={!isSignUp}
            aria-controls="auth-form"
            className={'auth-tab' + (!isSignUp ? ' active' : '')}
            onClick={() => switchTo('login')}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            id="tab-signup"
            aria-selected={isSignUp}
            aria-controls="auth-form"
            className={'auth-tab' + (isSignUp ? ' active' : '')}
            onClick={() => switchTo('signup')}
          >
            Sign up
          </button>
        </div>

        <form
          className="form auth-form"
          id="auth-form"
          role="tabpanel"
          aria-labelledby={isSignUp ? 'tab-signup' : 'tab-login'}
          onSubmit={handleSubmit}
          noValidate
        >
          {errors.form && (
            <p className="form-alert" role="alert">
              {errors.form}
            </p>
          )}

          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                ref={isSignUp ? firstFieldRef : null}
                type="text"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'err-name' : undefined}
              />
              {errors.name && (
                <p className="error" id="err-name">
                  {errors.name}
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              ref={!isSignUp ? firstFieldRef : null}
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'err-email' : undefined}
            />
            {errors.email && (
              <p className="error" id="err-email">
                {errors.email}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'err-password' : isSignUp ? 'hint-password' : undefined}
            />
            {isSignUp && !errors.password && (
              <p className="hint" id="hint-password">
                At least 8 characters.
              </p>
            )}
            {errors.password && (
              <p className="error" id="err-password">
                {errors.password}
              </p>
            )}
          </div>

          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                autoComplete="new-password"
                aria-invalid={errors.confirm ? 'true' : undefined}
                aria-describedby={errors.confirm ? 'err-confirm' : undefined}
              />
              {errors.confirm && (
                <p className="error" id="err-confirm">
                  {errors.confirm}
                </p>
              )}
            </div>
          )}

          <button type="submit" className="btn primary auth-submit" disabled={busy}>
            {busy ? 'Working…' : isSignUp ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'No account yet?'}{' '}
          <button type="button" className="link-btn" onClick={() => switchTo(isSignUp ? 'login' : 'signup')}>
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </p>

        <p className="auth-note">
          Passwords are hashed with scrypt and a per-account salt. Your session is an HttpOnly cookie, so
          no script in the page can read it.
        </p>
      </main>
    </div>
  )
}
