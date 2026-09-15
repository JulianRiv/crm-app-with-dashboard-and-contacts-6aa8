/**
 * End-to-end smoke test for the API, over real HTTP against the real server.
 *
 * It boots server.js in a child process on a scratch port with a scratch
 * database directory, waits for the startup line, then exercises the auth and
 * authorization path the way a browser does, carrying the HttpOnly session
 * cookie in a jar:
 *
 *   1. POST /api/auth/signup            -> 201 + Set-Cookie
 *   2. POST /api/contacts   with jar    -> 201
 *   3. GET  /api/contacts   with jar    -> 200 + the contact
 *   4. GET  /api/contacts   no cookie   -> 401
 *   5. GET  /api/contacts   other user  -> 200 + empty (no cross-account read)
 *
 * Exits non-zero on the first failed expectation and prints every status and
 * body verbatim, so the output is the evidence.
 */

import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'

const PORT = Number(process.env.SMOKE_PORT) || 3199
const BASE = `http://127.0.0.1:${PORT}`
const DATA_DIR = '.data/smoke-pglite'

let failures = 0

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}, expected ${expected}`)
}

await rm(DATA_DIR, { recursive: true, force: true }).catch(() => {})

const env = { ...process.env, API_PORT: String(PORT), PGLITE_DIR: DATA_DIR }
delete env.PORT
const child = spawn(process.execPath, ['server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] })

let startupLine = ''
const serverOut = []

function relay(stream, sink) {
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    sink.push(chunk)
    for (const line of String(chunk).split('\n')) {
      if (line.trim()) console.log(`[server] ${line.trim()}`)
      if (line.includes('[api] listening')) startupLine = line.trim()
    }
  })
}
relay(child.stdout, serverOut)
relay(child.stderr, serverOut)

async function waitForListen(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`)
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return await res.json()
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('server did not start listening in time')
}

/** Minimal cookie jar: keeps whatever the server set, sends it back. */
function jar() {
  const store = new Map()
  return {
    capture(res) {
      const raw = res.headers.getSetCookie?.() || []
      for (const cookie of raw) {
        const [pair] = cookie.split(';')
        const eq = pair.indexOf('=')
        if (eq > 0) store.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
      }
      return raw
    },
    header() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    }
  }
}

async function call(method, path, { body, cookies } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookies) headers.Cookie = cookies
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  console.log(`\n$ ${method} ${path}${cookies ? ' (with cookie jar)' : ' (no cookie)'}`)
  console.log(`< HTTP ${res.status}`)
  console.log(`< ${text}`)
  return { res, text, data: (() => { try { return JSON.parse(text) } catch { return null } })() }
}

let code = 1
try {
  const health = await waitForListen()
  console.log('')
  console.log(`STARTUP LINE: ${startupLine || '(not observed)'}`)
  console.log(`HEALTH: ${JSON.stringify(health)}`)
  console.log(`DATABASE_URL present in this environment: ${Boolean(process.env.DATABASE_URL)}`)

  const alice = jar()
  const stamp = Date.now()

  const signup = await call('POST', '/api/auth/signup', {
    body: { name: 'Ada Reyes', email: `ada+${stamp}@example.com`, password: 'pipeline-pass-1' }
  })
  const cookieHeaders = alice.capture(signup.res)
  check('signup status', signup.res.status, 201)
  check('signup set an HttpOnly session cookie', String(cookieHeaders.join(' ')).includes('HttpOnly'), true)

  const created = await call('POST', '/api/contacts', {
    body: { name: 'Mina Okafor', email: 'mina@northwind.example', title: 'VP Revenue' },
    cookies: alice.header()
  })
  check('create contact status', created.res.status, 201)

  const listed = await call('GET', '/api/contacts', { cookies: alice.header() })
  check('list contacts status', listed.res.status, 200)
  check('list contains the new contact', listed.data?.contacts?.[0]?.name, 'Mina Okafor')
  check('list length', listed.data?.contacts?.length, 1)

  const anon = await call('GET', '/api/contacts')
  check('list with no cookie is rejected', anon.res.status, 401)

  const bob = jar()
  const other = await call('POST', '/api/auth/signup', {
    body: { name: 'Sam Doyle', email: `sam+${stamp}@example.com`, password: 'pipeline-pass-2' }
  })
  bob.capture(other.res)
  const bobList = await call('GET', '/api/contacts', { cookies: bob.header() })
  check('second account status', bobList.res.status, 200)
  check("second account cannot see the first account's contacts", bobList.data?.contacts?.length, 0)

  console.log('')
  console.log(failures === 0 ? `SMOKE OK: all checks passed on port ${PORT}.` : `SMOKE FAILED: ${failures} check(s).`)
  code = failures === 0 ? 0 : 1
} catch (err) {
  console.error('')
  console.error(`SMOKE ERROR: ${err.message}`)
  console.error(err.stack)
  code = 1
} finally {
  child.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 300))
  await rm(DATA_DIR, { recursive: true, force: true }).catch(() => {})
}

process.exit(code)
