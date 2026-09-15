/**
 * Pipeline CRM API + production static server.
 *
 * Plain node:http, no framework. Every business route resolves the caller
 * from the session cookie and filters by that user id; a user_id in a request
 * body is always ignored.
 */

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, migrate, usingManagedPostgres } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * One port resolution, used by both halves of the setup:
 *   - local dev: API_PORT is set (3001 by default) and Vite proxies /api there
 *   - deploy:    API_PORT is unset, PORT comes from the host, one origin
 * Vite's proxy target reads the same API_PORT default, so they cannot drift.
 */
const PORT = Number(process.env.API_PORT) || Number(process.env.PORT) || 3001
const DIST = path.join(__dirname, 'dist')

const SESSION_COOKIE = 'crm_session'
const SESSION_DAYS = 30
const SECRET =
  process.env.SESSION_SECRET ||
  'pipeline-crm-development-secret-do-not-use-in-production'

if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET is not set, using the development fallback.')
}

const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

/* ---------------------------------------------------------------- helpers */

class HttpError extends Error {
  constructor(status, message, field) {
    super(message)
    this.status = status
    this.field = field
  }
}

const bad = (message, field) => new HttpError(400, message, field)
const unauthorized = () => new HttpError(401, 'Your session has ended. Log in again to continue.')
const notFound = () => new HttpError(404, 'That record no longer exists.')

function json(res, status, payload) {
  const body = payload === null ? '' : JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    // Generous enough for a full import, small enough to not be a weapon.
    if (size > 8 * 1024 * 1024) throw bad('That request is too large.')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw bad('That request body was not valid JSON.')
  }
}

const str = (v, max = 500) => (v === undefined || v === null ? '' : String(v).slice(0, max).trim())
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const uuid = () => crypto.randomUUID()
const isUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
/** Foreign keys: keep a real id, turn anything else (including '') into null. */
const refId = (v) => (isUuid(v) ? v : null)
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim())
const iso = (v) => (v instanceof Date ? v.toISOString() : v || null)

/* ------------------------------------------------------------------ auth */

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex')
}

function verifyPassword(password, salt, expectedHex) {
  const expected = Buffer.from(String(expectedHex), 'hex')
  let actual
  try {
    actual = crypto.scryptSync(String(password), salt, expected.length || 64)
  } catch {
    return false
  }
  if (expected.length !== actual.length) return false
  return crypto.timingSafeEqual(expected, actual)
}

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url')
}

/** Cookie value is "<sessionId>.<hmac>", so a tampered id is rejected. */
function serializeSession(id) {
  return `${id}.${sign(id)}`
}

function parseSessionCookie(raw) {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const id = raw.slice(0, dot)
  const mac = raw.slice(dot + 1)
  const expected = sign(id)
  if (mac.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
  return id
}

function readCookies(req) {
  const header = req.headers.cookie
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

function setSessionCookie(res, id, req) {
  const secure = isHttps(req) ? ' Secure;' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(serializeSession(id))}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${SESSION_DAYS * 86400}`
  )
}

function clearSessionCookie(res, req) {
  const secure = isHttps(req) ? ' Secure;' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`
  )
}

function isHttps(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  return proto === 'https'
}

async function createSession(userId) {
  const id = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString()
  await db.query('insert into sessions (id, user_id, expires_at) values ($1, $2, $3)', [
    id,
    userId,
    expires
  ])
  return id
}

/** The signed-in user, or null. Sessions live in Postgres, so they survive a
 *  server restart and can be revoked by deleting the row. */
