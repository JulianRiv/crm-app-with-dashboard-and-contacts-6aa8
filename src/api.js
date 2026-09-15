/**
 * Thin fetch wrapper for the CRM API.
 *
 * Every call is same-origin and relative ("/api/..."), so the identical code
 * works behind the Vite dev proxy and in production where the node server
 * serves the built client itself. credentials:'include' keeps the HttpOnly
 * session cookie attached.
 */

const BASE = '/api'

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.field = field
  }
}

async function request(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch {
    throw new ApiError(
      'The server did not respond, so nothing was saved. Your existing records are untouched. Check your connection and try again.',
      0
    )
  }

  if (res.status === 204) return null

  const text = await res.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    // When the API process is down, the dev proxy (and most reverse proxies)
    // answer with an HTML gateway error rather than our JSON envelope. That
    // used to surface as a vague "could not complete that request", which
    // sent people looking for a bug in the record they just saved. Detect the
    // gateway case by its missing JSON body and name the real cause.
    const gateway = !payload && (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504)
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      (res.status === 401
        ? 'Your session has ended. Log in again to continue.'
        : res.status === 404
          ? 'That record no longer exists.'
          : gateway
            ? 'The API is not reachable right now, so nothing was saved. Your data is safe on the server; retry in a moment.'
            : 'The server could not complete that request.')
    throw new ApiError(message, res.status, payload && payload.field)
  }

  return payload
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body === undefined ? {} : body),
  patch: (path, body) => request('PATCH', path, body === undefined ? {} : body),
  del: (path) => request('DELETE', path)
}
