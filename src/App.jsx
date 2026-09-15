import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store.js'
import { fetchSession, logOut } from './auth.js'
import Auth from './views/Auth.jsx'
import Settings from './views/Settings.jsx'
import Dashboard from './views/Dashboard.jsx'
import Contacts from './views/Contacts.jsx'
import Companies from './views/Companies.jsx'
import Deals from './views/Deals.jsx'
import { fmtMoney } from './format.js'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'contacts', label: 'Contacts', icon: 'people' },
  { id: 'companies', label: 'Companies', icon: 'building' },
  { id: 'deals', label: 'Deals', icon: 'kanban' }
]

const VIEWS = [...NAV.map((n) => n.id), 'settings']

function Icon({ name }) {
  const paths = {
    grid: 'M4 4h6v6H4V4Zm0 10h6v6H4v-6ZM14 4h6v6h-6V4Zm0 10h6v6h-6v-6Z',
    people:
      'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.75c-2.9 0-5.75 1.45-5.75 3.5V20h11.5v-3.75c0-2.05-2.85-3.5-5.75-3.5ZM17 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm4.75 8v-2.9c0-1.6-1.9-2.85-4.2-2.98 1.2.9 1.95 2.1 1.95 3.13V20h2.25Z',
    building:
      'M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v11H4Zm3-13h3V5H7v3Zm0 5h3v-3H7v3Zm0 5h3v-3H7v3Zm6 0h3v-3h-3v3Zm0-5h3v-3h-3v3Zm5 5h2v-3h-2v3Z',
    kanban: 'M3 4h5v13H3V4Zm7.5 0h5v9h-5V4ZM18 4h3v16h-3V4Z',
    gear: 'M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm8.4-2.6.05-.9-.05-.9 1.9-1.45-1.9-3.3-2.25.75a7.6 7.6 0 0 0-1.55-.9L16.2 3.6h-3.8l-.4 2.6c-.55.23-1.07.53-1.55.9l-2.25-.75-1.9 3.3L8.2 11.1c-.03.3-.05.6-.05.9s.02.6.05.9l-1.9 1.45 1.9 3.3 2.25-.75c.48.37 1 .67 1.55.9l.4 2.6h3.8l.4-2.6c.55-.23 1.07-.53 1.55-.9l2.25.75 1.9-3.3-1.9-1.45Z',
    logout: 'M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm6.2 4.4-1.4 1.4L16.6 11H9v2h7.6l-1.8 1.8 1.4 1.4L20.4 12l-4.2-4.6Z',
    chevron: 'M7 10l5 5 5-5H7Z'
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ico">
      <path d={paths[name]} />
    </svg>
  )
}

function UserMenu({ user, onSettings, onLogout }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="user-menu" ref={wrapRef}>
      {open && (
        <div className="user-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            className="pop-item"
            onClick={() => {
              setOpen(false)
              onSettings()
            }}
          >
            <Icon name="gear" />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="pop-item danger"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            <Icon name="logout" />
            Log out
          </button>
        </div>
      )}
      <button
        type="button"
        className="user-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {user.initials}
        </span>
        <span className="user-id">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
        <Icon name="chevron" />
      </button>
    </div>
  )
}

function BootScreen({ message }) {
  return (
    <div className="boot-page">
      <div className="boot-card">
        <span className="brand-mark lg" aria-hidden="true">
          PC
        </span>
        <p className="boot-msg" role="status">
          {message}
        </p>
        <span className="boot-bar" aria-hidden="true">
          <span className="boot-bar-fill" />
        </span>
      </div>
    </div>
  )
}

