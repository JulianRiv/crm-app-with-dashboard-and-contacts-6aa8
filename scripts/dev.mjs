/**
 * Runs both halves of the app for local development:
 *   - the API on API_PORT (default 3001)
 *   - Vite on 5173, proxying /api to the API
 *
 * The API is supervised: if it exits it is restarted with a short backoff
 * instead of taking Vite down with it. A crash loop in the backend used to
 * kill the frontend too, which turned "the API failed" into "the whole
 * preview is dark" and hid the actual cause.
 *
 * Every supervisor event is mirrored to .dev-api.log so the output survives
 * even when the surrounding environment does not relay stdout.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'

const API_PORT = process.env.API_PORT || '3001'
const LOG = '.dev-api.log'
const MAX_API_RESTARTS = 5

try {
  fs.writeFileSync(LOG, '')
} catch {}

function log(message) {
  const line = `[dev ${new Date().toISOString()}] ${message}`
  console.log(line)
  try {
    fs.appendFileSync(LOG, line + '\n')
  } catch {}
}

const children = new Set()
let shuttingDown = false
let apiRestarts = 0

function spawnProcess(label, args, env, onExit) {
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  })

  // Pipe rather than inherit, so each line can go to the log file as well as
  // to the console.
  const forward = (stream, sink) => {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) sink(`${label} | ${line.trimEnd()}`)
      }
    })
  }
  forward(child.stdout, log)
  forward(child.stderr, log)

  child.on('exit', (code, signal) => {
    children.delete(child)
    if (shuttingDown) return
    log(`${label} exited (code ${code}, signal ${signal || 'none'})`)
    onExit(code)
  })
  child.on('error', (err) => {
    children.delete(child)
    if (shuttingDown) return
    log(`${label} failed to start: ${err.message}`)
    onExit(1)
  })

  children.add(child)
  return child
}

function startApi() {
  log(`starting api on port ${API_PORT} (DATABASE_URL ${process.env.DATABASE_URL ? 'SET' : 'UNSET'})`)
  spawnProcess('api', ['scripts/api.mjs'], { API_PORT }, () => {
    if (apiRestarts >= MAX_API_RESTARTS) {
      log(`api exited ${apiRestarts} times, giving up on restarts. Vite stays up so the UI can show its error state.`)
      return
    }
    apiRestarts += 1
    const delay = Math.min(1000 * apiRestarts, 5000)
    log(`restarting api in ${delay}ms (attempt ${apiRestarts} of ${MAX_API_RESTARTS})`)
    setTimeout(startApi, delay)
  })
}

function startVite() {
  log('starting vite on 5173')
  spawnProcess('vite', ['node_modules/vite/bin/vite.js'], { API_PORT }, (code) => {
    // Vite is the preview surface. If it dies, the whole dev session is over.
    stop(code === null ? 1 : code)
  })
}

function stop(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(code)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

log(`node ${process.version} | cwd ${process.cwd()}`)
startApi()
startVite()
