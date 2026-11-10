// Dev helper: crop named sprites out of an assets/ship sheet and upscale them (nearest) for review.
// Usage: node scripts/ship-zoom.mjs <sheet> <scale> <name> [name...]   ->  artifacts/ship/zoom.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [sheet, scaleArg, ...names] = process.argv.slice(2)
if (!sheet || !scaleArg || names.length === 0) {
  console.error('usage: node scripts/ship-zoom.mjs <tiles|props|characters|ui> <scale> <name> [name...]')
  process.exit(1)
}
const scale = Number(scaleArg)
const dir = path.join(root, 'assets', 'ship')
const atlas = JSON.parse(readFileSync(path.join(dir, `${sheet}.json`), 'utf8'))
const png = PNG.sync.read(readFileSync(path.join(dir, `${sheet}.png`)))

const rects = names.map((n) => {
  const f = atlas.frames[`${n}.png`]
  if (!f) throw new Error(`no frame "${n}" in ${sheet}`)
  return { name: n, ...f.frame }
})
const gap = 4
const outW = rects.reduce((s, r) => s + r.w * scale + gap, gap)
const outH = Math.max(...rects.map((r) => r.h * scale)) + gap * 2
const out = new PNG({ width: outW, height: outH })
for (let i = 0; i < out.data.length; i += 4) {
  const x = (i / 4) % outW
  const y = Math.floor(i / 4 / outW)
  const v = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 0x6a : 0x5e
  out.data[i] = v
  out.data[i + 1] = v
  out.data[i + 2] = v + 6
  out.data[i + 3] = 255
}
let ox = gap
for (const r of rects) {
  for (let y = 0; y < r.h * scale; y++) {
    for (let x = 0; x < r.w * scale; x++) {
      const si = ((r.y + Math.floor(y / scale)) * png.width + (r.x + Math.floor(x / scale))) * 4
      if (png.data[si + 3] === 0) continue
      const di = ((y + gap) * outW + ox + x) * 4
      out.data[di] = png.data[si]
      out.data[di + 1] = png.data[si + 1]
      out.data[di + 2] = png.data[si + 2]
      out.data[di + 3] = 255
    }
  }
  ox += r.w * scale + gap
}
mkdirSync(path.join(root, 'artifacts', 'ship'), { recursive: true })
const file = path.join(root, 'artifacts', 'ship', 'zoom.png')
writeFileSync(file, PNG.sync.write(out))
console.log(file)
