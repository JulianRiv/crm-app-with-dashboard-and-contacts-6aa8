import { useCallback, useEffect, useMemo, useState } from 'react'

const KEY = 'pipeline-crm.v2'

const EMPTY = { companies: [], contacts: [], deals: [], activities: [] }

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY }
    return {
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      deals: Array.isArray(parsed.deals) ? parsed.deals : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : []
    }
  } catch {
    return { ...EMPTY }
  }
}

function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9)
}

export function useStore() {
  const [data, setData] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage full or blocked; state still works in memory */
    }
  }, [data])

  const api = useMemo(() => {
    const upsert = (key, prefix) => (item) => {
      setData((d) => {
        if (item.id) {
          return { ...d, [key]: d[key].map((x) => (x.id === item.id ? { ...x, ...item } : x)) }
        }
        return { ...d, [key]: [{ ...item, id: uid(prefix), createdAt: new Date().toISOString() }, ...d[key]] }
      })
    }
    return {
      saveContact: upsert('contacts', 'ct'),
      saveCompany: upsert('companies', 'co'),
      saveDeal: upsert('deals', 'dl'),
      deleteContact: (id) =>
        setData((d) => ({
          ...d,
          contacts: d.contacts.filter((c) => c.id !== id),
          deals: d.deals.map((x) => (x.contactId === id ? { ...x, contactId: null } : x)),
          activities: d.activities.filter((a) => a.contactId !== id || a.dealId)
        })),
      deleteDeal: (id) =>
        setData((d) => ({
          ...d,
          deals: d.deals.filter((x) => x.id !== id),
          activities: d.activities.filter((a) => a.dealId !== id)
        })),
      deleteCompany: (id) =>
        setData((d) => ({
          ...d,
          companies: d.companies.filter((x) => x.id !== id),
          contacts: d.contacts.map((c) => (c.companyId === id ? { ...c, companyId: null } : c)),
          deals: d.deals.map((x) => (x.companyId === id ? { ...x, companyId: null } : x))
        })),
      moveDeal: (id, stage) =>
        setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === id ? { ...x, stage } : x)) })),
      addActivity: (a) =>
        setData((d) => ({
          ...d,
          activities: [
            { id: uid('ac'), timestamp: new Date().toISOString(), dealId: null, contactId: null, ...a },
            ...d.activities
          ]
        }))
    }
  }, [])

  const clearAll = useCallback(() => {
    if (window.confirm('Delete every contact, company, deal and note? This cannot be undone.')) {
      setData({ ...EMPTY })
    }
  }, [])

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

  return { data, ...api, clearAll, isEmpty, ...lookup }
}
