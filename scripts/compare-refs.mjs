// Side-by-side of a screenshot with the style references, scaled to a common height with nearest neighbour.
// Usage: node scripts/compare-refs.mjs <shot-name> [out-name]
//   node scripts/compare-refs.mjs lab-galley-night       -> artifacts/ship/shot/compare-lab-galley-night.png
// Panels: our shot | Barotrauma (lit underwater cutaway) | Grand Gourmet (interior + crew).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'artifacts', 'ship', 'shot')
const [shot, outName] = process.argv.slice(2)
if (!shot) {
  console.error('usage: node scripts/compare-refs.mjs <shot-name> [out-name]')
  process.exit(1)
}
const load = (p) => PNG.sync.read(readFileSync(p))
function crop(img, x, y, w, h) {
  const o = new PNG({ width: w, height: h })
  PNG.bitblt(img, o, x, y, w, h, 0, 0)
  return o
}
function resizeTo(img, h) {
  const w = Math.round((img.width * h) / img.height)
  const o = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / w))
      const sy = Math.min(img.height - 1, Math.floor((y * img.height) / h))
      const si = (sy * img.width + sx) * 4
      const di = (y * w + x) * 4
      for (let k = 0; k < 4; k++) o.data[di + k] = img.data[si + k]
    }
  }
  return o
}
const ours = load(path.join(out, `${shot}.png`))
const H = Math.min(ours.height, 640)
const panels = [resizeTo(ours, H)]
// Barotrauma: the lit sub in the dark (left half of the hull, two decks)
panels.push(resizeTo(crop(load(path.join(root, 'design/refs/barotrauma-submarine-cutaway-underwater.png')), 180, 235, 330, 130), H))
// Grand Gourmet: the kitchen / dining corner with crew (converted copy: the original is a JPEG named .png)
const gg = path.join(out, 'ref-gg.png')
if (existsSync(gg)) panels.push(resizeTo(crop(load(gg), 150, 250, 330, 200), H))
const gap = 8
const W = panels.reduce((n, p) => n + p.width, 0) + gap * (panels.length - 1)
const sheet = new PNG({ width: W, height: H })
sheet.data.fill(255)
let x0 = 0
for (const p of panels) {
  PNG.bitblt(p, sheet, 0, 0, p.width, p.height, x0, 0)
  x0 += p.width + gap
}
const dest = path.join(out, `compare-${outName ?? shot}.png`)
writeFileSync(dest, PNG.sync.write(sheet))
console.log('wrote', dest)
