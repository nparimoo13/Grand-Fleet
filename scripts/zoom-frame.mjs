// Zoom named frames of a ship sheet side by side on a flat background, for eyeballing sprites.
// Usage: node scripts/zoom-frame.mjs <sheet> <scale> <out-name> <frame> [frame...]
// Example: node scripts/zoom-frame.mjs characters 10 sanji sanji_idle_0 sanji_walk_0 sanji_work_1
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [sheet, scaleArg, outName, ...names] = process.argv.slice(2)
if (!sheet || !scaleArg || !outName || names.length === 0) {
  console.error('usage: node scripts/zoom-frame.mjs <sheet> <scale> <out-name> <frame> [frame...]')
  process.exit(1)
}
const scale = Number(scaleArg)
const dir = path.join(root, 'assets', 'ship')
const png = PNG.sync.read(readFileSync(path.join(dir, `${sheet}.png`)))
const json = JSON.parse(readFileSync(path.join(dir, `${sheet}.json`), 'utf8'))
const rects = names.map((n) => {
  const f = json.frames[n] ?? json.frames[`${n}.png`]
  if (!f) throw new Error(`no frame ${n}`)
  return f.frame
})
const gap = 2
const W = (rects.reduce((n, r) => n + r.w, 0) + gap * (rects.length + 1)) * scale
const H = (Math.max(...rects.map((r) => r.h)) + gap * 2) * scale
const out = new PNG({ width: W, height: H })
for (let i = 0; i < out.data.length; i += 4) {
  out.data[i] = 0x6a
  out.data[i + 1] = 0x7a
  out.data[i + 2] = 0x74
  out.data[i + 3] = 255
}
let x0 = gap
for (const r of rects) {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const si = ((r.y + y) * png.width + (r.x + x)) * 4
      if (png.data[si + 3] === 0) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const di = ((gap + y) * scale + dy) * W * 4 + ((x0 + x) * scale + dx) * 4
          out.data[di] = png.data[si]
          out.data[di + 1] = png.data[si + 1]
          out.data[di + 2] = png.data[si + 2]
          out.data[di + 3] = 255
        }
      }
    }
  }
  x0 += r.w + gap
}
const dest = path.join(root, 'artifacts', 'ship', `zoom-${outName}.png`)
mkdirSync(path.dirname(dest), { recursive: true })
writeFileSync(dest, PNG.sync.write(out))
console.log('wrote', dest)
