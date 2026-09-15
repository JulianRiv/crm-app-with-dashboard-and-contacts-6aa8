/**
 * Confirms that what is on disk is what the app is supposed to be running.
 *
 * Files have shown up stale on disk before, which makes a passing build
 * meaningless. This prints size, hash and a required marker for each critical
 * file and exits non-zero if any marker is missing, so a stale copy is loud
 * instead of silent.
 */

import fs from 'node:fs'
import crypto from 'node:crypto'

const CHECKS = [
  ['package.json', '"dev:api": "node scripts/api.mjs"'],
  ['server.js', '| database: ${backend}'],
  ['server.js', 'Number(process.env.API_PORT) || Number(process.env.PORT) || 3001'],
  ['db.js', 'export const usingManagedPostgres'],
  ['vite.config.js', 'http://127.0.0.1:${API_PORT}'],
  ['scripts/api.mjs', "process.env.API_PORT = '3001'"],
  ['src/api.js', '/api'],
  ['src/auth.js', 'export'],
  ['src/store.js', 'export'],
  ['src/App.jsx', 'export default'],
  ['src/views/Auth.jsx', 'export'],
  ['src/views/Settings.jsx', 'export']
]

let failed = 0
const seen = new Set()

for (const [file, marker] of CHECKS) {
  let buf
  try {
    buf = fs.readFileSync(file)
  } catch {
    console.log(`MISSING  ${file}`)
    failed++
    continue
  }
  const text = buf.toString('utf8')
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12)
  if (!seen.has(file)) {
    console.log(`${file}  ${buf.length} bytes  sha256:${hash}`)
    seen.add(file)
  }
  if (!text.includes(marker)) {
    console.log(`  STALE: ${file} is missing marker ${JSON.stringify(marker)}`)
    failed++
  }
}

console.log('')
console.log(`DATABASE_URL present: ${Boolean(process.env.DATABASE_URL)}`)
console.log(`API_PORT: ${JSON.stringify(process.env.API_PORT ?? null)}  PORT: ${JSON.stringify(process.env.PORT ?? null)}`)
console.log(failed === 0 ? 'DISK OK: every critical file matches expectations.' : `DISK STALE: ${failed} problem(s).`)
process.exit(failed === 0 ? 0 : 1)
