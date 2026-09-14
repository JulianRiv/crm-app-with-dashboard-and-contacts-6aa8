import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import Drawer from '../components/Drawer.jsx'
import Empty from '../components/Empty.jsx'
import { fmtDate, fmtMoneyFull, fmtRelative, initials } from '../format.js'

const TYPES = ['note', 'call', 'email', 'meeting']
const TYPE_LABEL = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting' }
const empty = { name: '', email: '', phone: '', title: '', companyId: '', owner: 'Julian Rivera', tags: '' }

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Enter a full name.'
  if (!form.email.trim()) errors.email = 'Enter an email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'That email does not look right.'
  if (form.phone && form.phone.replace(/\D/g, '').length < 7) errors.phone = 'Phone needs at least 7 digits.'
  return errors
}

export default function Contacts({ store }) {
  const { contacts, companies, deals, activities } = store.data
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState('note')

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags || []))].sort(), [contacts])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = contacts.filter((c) => {
      if (companyFilter !== 'all' && c.companyId !== companyFilter) return false
      if (tagFilter !== 'all' && !(c.tags || []).includes(tagFilter)) return false
      if (!q) return true
      const company = store.companyById[c.companyId]?.name || ''
      return (c.name + ' ' + c.email + ' ' + c.title + ' ' + company).toLowerCase().includes(q)
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      const get = (x) =>
        sort.key === 'company' ? store.companyById[x.companyId]?.name || '' : String(x[sort.key] || '')
      return get(a).localeCompare(get(b)) * dir
    })
    return list
  }, [contacts, search, companyFilter, tagFilter, sort, store.companyById])

  const selected = contacts.find((c) => c.id === selectedId) || null
  const selectedDeals = selected ? deals.filter((d) => d.contactId === selected.id) : []
  const selectedActivity = selected
    ? activities
        .filter((a) => a.contactId === selected.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    : []

  function openNew() {
    setForm(empty)
    setErrors({})
    setEditing('new')
  }

  function openEdit(c) {
    setForm({ ...c, companyId: c.companyId || '', tags: (c.tags || []).join(', ') })
    setErrors({})
    setEditing(c.id)
  }

  function submit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    store.saveContact({
      ...(editing === 'new' ? {} : { id: editing }),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      title: form.title.trim(),
      companyId: form.companyId || null,
      owner: form.owner,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    })
    setEditing(null)
  }

  function remove(c) {
    if (window.confirm('Delete ' + c.name + '? Their notes will be removed too.')) {
      store.deleteContact(c.id)
      if (selectedId === c.id) setSelectedId(null)
    }
  }

  function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    store.addActivity({ type: noteType, body: note.trim(), contactId: selected.id })
    setNote('')
  }

  const sortBtn = (key, label) => (
    <button
      type="button"
      className={'th-sort' + (sort.key === key ? ' active' : '')}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
    >
      {label}
      <span aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
    </button>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contacts</h1>
          <p className="muted">
            {contacts.length === 0
              ? 'No contacts yet. Add your first one to start tracking conversations.'
              : rows.length + ' of ' + contacts.length + ' shown'}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={openNew}>
          Add contact
        </button>
      </div>

      <div className="toolbar">
        <div className="field grow">
          <label className="sr-only" htmlFor="contact-search">
            Search contacts
          </label>
          <input
            id="contact-search"
            type="search"
            placeholder="Search by name, email, title or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-company">Company</label>
          <select id="filter-company" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-tag">Tag</label>
          <select id="filter-tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card table-card">
        {contacts.length === 0 ? (
          <Empty
            title="No contacts yet"
            body="Add the people you are selling to. Each one gets a detail panel with their deals and an activity log."
            action={
              <button type="button" className="btn primary" onClick={openNew}>
                Add contact
              </button>
            }
          />
        ) : rows.length === 0 ? (
          <Empty
            title="No contacts match these filters"
            body="Clear the search or pick a different company or tag."
            action={
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSearch('')
                  setCompanyFilter('all')
                  setTagFilter('all')
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{sortBtn('name', 'Name')}</th>
                  <th scope="col">{sortBtn('title', 'Title')}</th>
                  <th scope="col">{sortBtn('company', 'Company')}</th>
                  <th scope="col">Email</th>
                  <th scope="col">Tags</th>
                  <th scope="col">{sortBtn('owner', 'Owner')}</th>
                  <th scope="col" className="right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(c.id)
                      }
                    }}
                    tabIndex={0}
                    aria-label={'Open details for ' + c.name}
                    className="clickable"
                  >
                    <td>
                      <span className="cell-name">
                        <span className="avatar sm" aria-hidden="true">
                          {initials(c.name)}
                        </span>
                        {c.name}
                      </span>
                    </td>
                    <td className="muted">{c.title || '—'}</td>
                    <td>{store.companyById[c.companyId]?.name || '—'}</td>
                    <td className="muted">{c.email}</td>
                    <td>
                      {(c.tags || []).length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        c.tags.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="muted">{c.owner}</td>
                    <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn ghost sm" onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button type="button" className="btn ghost sm danger" onClick={() => remove(c)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add contact' : 'Edit contact'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" form="contact-form" className="btn primary">
                {editing === 'new' ? 'Add contact' : 'Save changes'}
              </button>
            </>
          }
        >
          <form id="contact-form" className="form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="c-name">Full name</label>
              <input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="error">{errors.name}</p>}
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c-email">Email</label>
                <input
                  id="c-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="error">{errors.email}</p>}
              </div>
              <div className="field">
                <label htmlFor="c-phone">Phone</label>
                <input
                  id="c-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <p className="error">{errors.phone}</p>}
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c-title">Job title</label>
                <input id="c-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="c-company">Company</label>
                <select
                  id="c-company"
                  value={form.companyId || ''}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                >
                  <option value="">No company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c-owner">Owner</label>
                <select id="c-owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
                  <option>Julian Rivera</option>
                  <option>Alex Chen</option>
                  <option>Morgan Diaz</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-tags">Tags</label>
                <input
                  id="c-tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="champion, enterprise"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Drawer
          title={selected.name}
          subtitle={[selected.title, store.companyById[selected.companyId]?.name].filter(Boolean).join(' · ')}
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
              <dt>Email</dt>
              <dd>
                <a href={'mailto:' + selected.email}>{selected.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{selected.phone || '—'}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{selected.owner}</dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>{fmtDate(selected.createdAt)}</dd>
            </div>
          </dl>

          <h3 className="section-title">Deals ({selectedDeals.length})</h3>
          {selectedDeals.length === 0 ? (
            <Empty title="No deals yet" body="Create a deal on the pipeline board and link it to this contact." />
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

          <h3 className="section-title">Activity</h3>
          <form className="note-box" onSubmit={addNote}>
            <label className="sr-only" htmlFor="note-type">
              Activity type
            </label>
            <select id="note-type" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="note-body">
              Activity note
            </label>
            <textarea
              id="note-body"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={'Log what happened with ' + selected.name.split(' ')[0]}
            />
            <button type="submit" className="btn primary sm" disabled={!note.trim()}>
              Log activity
            </button>
          </form>

          {selectedActivity.length === 0 ? (
            <Empty title="Nothing logged yet" body="Add the first call, email or note above." />
          ) : (
            <ol className="timeline">
              {selectedActivity.map((a) => (
                <li key={a.id}>
                  <span className={'chip type-' + a.type}>{TYPE_LABEL[a.type] || a.type}</span>
                  <p className="feed-text">{a.body}</p>
                  <p className="muted small">{fmtRelative(a.timestamp)}</p>
                </li>
              ))}
            </ol>
          )}
        </Drawer>
      )}
    </>
  )
}
