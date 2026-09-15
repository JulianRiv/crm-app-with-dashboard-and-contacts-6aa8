/**
 * Guard: the client must never persist CRM records locally and must never
 * call the API on an absolute URL. Run with `npm run check`.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'src')
const BANNED = [
  { re: /localStorage|sessionStorage/, why: 'browser storage for CRM data' },
  { re: /https?:\/\/(localhost|127\.0\.0\.1)/, why: 'absolute API URL' }
]

const files = []
;(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full)
  }
})(ROOT)

let bad = 0
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const rule of BANNED) {
      if (rule.re.test(line)) {
        bad++
        console.log(`${path.relative(process.cwd(), file)}:${i + 1}  ${rule.why}\n    ${line.trim()}`)
      }
    }
  })
}

console.log(bad === 0 ? `clean: ${files.length} client files, no local persistence` : `${bad} problem(s)`)
process.exit(bad === 0 ? 0 : 1)