async function currentUser(req) {
  const raw = readCookies(req)[SESSION_COOKIE]
  const id = parseSessionCookie(raw)
  if (!id) return null
  const { rows } = await db.query(
    `select u.id, u.name, u.email, u.created_at
       from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [id]
  )
  if (rows.length === 0) return null
  return { id: rows[0].id, name: rows[0].name, email: rows[0].email, createdAt: iso(rows[0].created_at) }
}

async function requireUser(req) {
  const user = await currentUser(req)
  if (!user) throw unauthorized()
  return user
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: iso(u.createdAt) })

/* --------------------------------------------------------------- mapping */

const mapCompany = (r) => ({
  id: r.id,
  name: r.name,
  domain: r.domain,
  industry: r.industry,
  size: r.size,
  createdAt: iso(r.created_at)
})

const mapContact = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  title: r.title,
  companyId: r.company_id,
  owner: r.owner,
  tags: r.tags,
  createdAt: iso(r.created_at)
})

const mapDeal = (r) => ({
  id: r.id,
  title: r.title,
  companyId: r.company_id,
  contactId: r.contact_id,
  value: Number(r.value) || 0,
  stage: r.stage,
  closeDate: r.close_date,
  notes: r.notes,
  createdAt: iso(r.created_at)
})

const mapActivity = (r) => ({
  id: r.id,
  type: r.type,
  body: r.body,
  contactId: r.contact_id,
  dealId: r.deal_id,
  createdAt: iso(r.created_at),
  // The client has always called this field `timestamp`; keep both names in
  // sync so no view needs to change.
  timestamp: iso(r.created_at)
})

const COLLECTIONS = {
  companies: {
    table: 'companies',
    map: mapCompany,
    columns: ['name', 'domain', 'industry', 'size'],
    fromBody: (b) => ({
      name: str(b.name, 200),
      domain: str(b.domain, 200),
      industry: str(b.industry, 120),
      size: str(b.size, 60)
    }),
    validate: (v) => {
      if (!v.name) throw bad('Enter a company name.', 'name')
    }
  },
  contacts: {
    table: 'contacts',
    map: mapContact,
    columns: ['name', 'email', 'phone', 'title', 'company_id', 'owner', 'tags'],
    fromBody: (b) => ({
      name: str(b.name, 200),
      email: str(b.email, 200).toLowerCase(),
      phone: str(b.phone, 60),
      title: str(b.title, 160),
      company_id: refId(b.companyId),
      owner: str(b.owner, 160),
      tags: Array.isArray(b.tags) ? b.tags.map((t) => str(t, 60)).filter(Boolean).join(', ') : str(b.tags, 300)
    }),
    validate: (v) => {
      if (!v.name) throw bad('Enter a contact name.', 'name')
      if (v.email && !isEmail(v.email)) throw bad('Enter a valid email address.', 'email')
    }
  },
  deals: {
    table: 'deals',
    map: mapDeal,
    columns: ['title', 'company_id', 'contact_id', 'value', 'stage', 'close_date', 'notes'],
    fromBody: (b) => ({
      title: str(b.title, 200),
      company_id: refId(b.companyId),
      contact_id: refId(b.contactId),
      value: Math.max(0, num(b.value)),
      stage: STAGES.includes(b.stage) ? b.stage : 'Lead',
      close_date: str(b.closeDate, 40),
      notes: str(b.notes, 4000)
    }),
    validate: (v) => {
      if (!v.title) throw bad('Enter a deal name.', 'title')
    }
  },
  activities: {
    table: 'activities',
    map: mapActivity,
    columns: ['type', 'body', 'contact_id', 'deal_id'],
    fromBody: (b) => ({
      type: str(b.type, 40) || 'note',
      body: str(b.body ?? b.note ?? b.text, 4000),
      contact_id: refId(b.contactId),
      deal_id: refId(b.dealId)
    }),
    validate: (v) => {
      if (!v.body) throw bad('Enter a note.', 'body')
    }
  }
}

const ORDER = {
  companies: 'lower(name) asc',
  contacts: 'created_at desc',
  deals: 'created_at desc',
  activities: 'created_at desc'
}

/* ------------------------------------------------------- record accessors */

async function listAll(userId, name) {
  const c = COLLECTIONS[name]
  const { rows } = await db.query(
    `select * from ${c.table} where user_id = $1 order by ${ORDER[name]}`,
    [userId]
  )
  return rows.map(c.map)
}

/**
 * Referenced rows must belong to the caller too, otherwise a crafted body
 * could link one account's deal to another account's company.
 */
async function assertOwnedRefs(userId, values) {
  const checks = [
    ['companies', values.company_id],
    ['contacts', values.contact_id],
    ['deals', values.deal_id]
  ]
  for (const [table, id] of checks) {
    if (!id) continue
    const { rows } = await db.query(`select 1 from ${table} where id = $1 and user_id = $2`, [id, userId])
    if (rows.length === 0) throw bad('That linked record does not exist in your account.')
  }
}

async function createRecord(userId, name, body) {
  const c = COLLECTIONS[name]
  const values = c.fromBody(body || {})
  c.validate(values)
  await assertOwnedRefs(userId, values)
  const cols = ['id', 'user_id', ...c.columns]
  const params = [uuid(), userId, ...c.columns.map((col) => values[col])]
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await db.query(
    `insert into ${c.table} (${cols.join(', ')}) values (${placeholders}) returning *`,
    params
  )
  return c.map(rows[0])
}

async function updateRecord(userId, name, id, body) {
  const c = COLLECTIONS[name]
  if (!isUuid(id)) throw notFound()
  const { rows: existing } = await db.query(
    `select * from ${c.table} where id = $1 and user_id = $2`,
    [id, userId]
  )
  if (existing.length === 0) throw notFound()

  // PATCH semantics: only columns actually present in the body change, and
  // validation runs against the row as it will look after the merge, so a
  // partial update (a kanban drag sending just `stage`) is never rejected for
  // fields it did not touch.
  const present = c.columns.filter((col) => bodyMentions(name, body, col))
  if (present.length === 0) return c.map(existing[0])
  const merged = c.fromBody({ ...c.map(existing[0]), ...body })
  c.validate(merged)
  await assertOwnedRefs(userId, merged)

  const sets = present.map((col, i) => `${col} = $${i + 1}`).join(', ')
  const params = [...present.map((col) => merged[col]), id, userId]
  const { rows } = await db.query(
    `update ${c.table} set ${sets} where id = $${present.length + 1} and user_id = $${present.length + 2} returning *`,
    params
  )
  if (rows.length === 0) throw notFound()
  return c.map(rows[0])
}

const BODY_KEYS = {
  company_id: 'companyId',
  contact_id: 'contactId',
  deal_id: 'dealId',
  close_date: 'closeDate'
}

function bodyMentions(_name, body, column) {
  if (!body) return false
  const key = BODY_KEYS[column] || column
  return Object.prototype.hasOwnProperty.call(body, key)
}

async function deleteRecord(userId, name, id) {
  const c = COLLECTIONS[name]
  if (!isUuid(id)) throw notFound()
  const { rows } = await db.query(
    `delete from ${c.table} where id = $1 and user_id = $2 returning id`,
    [id, userId]
  )
  if (rows.length === 0) throw notFound()
  return { ok: true }
}

async function allRecords(userId) {
  const [companies, contacts, deals, activities] = await Promise.all([
    listAll(userId, 'companies'),
    listAll(userId, 'contacts'),
    listAll(userId, 'deals'),
    listAll(userId, 'activities')
  ])
  return { companies, contacts, deals, activities }
}

/**
 * Replace this account's records with an imported set. Old client ids are
 * remapped to fresh uuids while the relationships between rows are preserved.
 * Only this user's rows are touched.
 */
async function importRecords(userId, records) {
  const src = records && typeof records === 'object' ? records : {}
  const pick = (k) => (Array.isArray(src[k]) ? src[k] : [])

  // Children first, so no foreign key is left dangling mid-import.
  for (const table of ['activities', 'deals', 'contacts', 'companies']) {
    await db.query(`delete from ${table} where user_id = $1`, [userId])
  }

  const companyIds = new Map()
  for (const row of pick('companies')) {
    const values = COLLECTIONS.companies.fromBody(row)
    if (!values.name) continue
    const id = uuid()
    companyIds.set(String(row.id ?? id), id)
    await db.query(
      `insert into companies (id, user_id, name, domain, industry, size) values ($1,$2,$3,$4,$5,$6)`,
      [id, userId, values.name, values.domain, values.industry, values.size]
    )
  }

  const contactIds = new Map()
  for (const row of pick('contacts')) {
    const values = COLLECTIONS.contacts.fromBody(row)
    if (!values.name) continue
    const id = uuid()
    contactIds.set(String(row.id ?? id), id)
    await db.query(
      `insert into contacts (id, user_id, name, email, phone, title, company_id, owner, tags)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        userId,
        values.name,
        values.email,
        values.phone,
        values.title,
        companyIds.get(String(row.companyId)) || null,
        values.owner,
        values.tags
      ]
    )
  }

  const dealIds = new Map()
  for (const row of pick('deals')) {
    const values = COLLECTIONS.deals.fromBody(row)
    if (!values.title) continue
    const id = uuid()
    dealIds.set(String(row.id ?? id), id)
    await db.query(
      `insert into deals (id, user_id, title, company_id, contact_id, value, stage, close_date, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        userId,
        values.title,
        companyIds.get(String(row.companyId)) || null,
        contactIds.get(String(row.contactId)) || null,
        values.value,
        values.stage,
        values.close_date,
        values.notes
      ]
    )
  }

  for (const row of pick('activities')) {
    const values = COLLECTIONS.activities.fromBody(row)
    if (!values.body) continue
    await db.query(
      `insert into activities (id, user_id, type, body, contact_id, deal_id) values ($1,$2,$3,$4,$5,$6)`,
      [
        uuid(),
        userId,
        values.type,
        values.body,
        contactIds.get(String(row.contactId)) || null,
        dealIds.get(String(row.dealId)) || null
      ]
    )
  }

  return allRecords(userId)
}

/* ---------------------------------------------------------------- routes */

async function api(req, res, url) {
  const route = url.pathname.replace(/^\/api/, '') || '/'
  const method = req.method || 'GET'
  const segments = route.split('/').filter(Boolean)

  /* ---- auth ---- */

  if (route === '/auth/signup' && method === 'POST') {
    const body = await readJson(req)
    const name = str(body.name, 120)
    const email = str(body.email, 200).toLowerCase()
    const password = String(body.password || '')
    if (!name) throw bad('Enter your name.', 'name')
    if (!isEmail(email)) throw bad('Enter a valid email address, like you@company.com.', 'email')
    if (password.length < 8) throw bad('Use at least 8 characters.', 'password')

    const { rows: taken } = await db.query('select 1 from users where lower(email) = $1', [email])
    if (taken.length > 0) throw bad('That email is already registered. Log in instead.', 'email')

    const salt = crypto.randomBytes(16).toString('hex')
    const id = uuid()
    const { rows } = await db.query(
      `insert into users (id, name, email, password_hash, password_salt)
       values ($1,$2,$3,$4,$5) returning id, name, email, created_at`,
      [id, name, email, hashPassword(password, salt), salt]
    )
    const sessionId = await createSession(rows[0].id)
    setSessionCookie(res, sessionId, req)
    return json(res, 201, { user: publicUser({ ...rows[0], createdAt: rows[0].created_at }) })
  }

  if (route === '/auth/login' && method === 'POST') {
    const body = await readJson(req)
    const email = str(body.email, 200).toLowerCase()
    const password = String(body.password || '')
    const { rows } = await db.query(
      'select id, name, email, password_hash, password_salt, created_at from users where lower(email) = $1',
      [email]
    )
    const wrong = new HttpError(400, 'Wrong email or password.', 'form')
    if (rows.length === 0) {
      // Spend comparable time so a missing account is not obviously faster.
      hashPassword(password, 'no-such-account-salt')
      throw wrong
    }
    const account = rows[0]
    if (!verifyPassword(password, account.password_salt, account.password_hash)) throw wrong
    const sessionId = await createSession(account.id)
    setSessionCookie(res, sessionId, req)
    return json(res, 200, { user: publicUser({ ...account, createdAt: account.created_at }) })
  }

  if (route === '/auth/logout' && method === 'POST') {
    const id = parseSessionCookie(readCookies(req)[SESSION_COOKIE])
    if (id) await db.query('delete from sessions where id = $1', [id])
    clearSessionCookie(res, req)
    return json(res, 200, { ok: true })
  }

  if (route === '/auth/me' && method === 'GET') {
    const user = await requireUser(req)
    return json(res, 200, { user: publicUser(user) })
  }

  /* ---- account ---- */

  if (route === '/account' && method === 'PATCH') {
    const user = await requireUser(req)
    const body = await readJson(req)
    const name = str(body.name, 120)
    const email = str(body.email, 200).toLowerCase()
    if (!name) throw bad('Enter your name.', 'name')
    if (!isEmail(email)) throw bad('Enter a valid email address, like you@company.com.', 'email')
    const { rows: clash } = await db.query(
      'select 1 from users where lower(email) = $1 and id <> $2',
      [email, user.id]
    )
    if (clash.length > 0) throw bad('Another account already uses that email.', 'email')
    const { rows } = await db.query(
      'update users set name = $1, email = $2 where id = $3 returning id, name, email, created_at',
      [name, email, user.id]
    )
    return json(res, 200, { user: publicUser({ ...rows[0], createdAt: rows[0].created_at }) })
  }

  if (route === '/account/password' && method === 'POST') {
    const user = await requireUser(req)
    const body = await readJson(req)
    const newPassword = String(body.newPassword || '')
    if (newPassword.length < 8) throw bad('Use at least 8 characters.', 'newPassword')
    const { rows } = await db.query(
      'select password_hash, password_salt from users where id = $1',
      [user.id]
    )
    if (rows.length === 0) throw unauthorized()
    if (!verifyPassword(String(body.currentPassword || ''), rows[0].password_salt, rows[0].password_hash)) {
      throw bad('That is not your current password.', 'currentPassword')
    }
    const salt = crypto.randomBytes(16).toString('hex')
    await db.query('update users set password_hash = $1, password_salt = $2 where id = $3', [
      hashPassword(newPassword, salt),
      salt,
      user.id
    ])
    // Changing the password ends every other session for this account.
    const keep = parseSessionCookie(readCookies(req)[SESSION_COOKIE])
    await db.query('delete from sessions where user_id = $1 and id <> $2', [user.id, keep || ''])
    return json(res, 200, { ok: true })
  }

  if (route === '/account' && method === 'DELETE') {
    const user = await requireUser(req)
    // Business rows and sessions cascade from users.id.
    await db.query('delete from users where id = $1', [user.id])
    clearSessionCookie(res, req)
    return json(res, 200, { ok: true })
  }

  if (route === '/account/export' && method === 'GET') {
    const user = await requireUser(req)
    return json(res, 200, {
      format: 'pipeline-crm-export',
      version: 3,
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email },
      records: await allRecords(user.id)
    })
  }

  if (route === '/account/import' && method === 'POST') {
    const user = await requireUser(req)
    const body = await readJson(req)
    const records = body && body.records && typeof body.records === 'object' ? body.records : body
    const names = ['companies', 'contacts', 'deals', 'activities']
    if (!records || typeof records !== 'object' || !names.some((n) => Array.isArray(records[n]))) {
      throw bad('That file is not a Pipeline CRM export. Nothing was changed.')
    }
    return json(res, 200, { records: await importRecords(user.id, records) })
  }

  /* ---- records ---- */

  if (route === '/records' && method === 'GET') {
    const user = await requireUser(req)
    return json(res, 200, { records: await allRecords(user.id) })
  }

  const name = segments[0]
  if (COLLECTIONS[name]) {
    const user = await requireUser(req)
    const id = segments[1]
    if (!id && method === 'GET') return json(res, 200, { [name]: await listAll(user.id, name) })
    if (!id && method === 'POST') return json(res, 201, await createRecord(user.id, name, await readJson(req)))
    if (id && (method === 'PATCH' || method === 'PUT')) {
      return json(res, 200, await updateRecord(user.id, name, id, await readJson(req)))
    }
    if (id && method === 'DELETE') return json(res, 200, await deleteRecord(user.id, name, id))
    throw new HttpError(405, 'That method is not allowed on this route.')
  }

  if (route === '/health' && method === 'GET') {
    return json(res, 200, { ok: true, database: db.kind, managed: usingManagedPostgres })
  }

  throw new HttpError(404, 'No such API route.')
}

/* -------------------------------------------------------- static serving */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
}

async function serveStatic(req, res, url) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('The client has not been built yet. Run "npm run build".')
    return
  }

  const requested = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(DIST, requested)
  if (!filePath.startsWith(DIST)) filePath = path.join(DIST, 'index.html')

  let stat = await fsp.stat(filePath).catch(() => null)
  if (stat && stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html')
    stat = await fsp.stat(filePath).catch(() => null)
  }
  // SPA fallback: unknown paths render the app, which routes client-side.
  if (!stat) {
    filePath = path.join(DIST, 'index.html')
    stat = await fsp.stat(filePath).catch(() => null)
    if (!stat) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
  }

  const ext = path.extname(filePath).toLowerCase()
  const immutable = filePath.includes(`${path.sep}assets${path.sep}`)
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
  })
  fs.createReadStream(filePath).pipe(res)
}

/* ----------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await api(req, res, url)
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Method not allowed')
      return
    }
    await serveStatic(req, res, url)
  } catch (err) {
    if (res.headersSent) {
      res.end()
      return
    }
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message, field: err.field })
      return
    }
    console.error('[api] unhandled error:', err)
    json(res, 500, { error: 'Something went wrong on the server. Try again.' })
  }
})

function main() {
  // Listen FIRST, migrate after. Binding the port must never wait on the
  // database: a slow or unreachable Postgres used to mean the process never
  // opened its port at all, so nothing could even reach the health route.
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`[api] port ${PORT} is already in use, so the API did not start`)
    } else {
      console.error('[api] server error:', err)
    }
    process.exit(1)
  })
  server.listen(PORT, '0.0.0.0', () => {
    const backend = usingManagedPostgres
      ? 'managed Postgres (DATABASE_URL is set)'
      : 'embedded Postgres (DATABASE_URL is not set)'
    console.log(`[api] listening on http://0.0.0.0:${PORT} | database: ${backend}`)

    migrate()
      .then(() => {
        console.log(`[api] ready | database engine: ${db.kind}`)
      })
      .catch((err) => {
        // The UI boots and shows its error state instead of a blank page, and
        // the next request retries the connection.
        console.error(`[db] schema bootstrap failed: ${err.message}`)
        console.error('[db] the API will keep serving and retry on the next request')
      })
  })
}

main()
