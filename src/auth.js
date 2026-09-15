/**
 * Account layer, server-backed.
 *
 * Accounts live in Postgres and the session is a signed HttpOnly cookie the
 * browser cannot read, so there is no password hashing and no session state
 * in this file: every answer comes from the API.
 */

import { api, ApiError } from './api.js'

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

function withInitials(user) {
  if (!user) return null
  return { ...user, initials: user.initials || initialsFrom(user.name, user.email) }
}

/** Shape every failure the same way the views already expect. */
function failure(err, fallbackField) {
  if (err instanceof ApiError) {
    return { ok: false, field: err.field || fallbackField || 'form', error: err.message }
  }
  return { ok: false, field: 'form', error: 'Something went wrong. Try again.' }
}

/**
 * Who is signed in, according to the server. Called once on boot.
 * `ok:true` with `user:null` means "reachable, nobody signed in", which is
 * different from an unreachable API and is rendered differently.
 */
export async function fetchSession() {
  try {
    const payload = await api.get('/auth/me')
    return { ok: true, user: withInitials(payload && payload.user) }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { ok: true, user: null }
    return {
      ok: false,
      user: null,
      error:
        err instanceof ApiError && err.message
          ? err.message
          : 'The server did not respond. Check your connection and try again.'
    }
  }
}

export async function signUp({ name, email, password }) {
  try {
    const payload = await api.post('/auth/signup', { name, email, password })
    return { ok: true, user: withInitials(payload && payload.user) }
  } catch (err) {
    return failure(err, 'email')
  }
}

export async function logIn({ email, password }) {
  try {
    const payload = await api.post('/auth/login', { email, password })
    return { ok: true, user: withInitials(payload && payload.user) }
  } catch (err) {
    return failure(err)
  }
}

/** Ends the session server-side and clears the cookie. Records are kept. */
export async function logOut() {
  try {
    await api.post('/auth/logout')
    return { ok: true }
  } catch {
    // The local session state is already cleared by the caller; a failed
    // logout call must not trap the person in the app.
    return { ok: true }
  }
}

export async function updateProfile(_userId, { name, email }) {
  try {
    const payload = await api.patch('/account', { name, email })
    return { ok: true, user: withInitials(payload && payload.user) }
  } catch (err) {
    return failure(err, 'email')
  }
}

export async function changePassword(_userId, { currentPassword, newPassword }) {
  try {
    await api.post('/account/password', { currentPassword, newPassword })
    return { ok: true }
  } catch (err) {
    return failure(err, 'currentPassword')
  }
}

export async function deleteAccount() {
  try {
    await api.del('/account')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/** Download this account's records as JSON, straight from the database. */
export async function exportAccountData() {
  try {
    const payload = await api.get('/account/export')
    return { ok: true, payload }
  } catch (err) {
    return failure(err)
  }
}
