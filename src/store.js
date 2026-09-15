import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './api.js'

export const COLLECTIONS = ['companies', 'contacts', 'deals', 'activities']

const EMPTY = Object.freeze({
  companies: Object.freeze([]),
  contacts: Object.freeze([]),
  deals: Object.freeze([]),
  activities: Object.freeze([])
})

function emptyData() {
  return { companies: [], contacts: [], deals: [], activities: [] }
}

/** Accept any shape, keep only well-formed collections. Used for imports. */
export function normalizeData(parsed) {
  const out = emptyData()
  if (!parsed || typeof parsed !== 'object') return out
  for (const name of COLLECTIONS) {
    const list = parsed[name]
    if (Array.isArray(list)) out[name] = list.filter((row) => row && typeof row === 'object')
  }
  return out
}

const ENDPOINT = {
  companies: '/companies',
  contacts: '/contacts',
  deals: '/deals',
  activities: '/activities'
}

/**
 * Every contact, company, deal and note lives in Postgres, scoped to the
 * signed-in user by the session cookie. This hook is the single place the
 * client talks to those routes; views keep calling the same methods they
 * always did and never see a fetch.
 */
export function useStore(userId) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [unauthorized, setUnauthorized] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const handleFailure = useCallback((err, fallback) => {
    if (err instanceof ApiError && err.status === 401) {
      setUnauthorized(true)
      return
    }
    setError(err instanceof ApiError ? err.message : fallback)
  }, [])

  const load = useCallback(
    async (opts) => {
      const quiet = opts && opts.quiet
      if (!quiet) setLoading(true)
      try {
        const payload = await api.get('/records')
        if (!alive.current) return
        setData(normalizeData(payload && payload.records))
        setError('')
      } catch (err) {
        if (!alive.current) return
        handleFailure(err, 'Your records could not be loaded. Check your connection and try again.')
      } finally {
        if (alive.current && !quiet) setLoading(false)
      }
    },
    [handleFailure]
  )

  // Refetch whenever the signed-in account changes: no account can ever be
  // shown another account's rows out of a stale cache.
  useEffect(() => {
    if (!userId) {
      setData(EMPTY)
      setLoading(false)
      return
    }
    load()
  }, [userId, load])

  /**
   * Run one write against the API. The server's response is the source of
   * truth: on success we fold the returned row into state (or refetch when
   * the write also touched related rows), and on failure nothing is changed
   * locally, so the UI never shows a record the database does not hold.
   */
  const mutate = useCallback(
    async (fn, fallbackMessage) => {
      setSaving(true)
      setError('')
      try {
        await fn()
      } catch (err) {
        handleFailure(err, fallbackMessage)
        // Pull the server's real state back so a failed write cannot leave
        // the table showing something that was never saved.
        await load({ quiet: true })
      } finally {
        if (alive.current) setSaving(false)
      }
    },
    [handleFailure, load]
  )

  const api_ = useMemo(() => {
    const upsert = (collection, label) => (item) =>
      mutate(async () => {
        const path = ENDPOINT[collection]
        const saved = item && item.id
          ? await api.patch(`${path}/${encodeURIComponent(item.id)}`, item)
          : await api.post(path, item)
        if (!alive.current || !saved) return
        setData((d) => ({
          ...d,
          [collection]:
            item && item.id
              ? d[collection].map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...d[collection]]
        }))
      }, `That ${label} could not be saved. Nothing was changed on the server.`)

    const remove = (collection, label) => (id) =>
      mutate(async () => {
        await api.del(`${ENDPOINT[collection]}/${encodeURIComponent(id)}`)
        // Deleting detaches related rows server-side, so reload the set
        // rather than guessing what the database did.
        await load({ quiet: true })
      }, `That ${label} could not be deleted. It is still on the server.`)

    return {
      saveContact: upsert('contacts', 'contact'),
      saveCompany: upsert('companies', 'company'),
      saveDeal: upsert('deals', 'deal'),
      deleteContact: remove('contacts', 'contact'),
      deleteCompany: remove('companies', 'company'),
      deleteDeal: remove('deals', 'deal'),
      moveDeal: (id, stage) =>
        mutate(async () => {
          // Optimistic: the card follows the pointer immediately, and a
          // failed request restores the previous stage via the reload in
          // mutate's catch.
          setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === id ? { ...x, stage } : x)) }))
          const saved = await api.patch(`/deals/${encodeURIComponent(id)}`, { stage })
          if (!alive.current || !saved) return
          setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === saved.id ? saved : x)) }))
        }, 'That deal could not be moved. The board has been reloaded from the server.'),
      addActivity: (a) =>
        mutate(async () => {
          const saved = await api.post('/activities', a)
          if (!alive.current || !saved) return
          setData((d) => ({ ...d, activities: [saved, ...d.activities] }))
        }, 'That note could not be saved. Nothing was added.'),
      replaceAll: (next) =>
        mutate(async () => {
          const payload = await api.post('/account/import', { records: normalizeData(next) })
          if (!alive.current) return
          setData(normalizeData(payload && payload.records))
        }, 'The import failed, so your records were left as they were.')
    }
  }, [mutate, load])

  const clearAll = useCallback(() => {
    if (
      !window.confirm('Delete every contact, company, deal and note in this account? This cannot be undone.')
    )
      return
    api_.replaceAll(emptyData())
  }, [api_])

  const lookup = useMemo(() => {
    const companyById = Object.fromEntries(data.companies.map((c) => [c.id, c]))
    const contactById = Object.fromEntries(data.contacts.map((c) => [c.id, c]))
    return { companyById, contactById }
  }, [data.companies, data.contacts])

  const isEmpty =
    data.companies.length === 0 &&
    data.contacts.length === 0 &&
    data.deals.length === 0 &&
    data.activities.length === 0

  return {
    data,
    ...api_,
    clearAll,
    isEmpty,
    loading,
    saving,
    error,
    unauthorized,
    reload: () => load(),
    dismissError: () => setError(''),
    ...lookup
  }
}
