import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildSeed } from './seed.js'

const KEY = 'pipeline-crm.v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return buildSeed()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.contacts)) return buildSeed()
    return {
      companies: parsed.companies || [],
      contacts: parsed.contacts || [],
      deals: parsed.deals || [],
      activities: parsed.activities || []
    }
  } catch {
    return buildSeed()
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

  const reseed = useCallback(() => {
    if (window.confirm('Replace all current data with the sample dataset?')) setData(buildSeed())
  }, [])

  const lookup = useMemo(() => {
    const companyById = Object.fromEntries(data.companies.map((c) => [c.id, c]))
    const contactById = Object.fromEntries(data.contacts.map((c) => [c.id, c]))
    return { companyById, contactById }
  }, [data.companies, data.contacts])

  return { data, ...api, reseed, ...lookup }
}
