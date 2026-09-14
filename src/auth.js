/**
 * Browser-only account layer. Accounts and the active session live in
 * localStorage. This is not real security: it keeps each person's CRM data
 * in its own namespace on this device, nothing more.
 */

const ACCOUNTS_KEY = 'crm.accounts.v1'
export const SESSION_KEY = 'crm.session.v1'
export const DATA_KEY_PREFIX = 'pipeline-crm.v2'

export function dataKeyFor(userId) {
  return `${DATA_KEY_PREFIX}.${userId}`
}

function readAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.id && a.email) : []
  } catch {
    return []
  }
}

function writeAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    /* storage blocked; the session still works until reload */
  }
}

function uid() {
  return 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function randomSalt() {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  return toHex(bytes)
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** SHA-256 of salt + password. Falls back to a simple digest when SubtleCrypto
 *  is unavailable (for example on a plain http origin). */
export async function hashPassword(password, salt) {
  const input = `${salt}:${password}`
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input))
    return toHex(new Uint8Array(digest))
  }
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i += 1) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + input.charCodeAt(i) * (i + 1), 2246822519) >>> 0
  }
  return `fallback${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

export function initialsFrom(name, email) {
  const source = (name || '').trim() || (email || '').split('@')[0] || ''
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim())
}

function publicUser(account) {
  if (!account) return null
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    initials: account.initials || initialsFrom(account.name, account.email),
    createdAt: account.createdAt
  }
}

export function listAccounts() {
  return readAccounts().map(publicUser)
}

export function currentUser() {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const account = readAccounts().find((a) => a.id === id)
    if (!account) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return publicUser(account)
  } catch {
    return null
  }
}

function startSession(id) {
  try {
    localStorage.setItem(SESSION_KEY, id)
  } catch {
    /* ignore */
  }
}

export async function signUp({ name, email, password }) {
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase()
  const accounts = readAccounts()
  if (accounts.some((a) => a.email === cleanEmail)) {
    return { ok: false, field: 'email', error: 'That email is already registered. Log in instead.' }
  }
  const salt = randomSalt()
  const account = {
    id: uid(),
    name: cleanName,
    email: cleanEmail,
    salt,
    passwordHash: await hashPassword(password, salt),
    initials: initialsFrom(cleanName, cleanEmail),
    createdAt: new Date().toISOString()
  }
  writeAccounts([...accounts, account])
  startSession(account.id)
  return { ok: true, user: publicUser(account) }
}

export async function logIn({ email, password }) {
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase()
  const account = readAccounts().find((a) => a.email === cleanEmail)
  const wrong = { ok: false, field: 'form', error: 'Wrong email or password.' }
  if (!account) {
    // Hash anyway so a missing account is not obviously faster.
    await hashPassword(password, 'no-account')
    return wrong
  }
  const hash = await hashPassword(password, account.salt)
  if (hash !== account.passwordHash) return wrong
  startSession(account.id)
  return { ok: true, user: publicUser(account) }
}

export function logOut() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function updateProfile(userId, { name, email }) {
  const accounts = readAccounts()
  const account = accounts.find((a) => a.id === userId)
  if (!account) return { ok: false, field: 'form', error: 'That account no longer exists on this device.' }
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase()
  if (accounts.some((a) => a.id !== userId && a.email === cleanEmail)) {
    return { ok: false, field: 'email', error: 'Another account on this device already uses that email.' }
  }
  account.name = cleanName
  account.email = cleanEmail
  account.initials = initialsFrom(cleanName, cleanEmail)
  writeAccounts(accounts)
  return { ok: true, user: publicUser(account) }
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const accounts = readAccounts()
  const account = accounts.find((a) => a.id === userId)
  if (!account) return { ok: false, field: 'form', error: 'That account no longer exists on this device.' }
  const currentHash = await hashPassword(currentPassword, account.salt)
  if (currentHash !== account.passwordHash) {
    return { ok: false, field: 'currentPassword', error: 'That is not your current password.' }
  }
  const salt = randomSalt()
  account.salt = salt
  account.passwordHash = await hashPassword(newPassword, salt)
  writeAccounts(accounts)
  return { ok: true }
}

export function deleteAccount(userId) {
  const accounts = readAccounts()
  if (!accounts.some((a) => a.id === userId)) {
    return { ok: false, field: 'form', error: 'That account no longer exists on this device.' }
  }
  writeAccounts(accounts.filter((a) => a.id !== userId))
  try {
    localStorage.removeItem(dataKeyFor(userId))
  } catch {
    /* ignore */
  }
  logOut()
  return { ok: true }
}
