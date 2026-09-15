/**
 * Starts the API alone on a fixed, predictable port.
 *
 * The dev proxy target and this launcher read the same variable, so the port
 * can never drift between the two halves: API_PORT wins, then PORT, then 3001.
 * Running the API through this file (npm run dev:api) guarantees 3001 locally
 * even when the surrounding environment exports a PORT of its own for the
 * production single-origin server.
 */

if (!process.env.API_PORT) process.env.API_PORT = '3001'

await import('../server.js')
