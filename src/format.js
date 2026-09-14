export const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
export const OPEN_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation']

export function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return '$0'
  if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M'
  if (Math.abs(n) >= 1000) return '$' + Math.round(n / 1000) + 'k'
  return '$' + n
}

export function fmtMoneyFull(n) {
  return '$' + Number(n || 0).toLocaleString('en-US')
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtRelative(iso) {
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hours = Math.round(mins / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.round(hours / 24)
  if (days < 30) return days + 'd ago'
  return fmtDate(iso)
}

export function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}
