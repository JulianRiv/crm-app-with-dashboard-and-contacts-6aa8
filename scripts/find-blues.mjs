// Dev-only audit: fails loudly if a blue hex or rgb blue is left in the source.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src', 'index.html']
const HEX = /#[0-9a-fA-F]{6}\b/g
const RGB = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g

function files(path, out = []) {
  const s = statSync(path)
  if (s.isFile()) {
    out.push(path)
    return out
  }
  for (const entry of readdirSync(path)) files(join(path, entry), out)
  return out
}

function isBlue(r, g, b) {
  // Blue-dominant with little red: the family we removed. Purple keeps r high.
  return b > 120 && b - r > 40 && b - g > 30
}

const hits = []
for (const root of ROOTS) {
  for (const file of files(root)) {
    const text = readFileSync(file, 'utf8')
    text.split('\n').forEach((line, i) => {
      for (const hex of line.match(HEX) || []) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        if (isBlue(r, g, b)) hits.push(`${file}:${i + 1} ${hex}`)
      }
      for (const rgb of line.match(RGB) || []) {
        const [r, g, b] = rgb.replace(/rgba?\(/, '').split(',').map((n) => Number(n.trim()))
        if (isBlue(r, g, b)) hits.push(`${file}:${i + 1} ${rgb})`)
      }
    })
  }
}

if (hits.length === 0) console.log('No blue hex or rgb blue values found.')
else {
  console.log('Blue values still present:')
  hits.forEach((h) => console.log('  ' + h))
}