function BootError({ message, onRetry }) {
  return (
    <div className="boot-page">
      <div className="boot-card">
        <span className="brand-mark lg" aria-hidden="true">
          PC
        </span>
        <h1 className="boot-title">Cannot reach the server</h1>
        <p className="boot-msg">{message}</p>
        <button type="button" className="btn primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}

function Workspace({ user, onUserChange, onSignOut }) {
  const store = useStore(user.id)
  const [view, setView] = useState(() => {
    const fromHash = window.location.hash.replace('#', '')
    return VIEWS.includes(fromHash) ? fromHash : 'dashboard'
  })
  const [query, setQuery] = useState('')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (window.location.hash.replace('#', '') !== view) window.location.hash = view
    setNavOpen(false)
  }, [view])

  useEffect(() => {
    const onPop = () => {
      const next = window.location.hash.replace('#', '')
      if (VIEWS.includes(next)) setView(next)
    }
    window.addEventListener('hashchange', onPop)
    return () => window.removeEventListener('hashchange', onPop)
  }, [])

  // A 401 from any request means the cookie session ended (expired, or the
  // account was deleted in another tab). Drop back to the login card instead
  // of leaving a signed-in shell that cannot load or save anything.
  useEffect(() => {
    if (store.unauthorized) onSignOut({ serverCall: false })
  }, [store.unauthorized, onSignOut])

  const pipeline = useMemo(() => {
    return store.data.deals
      .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
      .reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  }, [store.data.deals])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return null
    const { contacts, companies, deals } = store.data
    return [
      ...contacts
        .filter((c) => (c.name + ' ' + c.email).toLowerCase().includes(q))
        .slice(0, 5)
        .map((c) => ({ id: 'c' + c.id, kind: 'Contact', label: c.name, sub: c.email, go: 'contacts' })),
      ...companies
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map((c) => ({ id: 'co' + c.id, kind: 'Company', label: c.name, sub: c.industry, go: 'companies' })),
      ...deals
        .filter((d) => d.title.toLowerCase().includes(q))
        .slice(0, 4)
        .map((d) => ({ id: 'd' + d.id, kind: 'Deal', label: d.title, sub: fmtMoney(d.value), go: 'deals' }))
    ]
  }, [query, store.data])

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            PC
          </span>
          <span className="brand-name">Pipeline CRM</span>
        </div>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={'nav-item' + (view === item.id ? ' active' : '')}
                  aria-current={view === item.id ? 'page' : undefined}
                  onClick={() => setView(item.id)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className={'nav-item' + (view === 'settings' ? ' active' : '')}
                aria-current={view === 'settings' ? 'page' : undefined}
                onClick={() => setView('settings')}
              >
                <Icon name="gear" />
                Settings
              </button>
            </li>
          </ul>
        </nav>
        <div className="sidebar-foot">
          <p className="side-label">Open pipeline</p>
          <p className="side-value">{store.loading ? '—' : fmtMoney(pipeline)}</p>
          <UserMenu user={user} onSettings={() => setView('settings')} onLogout={onSignOut} />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="ico">
              <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
            </svg>
          </button>
          <div className="search-wrap">
            <label className="sr-only" htmlFor="global-search">
              Search contacts, companies and deals
            </label>
            <input
              id="global-search"
              className="search"
              type="search"
              placeholder="Search contacts, companies, deals"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              autoComplete="off"
            />
            {results && (
              <div className="results" role="listbox">
                {results.length === 0 ? (
                  <p className="results-empty">No matches for “{query}”.</p>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="result"
                      onClick={() => {
                        setView(r.go)
                        setQuery('')
                      }}
                    >
                      <span className="chip">{r.kind}</span>
                      <span className="result-label">{r.label}</span>
                      <span className="result-sub">{r.sub}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="who">
            <span className="avatar" aria-hidden="true">
              {user.initials}
            </span>
            <span className="who-text">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
        </header>

        <main className="content" id="main">
          {store.error && (
            <div className="sync-banner" role="alert">
              <span>{store.error}</span>
              <button type="button" className="btn small" onClick={store.reload} disabled={store.saving}>
                Retry
              </button>
            </div>
          )}
          {store.loading ? (
            <div className="load-panel" role="status">
              <span className="spinner" aria-hidden="true" />
              Loading your records from the server…
            </div>
          ) : (
            <>
              {view === 'dashboard' && <Dashboard store={store} onNavigate={setView} />}
              {view === 'contacts' && <Contacts store={store} />}
              {view === 'companies' && <Companies store={store} />}
              {view === 'deals' && <Deals store={store} />}
              {view === 'settings' && (
                <Settings user={user} store={store} onUserChange={onUserChange} onSignOut={onSignOut} />
              )}
            </>
          )}
        </main>
      </div>
      {navOpen && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    </div>
  )
}

export default function App() {
  const [boot, setBoot] = useState({ status: 'loading', user: null, error: '' })

  const loadSession = useCallback(async () => {
    setBoot((b) => ({ ...b, status: 'loading', error: '' }))
    const result = await fetchSession()
    if (result.ok) {
      setBoot({ status: 'ready', user: result.user, error: '' })
      return
    }
    setBoot({ status: 'error', user: null, error: result.error })
  }, [])

  // The session lives in an HttpOnly cookie, so the only way to know who is
  // signed in is to ask the server on boot.
  useEffect(() => {
    loadSession()
  }, [loadSession])

  const handleAuthed = (nextUser) => {
    window.location.hash = 'dashboard'
    setBoot({ status: 'ready', user: nextUser, error: '' })
  }

  // Logging out clears the server session and the cookie. Every record stays
  // in Postgres under this user id and loads again on the next login.
  const handleSignOut = useCallback(async (opts) => {
    setBoot({ status: 'ready', user: null, error: '' })
    window.location.hash = ''
    if (!opts || opts.serverCall !== false) await logOut()
  }, [])

  if (boot.status === 'loading') return <BootScreen message="Checking your session…" />
  if (boot.status === 'error') return <BootError message={boot.error} onRetry={loadSession} />
  if (!boot.user) return <Auth onAuthed={handleAuthed} />

  // Keying on the account id remounts the authenticated subtree when the
  // session changes, so the store refetches for the new user instead of
  // showing the previous account's rows.
  return (
    <Workspace
      key={boot.user.id}
      user={boot.user}
      onUserChange={(u) => setBoot({ status: 'ready', user: u, error: '' })}
      onSignOut={handleSignOut}
    />
  )
}
