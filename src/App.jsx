import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store.js'
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

function Icon({ name }) {
  const paths = {
    grid: 'M4 4h6v6H4V4Zm0 10h6v6H4v-6ZM14 4h6v6h-6V4Zm0 10h6v6h-6v-6Z',
    people:
      'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.75c-2.9 0-5.75 1.45-5.75 3.5V20h11.5v-3.75c0-2.05-2.85-3.5-5.75-3.5ZM17 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm4.75 8v-2.9c0-1.6-1.9-2.85-4.2-2.98 1.2.9 1.95 2.1 1.95 3.13V20h2.25Z',
    building:
      'M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v11H4Zm3-13h3V5H7v3Zm0 5h3v-3H7v3Zm0 5h3v-3H7v3Zm6 0h3v-3h-3v3Zm0-5h3v-3h-3v3Zm5 5h2v-3h-2v3Z',
    kanban: 'M3 4h5v13H3V4Zm7.5 0h5v9h-5V4ZM18 4h3v16h-3V4Z'
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ico">
      <path d={paths[name]} />
    </svg>
  )
}

export default function App() {
  const store = useStore()
  const [view, setView] = useState(() => {
    const fromHash = window.location.hash.replace('#', '')
    return NAV.some((n) => n.id === fromHash) ? fromHash : 'dashboard'
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
      if (NAV.some((n) => n.id === next)) setView(next)
    }
    window.addEventListener('hashchange', onPop)
    return () => window.removeEventListener('hashchange', onPop)
  }, [])

  const pipeline = useMemo(() => {
    return store.data.deals
      .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
      .reduce((sum, d) => sum + d.value, 0)
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
          </ul>
        </nav>
        <div className="sidebar-foot">
          <p className="side-label">Open pipeline</p>
          <p className="side-value">{fmtMoney(pipeline)}</p>
          <button type="button" className="btn ghost sm" onClick={store.reseed}>
            Reset sample data
          </button>
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
              JR
            </span>
            <span className="who-text">
              <strong>Julian Rivera</strong>
              <small>Sales lead</small>
            </span>
          </div>
        </header>

        <main className="content" id="main">
          {view === 'dashboard' && <Dashboard store={store} onNavigate={setView} />}
          {view === 'contacts' && <Contacts store={store} />}
          {view === 'companies' && <Companies store={store} />}
          {view === 'deals' && <Deals store={store} />}
        </main>
      </div>
      {navOpen && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    </div>
  )
}
