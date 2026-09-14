import { useMemo } from 'react'
import { STAGES, OPEN_STAGES, fmtMoney, fmtMoneyFull, fmtRelative, initials } from '../format.js'
import Empty from '../components/Empty.jsx'

const TYPE_LABEL = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting' }

export default function Dashboard({ store, onNavigate }) {
  const { deals, contacts, activities } = store.data

  const stats = useMemo(() => {
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
    const now = new Date()
    const wonThisMonth = deals.filter((d) => {
      if (d.stage !== 'Won') return false
      const c = new Date(d.closeDate)
      return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear()
    })
    const byStage = STAGES.map((stage) => {
      const rows = deals.filter((d) => d.stage === stage)
      return { stage, count: rows.length, value: rows.reduce((s, d) => s + d.value, 0) }
    })
    const max = Math.max(1, ...byStage.map((s) => s.value))
    return {
      pipeline: open.reduce((s, d) => s + d.value, 0),
      openCount: open.length,
      wonValue: wonThisMonth.reduce((s, d) => s + d.value, 0),
      wonCount: wonThisMonth.length,
      byStage,
      max
    }
  }, [deals])

  const recent = useMemo(
    () => [...activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8),
    [activities]
  )

  const closingSoon = useMemo(
    () =>
      deals
        .filter((d) => OPEN_STAGES.includes(d.stage))
        .sort((a, b) => new Date(a.closeDate) - new Date(b.closeDate))
        .slice(0, 5),
    [deals]
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            {store.isEmpty
              ? 'Nothing tracked yet. Add a company, a contact and a deal to fill this in.'
              : 'Where the pipeline stands today, across ' +
                contacts.length +
                (contacts.length === 1 ? ' contact.' : ' contacts.')}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => onNavigate('deals')}>
          Open pipeline board
        </button>
      </div>

      <section className="kpis" aria-label="Key numbers">
        <article className="kpi">
          <p className="kpi-label">Open pipeline value</p>
          <p className="kpi-value">{fmtMoneyFull(stats.pipeline)}</p>
          <p className="kpi-note">Across Lead through Negotiation</p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Open deals</p>
          <p className="kpi-value">{stats.openCount}</p>
          <p className="kpi-note">
            Average {fmtMoney(stats.openCount ? Math.round(stats.pipeline / stats.openCount) : 0)} per deal
          </p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Won this month</p>
          <p className="kpi-value">{fmtMoneyFull(stats.wonValue)}</p>
          <p className="kpi-note">
            {stats.wonCount} {stats.wonCount === 1 ? 'deal' : 'deals'} closed
          </p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Contacts</p>
          <p className="kpi-value">{contacts.length}</p>
          <p className="kpi-note">{store.data.companies.length} companies tracked</p>
        </article>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Deal value by stage</h2>
            <button type="button" className="btn ghost sm" onClick={() => onNavigate('deals')}>
              View board
            </button>
          </div>
          {deals.length === 0 ? (
            <Empty title="No deals yet" body="Add a deal from the pipeline board to see stage totals here." />
          ) : (
            <ul className="bars">
              {stats.byStage.map((s) => (
                <li key={s.stage} className="bar-row">
                  <span className="bar-label">{s.stage}</span>
                  <span className="bar-track">
                    <span
                      className={'bar-fill stage-' + s.stage.toLowerCase()}
                      style={{ width: Math.max(2, (s.value / stats.max) * 100) + '%' }}
                    />
                  </span>
                  <span className="bar-value">
                    {fmtMoney(s.value)} <small>({s.count})</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Closing soonest</h2>
          </div>
          {closingSoon.length === 0 ? (
            <Empty title="Nothing scheduled" body="Open deals with a close date will show up here." />
          ) : (
            <ul className="mini-list">
              {closingSoon.map((d) => (
                <li key={d.id}>
                  <div>
                    <p className="mini-title">{d.title}</p>
                    <p className="muted small">
                      {store.companyById[d.companyId]?.name || 'No company'} · closes{' '}
                      {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={'chip stage-chip-' + d.stage.toLowerCase()}>{d.stage}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Recent activity</h2>
          <button type="button" className="btn ghost sm" onClick={() => onNavigate('contacts')}>
            Go to contacts
          </button>
        </div>
        {recent.length === 0 ? (
          <Empty title="No activity logged" body="Notes, calls and emails you log against contacts appear here." />
        ) : (
          <ul className="feed">
            {recent.map((a) => {
              const contact = store.contactById[a.contactId]
              const deal = store.data.deals.find((d) => d.id === a.dealId)
              return (
                <li key={a.id}>
                  <span className="avatar sm" aria-hidden="true">
                    {contact ? initials(contact.name) : '··'}
                  </span>
                  <div className="feed-body">
                    <p className="feed-meta">
                      <span className={'chip type-' + a.type}>{TYPE_LABEL[a.type] || a.type}</span>
                      <strong>{contact ? contact.name : 'Unassigned'}</strong>
                      {deal && <span className="muted"> · {deal.title}</span>}
                      <span className="muted"> · {fmtRelative(a.timestamp)}</span>
                    </p>
                    <p className="feed-text">{a.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
