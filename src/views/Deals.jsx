import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import Drawer from '../components/Drawer.jsx'
import Empty from '../components/Empty.jsx'
import { STAGES, fmtDate, fmtMoney, fmtMoneyFull, fmtRelative } from '../format.js'

const TYPE_LABEL = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting' }
const empty = {
  title: '',
  companyId: '',
  contactId: '',
  value: '',
  stage: 'Lead',
  closeDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  owner: 'Julian Rivera',
  notes: ''
}

export default function Deals({ store }) {
  const { deals, companies, contacts, activities } = store.data
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [note, setNote] = useState('')

  const byStage = useMemo(
    () =>
      STAGES.map((stage) => {
        const rows = deals.filter((d) => d.stage === stage)
        return { stage, rows, value: rows.reduce((s, d) => s + d.value, 0) }
      }),
    [deals]
  )

  const selected = deals.find((d) => d.id === selectedId) || null
  const selectedActivity = selected
    ? activities.filter((a) => a.dealId === selected.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    : []

  function openNew(stage) {
    setForm({ ...empty, stage: stage || 'Lead' })
    setErrors({})
    setEditing('new')
  }

  function openEdit(d) {
    setForm({
      ...d,
      companyId: d.companyId || '',
      contactId: d.contactId || '',
      value: String(d.value),
      notes: d.notes || ''
    })
    setErrors({})
    setEditing(d.id)
  }

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.title.trim()) errs.title = 'Give the deal a name.'
    const value = Number(form.value)
    if (form.value === '' || Number.isNaN(value) || value < 0) errs.value = 'Enter the deal value in dollars.'
    if (!form.closeDate) errs.closeDate = 'Pick an expected close date.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    store.saveDeal({
      ...(editing === 'new' ? {} : { id: editing }),
      title: form.title.trim(),
      companyId: form.companyId || null,
      contactId: form.contactId || null,
      value: Math.round(value),
      stage: form.stage,
      closeDate: form.closeDate,
      owner: form.owner,
      notes: form.notes.trim()
    })
    setEditing(null)
  }

  function remove(d) {
    if (window.confirm('Delete the deal “' + d.title + '”?')) {
      store.deleteDeal(d.id)
      setSelectedId(null)
    }
  }

  function drop(stage, transferredId) {
    const id = transferredId || dragId
    if (id && deals.some((d) => d.id === id)) store.moveDeal(id, stage)
    setDragId(null)
    setOverStage(null)
  }

  function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    store.addActivity({ type: 'note', body: note.trim(), dealId: selected.id, contactId: selected.contactId })
    setNote('')
  }

  const contactOptions = form.companyId ? contacts.filter((c) => c.companyId === form.companyId) : contacts

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Deals</h1>
          <p className="muted">
            {deals.length === 0
              ? 'No deals yet. Add one to any stage, then drag cards between columns as they progress.'
              : deals.length +
                (deals.length === 1 ? ' deal on the board. ' : ' deals on the board. ') +
                'Drag a card between columns to change its stage. Changes save automatically.'}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => openNew('Lead')}>
          Add deal
        </button>
      </div>

      <div className="board">
        {byStage.map((col) => (
          <section
            key={col.stage}
            className={'column' + (overStage === col.stage ? ' over' : '')}
            onDragOver={(e) => {
              e.preventDefault()
              setOverStage(col.stage)
            }}
            onDragLeave={() => setOverStage((s) => (s === col.stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              drop(col.stage, e.dataTransfer.getData('text/plain'))
            }}
            aria-label={col.stage + ' stage'}
          >
            <header className="column-head">
              <span className={'stage-dot stage-' + col.stage.toLowerCase()} aria-hidden="true" />
              <h2>{col.stage}</h2>
              <span className="count">{col.rows.length}</span>
              <span className="column-value">{fmtMoney(col.value)}</span>
            </header>
            <div className="column-body">
              {col.rows.length === 0 ? (
                <p className="column-empty">No deals in this stage. Drop a card here or add one below.</p>
              ) : (
                col.rows.map((d) => (
                  <article
                    key={d.id}
                    className={'deal-card' + (dragId === d.id ? ' dragging' : '')}
                    draggable
                    onDragStart={(e) => {
                      setDragId(d.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', d.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverStage(null)
                    }}
                  >
                    <button type="button" className="deal-open" onClick={() => setSelectedId(d.id)}>
                      <span className="deal-title">{d.title}</span>
                      <span className="muted small block">{store.companyById[d.companyId]?.name || 'No company'}</span>
                      <span className="deal-foot">
                        <strong>{fmtMoneyFull(d.value)}</strong>
                        <span className="muted small">{fmtDate(d.closeDate)}</span>
                      </span>
                    </button>
                    <div className="deal-move">
                      <label className="sr-only" htmlFor={'move-' + d.id}>
                        Move {d.title} to another stage
                      </label>
                      <select
                        id={'move-' + d.id}
                        value={d.stage}
                        onChange={(e) => store.moveDeal(d.id, e.target.value)}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))
              )}
              <button type="button" className="column-add" onClick={() => openNew(col.stage)}>
                + Add deal
              </button>
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add deal' : 'Edit deal'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" form="deal-form" className="btn primary">
                {editing === 'new' ? 'Add deal' : 'Save changes'}
              </button>
            </>
          }
        >
          <form id="deal-form" className="form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="d-title">Deal name</label>
              <input
                id="d-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                aria-invalid={!!errors.title}
              />
              {errors.title && <p className="error">{errors.title}</p>}
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="d-company">Company</label>
                <select
                  id="d-company"
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value, contactId: '' })}
                >
                  <option value="">No company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="d-contact">Primary contact</label>
                <select
                  id="d-contact"
                  value={form.contactId}
                  onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                >
                  <option value="">No contact</option>
                  {contactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="d-value">Value (USD)</label>
                <input
                  id="d-value"
                  type="number"
                  min="0"
                  step="500"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  aria-invalid={!!errors.value}
                />
                {errors.value && <p className="error">{errors.value}</p>}
              </div>
              <div className="field">
                <label htmlFor="d-stage">Stage</label>
                <select id="d-stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="d-close">Expected close</label>
                <input
                  id="d-close"
                  type="date"
                  value={form.closeDate}
                  onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
                  aria-invalid={!!errors.closeDate}
                />
                {errors.closeDate && <p className="error">{errors.closeDate}</p>}
              </div>
              <div className="field">
                <label htmlFor="d-owner">Owner</label>
                <select id="d-owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
                  <option>Julian Rivera</option>
                  <option>Alex Chen</option>
                  <option>Morgan Diaz</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="d-notes">Notes</label>
              <textarea
                id="d-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Decision process, blockers, next step"
              />
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Drawer
          title={selected.title}
          subtitle={store.companyById[selected.companyId]?.name || 'No company'}
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
              <dt>Value</dt>
              <dd>{fmtMoneyFull(selected.value)}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>
                <span className={'chip stage-chip-' + selected.stage.toLowerCase()}>{selected.stage}</span>
              </dd>
            </div>
            <div>
              <dt>Expected close</dt>
              <dd>{fmtDate(selected.closeDate)}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{store.contactById[selected.contactId]?.name || '—'}</dd>
            </div>
          </dl>

          {selected.notes && (
            <>
              <h3 className="section-title">Deal notes</h3>
              <p className="feed-text">{selected.notes}</p>
            </>
          )}

          <h3 className="section-title">Activity</h3>
          <form className="note-box" onSubmit={addNote}>
            <label className="sr-only" htmlFor="deal-note">
              Deal note
            </label>
            <textarea
              id="deal-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What moved on this deal?"
            />
            <button type="submit" className="btn primary sm" disabled={!note.trim()}>
              Log note
            </button>
          </form>

          {selectedActivity.length === 0 ? (
            <Empty title="No activity on this deal" body="Log the last call or email so the timeline stays current." />
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
