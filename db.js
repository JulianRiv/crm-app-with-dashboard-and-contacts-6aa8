/**
 * Database access for the CRM API.
 *
 * The engine is chosen from the environment, never hardcoded:
 *   - DATABASE_URL set   -> managed Postgres over "pg"
 *   - DATABASE_URL unset -> embedded PGlite Postgres, so the app still boots
 *                           and works locally with a real SQL database
 *
 * Both paths expose the same `db.query(sql, params)` returning { rows }, and
 * both speak the same $1 placeholder syntax, so no route needs to know which
 * one is live. No credentials appear in this file.
 */

const connectionString = process.env.DATABASE_URL || ''

let impl = null
let ready = null

export const usingManagedPostgres = Boolean(connectionString)

function needsSsl(url) {
  if (/sslmode=disable/i.test(url)) return false
  if (/sslmode=/i.test(url)) return true
  // Hosted providers require TLS; a local socket or localhost does not.
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url)
}

async function initManaged() {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    max: 8,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  })
  pool.on('error', (err) => {
    console.error('[db] idle client error:', err.message)
  })
  await pool.query('select 1')
  console.log('[db] connected to managed Postgres from DATABASE_URL')
  return {
    kind: 'postgres',
    query: (sql, params) => pool.query(sql, params)
  }
}

function wrapPglite(client, kind) {
  return {
    kind,
    query: async (sql, params) => {
      const res = await client.query(sql, params)
      return { rows: res.rows || [], rowCount: (res.rows || []).length }
    }
  }
}

async function initEmbedded() {
  const { PGlite } = await import('@electric-sql/pglite')
  const dataDir = process.env.PGLITE_DIR || '.data/pglite'
  try {
    const client = new PGlite(dataDir)
    await client.query('select 1')
    console.log(`[db] DATABASE_URL is not set, using embedded Postgres at ${dataDir}`)
    return wrapPglite(client, 'pglite')
  } catch (err) {
    // A sandbox that cannot give us a writable data directory must not take
    // the whole API down: fall back to an in-memory database so every route
    // still works for this process lifetime.
    console.error(`[db] embedded Postgres could not open ${dataDir}: ${err.message}`)
    const client = new PGlite('memory://')
    await client.query('select 1')
    console.log('[db] using in-memory Postgres, data lasts only until restart')
    return wrapPglite(client, 'pglite-memory')
  }
}

async function connect() {
  if (connectionString) {
    try {
      return await initManaged()
    } catch (err) {
      console.error(`[db] could not connect with DATABASE_URL: ${err.message}`)
      console.error('[db] falling back to embedded Postgres so the app still serves')
      return initEmbedded()
    }
  }
  console.warn('[db] DATABASE_URL is not set. Set it to use a managed Postgres instance.')
  return initEmbedded()
}

/** Resolves once the engine is up. Safe to call repeatedly. */
export function dbReady() {
  if (!ready) {
    ready = connect().then((next) => {
      impl = next
      return next
    })
  }
  return ready
}

export const db = {
  async query(sql, params) {
    const engine = impl || (await dbReady())
    return engine.query(sql, params)
  },
  get kind() {
    return impl ? impl.kind : 'connecting'
  }
}

const SCHEMA = [
  `create table if not exists users (
     id uuid primary key,
     name text not null default '',
     email text not null,
     password_hash text not null,
     password_salt text not null,
     created_at timestamptz not null default now()
   )`,
  // Email uniqueness is enforced on the lowercased value, so Ada@x.com and
  // ada@x.com can never both be registered.
  `create unique index if not exists users_email_key on users (lower(email))`,
  `create table if not exists sessions (
     id text primary key,
     user_id uuid not null references users(id) on delete cascade,
     created_at timestamptz not null default now(),
     expires_at timestamptz not null
   )`,
  `create index if not exists sessions_user_id_idx on sessions (user_id)`,
  `create table if not exists companies (
     id uuid primary key,
     user_id uuid not null references users(id) on delete cascade,
     name text not null default '',
     domain text not null default '',
     industry text not null default '',
     size text not null default '',
     created_at timestamptz not null default now()
   )`,
  `create index if not exists companies_user_id_idx on companies (user_id)`,
  `create table if not exists contacts (
     id uuid primary key,
     user_id uuid not null references users(id) on delete cascade,
     name text not null default '',
     email text not null default '',
     phone text not null default '',
     title text not null default '',
     company_id uuid references companies(id) on delete set null,
     owner text not null default '',
     tags text not null default '',
     created_at timestamptz not null default now()
   )`,
  `create index if not exists contacts_user_id_idx on contacts (user_id)`,
  `create table if not exists deals (
     id uuid primary key,
     user_id uuid not null references users(id) on delete cascade,
     title text not null default '',
     company_id uuid references companies(id) on delete set null,
     contact_id uuid references contacts(id) on delete set null,
     value numeric not null default 0,
     stage text not null default 'Lead',
     close_date text not null default '',
     notes text not null default '',
     created_at timestamptz not null default now()
   )`,
  `create index if not exists deals_user_id_idx on deals (user_id)`,
  `create table if not exists activities (
     id uuid primary key,
     user_id uuid not null references users(id) on delete cascade,
     type text not null default 'note',
     body text not null default '',
     contact_id uuid references contacts(id) on delete cascade,
     deal_id uuid references deals(id) on delete cascade,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists activities_user_id_idx on activities (user_id)`
]

/**
 * Idempotent migration: every statement is CREATE ... IF NOT EXISTS, so it is
 * safe to run on every boot, against an empty database or an existing one.
 */
export async function migrate() {
  await dbReady()
  for (const statement of SCHEMA) {
    await db.query(statement)
  }
  await db.query('delete from sessions where expires_at < now()')
  console.log('[db] schema ready')
}
