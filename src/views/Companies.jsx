import { useMemo, useState } from 'react'
import Drawer from '../components/Drawer.jsx'
import Modal from '../components/Modal.jsx'
import Empty from '../components/Empty.jsx'
import { OPEN_STAGES, fmtDate, fmtMoneyFull, initials } from '../format.js'

const empty = { name: '', domain: '', industry: '', size: '11-50' }
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

export default function Companies({ store }) {
  const { companies, contacts, deals } = store.data
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies
      .map((c) => {
        const cs = contacts.filter((x) => x.companyId === c.id)
        const ds = deals.filter((x) => x.companyId === c.id)
        return {
          ...c,
          contactCount: cs.length,
          dealCount: ds.length,
          openValue: ds.filter((d) => OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + d.value, 0),
          wonValue: ds.filter((d) => d.stage === 'Won').reduce((s, d) => s + d.value, 0)
        }
      })
      .filter((c) => !q || (c.name + ' ' + c.industry + ' ' + c.domain).toLowerCase().includes(q))
      .sort((a, b) => b.openValue - a.openValue)
  }, [companies, contacts, deals, search])

  const selected = useMemo(() => {
    const base = companies.find((c) => c.id === selectedId)
    if (!base) return null
    const cs = contacts.filter((x) => x.companyId === base.id)
    const ds = deals.filter((x) => x.companyId === base.id)
    return {
      ...base,
      contactCount: cs.length,
      dealCount: ds.length,
      openValue: ds.filter((d) => OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + d.value, 0),
      wonValue: ds.filter((d) => d.stage === 'Won').reduce((s, d) => s + d.value, 0)
    }
  }, [companies, contacts, deals, selectedId])
  const selectedContacts = selected ? contacts.filter((c) => c.companyId === selected.id) : []
  const selectedDeals = selected ? deals.filter((d) => d.companyId === selected.id) : []

  function openNew() {
    setForm(empty)
    setErrors({})
    setEditing('new')
  }

  function openEdit(c) {
    setForm({ id: c.id, name: c.name, domain: c.domain || '', industry: c.industry || '', size: c.size || '11-50' })
    setErrors({})
    setEditing(c.id)
  }

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Enter a company name.'
    if (form.domain && /\s/.test(form.domain.trim())) errs.domain = 'Domains cannot contain spaces.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    store.saveCompany({
      ...(editing === 'new' ? {} : { id: editing }),
      name: form.name.trim(),
      domain: form.domain.trim(),
      industry: form.industry.trim(),
      size: form.size
    })
    setEditing(null)
  }

  function remove(c) {
    if (window.confirm('Delete ' + c.name + '? Contacts and deals stay but lose their company link.')) {
      store.deleteCompany(c.id)
      setSelectedId(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Companies</h1>
          <p className="muted">
            {companies.length === 0
              ? 'No accounts yet. Add the first company you are working.'
              : companies.length + (companies.length === 1 ? ' account' : ' accounts') + ', ranked by open pipeline'}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={openNew}>
          Add company
        </button>
      </div>

      <div className="toolbar">
        <div className="field grow">
          <label className="sr-only" htmlFor="company-search">
            Search companies
          </label>
          <input
            id="company-search"
            type="search"
            placeholder="Search by name, industry or domain"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="card">
          <Empty
            title="No companies yet"
            body="Add an account to group its contacts and deals in one place."
            action={
              <button type="button" className="btn primary" onClick={openNew}>
                Add company
              </button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty
            title="No companies match"
            body="Try a different search, or add the account you are working."
            action={
              <button type="button" className="btn" onClick={() => setSearch('')}>
                Clear search
              </button>
            }
          />
        </div>
      ) : (
        <ul className="company-grid">
          {rows.map((c) => (
            <li key={c.id}>
              <button type="button" className="company-card" onClick={() => setSelectedId(c.id)}>
                <span className="company-top">
                  <span className="avatar" aria-hidden="true">
                    {initials(c.name)}
                  </span>
                  <span>
                    <span className="company-name">{c.name}</span>
                    <span className="muted small block">{c.domain || 'No domain'}</span>
                  </span>
                </span>
                <span className="company-meta">
                  <span className="chip">{c.industry || 'Unspecified'}</span>
                  <span className="chip">{c.size} staff</span>
                </span>
                <span className="company-stats">
                  <span>
                    <strong>{c.contactCount}</strong> contacts
                  </span>
                  <span>
                    <strong>{c.dealCount}</strong> deals
                  </span>
                  <span>
                    <strong>{fmtMoneyFull(c.openValue)}</strong> open
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add company' : 'Edit company'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" form="company-form" className="btn primary">
                {editing === 'new' ? 'Add company' : 'Save changes'}
              </button>
            </>
          }
        >
          <form id="company-form" className="form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="co-name">Company name</label>
              <input
                id="co-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="error">{errors.name}</p>}
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="co-domain">Domain</label>
                <input
                  id="co-domain"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="example.com"
                  aria-invalid={!!errors.domain}
                />
                {errors.domain && <p className="error">{errors.domain}</p>}
              </div>
              <div className="field">
                <label htmlFor="co-industry">Industry</label>
                <input
                  id="co-industry"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="co-size">Headcount</label>
              <select id="co-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
                {SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Drawer
          title={selected.name}
          subtitle={[selected.industry, selected.size + ' staff'].filter(Boolean).join(' · ')}
          onClose={() => setSelectedId(null)}
          actions={
            <>
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  openEdit(selected)
                  setSelectedId(null)
                }}
              >
                Edit
              </button>
              <button type="button" className="btn sm danger" onClick={() => remove(selected)}>
                Delete
              </button>
            </>
          }
        >
          <dl className="details">
            <div>
              <dt>Domain</dt>
              <dd>{selected.domain || '—'}</dd>
            </div>
            <div>
              <dt>Open pipeline</dt>
              <dd>{fmtMoneyFull(selected.openValue)}</dd>
            </div>
            <div>
              <dt>Closed won</dt>
              <dd>{fmtMoneyFull(selected.wonValue)}</dd>
            </div>
            <div>
              <dt>Contacts</dt>
              <dd>{selected.contactCount}</dd>
            </div>
          </dl>

          <h3 className="section-title">Contacts ({selectedContacts.length})</h3>
          {selectedContacts.length === 0 ? (
            <Empty title="No contacts here yet" body="Assign a contact to this company from the contacts table." />
          ) : (
            <ul className="mini-list">
              {selectedContacts.map((c) => (
                <li key={c.id}>
                  <div>
                    <p className="mini-title">{c.name}</p>
                    <p className="muted small">
                      {c.title || 'No title'} · {c.email}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="section-title">Deals ({selectedDeals.length})</h3>
          {selectedDeals.length === 0 ? (
            <Empty title="No deals for this account" body="Add one from the pipeline board." />
          ) : (
            <ul className="mini-list">
              {selectedDeals.map((d) => (
                <li key={d.id}>
                  <div>
                    <p className="mini-title">{d.title}</p>
                    <p className="muted small">
                      {fmtMoneyFull(d.value)} · closes {fmtDate(d.closeDate)}
                    </p>
                  </div>
                  <span className={'chip stage-chip-' + d.stage.toLowerCase()}>{d.stage}</span>
                </li>
              ))}
            </ul>
          )}
        </Drawer>
      )}
    </>
  )
}
