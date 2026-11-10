// Screenshot the native-resolution ship scene from the real Electron app: the whole ship, every room zoomed
// in, hover, a "waiting" bubble and (with --night) the night palette. Then build a side-by-side comparison
// with the style references in design/refs.
// Usage: pnpm build && node scripts/ship-shot.mjs [--night] [--rooms=galley,helm]
// Output: artifacts/ship/shot/{ship,ship-hover,ship-waiting,ship-night,room-<id>,compare}.png
// Note: one reference (the Grand Gourmet screenshot) is a JPEG with a .png extension; pngjs cannot read
// it, so a converted copy is expected at artifacts/ship/shot/ref-gg.png and that panel is skipped when missing.
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'artifacts', 'ship', 'shot')
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(path.join(os.tmpdir(), 'gf shot '))
const voyagesRoot = mkdtempSync(path.join(os.tmpdir(), 'gf shot voyages '))

// deterministic, free sessions: a fake `claude` first on PATH (same trick as smoke.mjs)
const binDir = mkdtempSync(path.join(os.tmpdir(), 'gf shot bin '))
const fakeScript = path.join(root, 'scripts', 'fake-claude.mjs')
if (process.platform === 'win32') writeFileSync(path.join(binDir, 'claude.cmd'), `@echo off\r\nnode "${fakeScript}" %*\r\n`)
else {
  writeFileSync(path.join(binDir, 'claude'), `#!/bin/sh\nexec node "${fakeScript}" "$@"\n`)
  chmodSync(path.join(binDir, 'claude'), 0o755)
}

// room rects in world px [x, y, w, h] (src/ship/room-defs.ts): where to click to zoom in
const ROOMS = {
  figurehead: [108, 176, 108, 80],
  lawn: [220, 176, 290, 80],
  helm: [594, 176, 116, 80],
  crows_nest: [432, 36, 176, 88],
  captains_room: [736, 110, 196, 122],
  galley: [128, 262, 238, 88],
  crew_quarters: [370, 268, 202, 82],
  library: [576, 264, 152, 86],
  factory: [136, 354, 190, 86],
  aquarium_lounge: [330, 354, 256, 86],
  map_room: [590, 354, 146, 86],
  infirmary: [740, 354, 190, 86],
  engine_room: [232, 444, 262, 86],
  storage: [498, 444, 130, 86],
  weapons: [632, 444, 172, 86]
}
const wanted = (process.argv.find((a) => a.startsWith('--rooms=')) ?? '').slice(8).split(',').filter(Boolean)
const roomIds = wanted.length ? wanted : Object.keys(ROOMS)

const app = await electron.launch({
  executablePath: electronPath,
  args: [root],
  env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}`, GRANDFLEET_USER_DATA: profile }
})
const page = await app.firstWindow()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewportSize({ width: 1920, height: 1080 }).catch(() => undefined)
await page.waitForSelector('.wizard')
await page.waitForSelector('.cli-card')
await page.getByRole('button', { name: 'next' }).click()
await page.getByRole('button', { name: 'next' }).click()
await page.getByRole('button', { name: 'set sail' }).click()
await page.waitForSelector('.wizard', { state: 'detached' })
await page.waitForSelector('.wanted-card')

// open a real voyage and put the whole crew on duty through the roster UI
await page.evaluate(async (voyagesRoot) => {
  await window.grandFleet.invoke('settings:set', { voyagesRoot })
  await window.grandFleet.invoke('voyages:create', { crewId: 'strawhats', name: 'Shot Voyage' })
}, voyagesRoot)
await page.reload()
await page.waitForSelector('.wanted-card')
await page.waitForTimeout(600)
const names = ['Sanji', 'Luffy', 'Nami', 'Robin', 'Franky', 'Usopp', 'Chopper', 'Zoro', 'Jinbe', 'Brook']
for (const n of names) {
  const btn = page.locator('.wanted-card', { hasText: n }).getByRole('button', { name: 'on duty' })
  if (await btn.count()) await btn.first().click().catch(() => undefined)
}

const canvas = page.locator('canvas.pixel-canvas')
// the scene follows the clock by default; pin the day palette first so the shots are comparable
await page.locator('button[title="Switch scene to day"]').click({ timeout: 2000 }).catch(() => undefined)
await page.waitForSelector('canvas.pixel-canvas[data-ready="true"]', { timeout: 15000 })
await page.waitForFunction(() => document.querySelector('canvas.pixel-canvas')?.getAttribute('aria-label')?.includes('Brook'), null, {
  timeout: 20000
}).catch(() => console.log('(not every crew member reached the scene)'))
await page.waitForTimeout(1500)
const info = await canvas.evaluate((c) => ({ scale: c.dataset.scale, view: c.dataset.view, w: c.width, h: c.height, label: c.getAttribute('aria-label') }))
console.log('canvas', info)
await canvas.screenshot({ path: path.join(out, 'ship.png') })
await page.screenshot({ path: path.join(out, 'app.png') })

// zoom into each room: click its middle, screenshot, Escape back out
const worldToPage = async (wx, wy) => {
  const box = await canvas.boundingBox()
  const v = await canvas.evaluate((c) => ({ scale: Number(c.dataset.scale), dpr: window.devicePixelRatio || 1 }))
  const k = v.scale / v.dpr
  return { x: box.x + wx * k, y: box.y + wy * k }
}

// --lab: the review loop for the lighting + galley work. Pins the clock and the statuses so every iteration is
// comparable, shoots the galley at night (Sanji cooking), at night idle, by day, and the whole ship at night.
if (process.argv.includes('--lab')) {
  const pin = (night, status) =>
    page.evaluate(
      ([n, s]) => {
        const g = (window.__gfScene ??= { rev: 0 })
        g.night = n
        g.status = s
        g.timeMs = 4000
        g.rev += 1
      },
      [night, status]
    )
  const zoomRoom = async (id) => {
    const [tx, ty, tw] = ROOMS[id]
    const p = await worldToPage(tx + tw / 2, ty + 8)
    await page.mouse.click(p.x, p.y)
    await page.waitForFunction((id) => document.querySelector('canvas.pixel-canvas')?.dataset.view === id, id, { timeout: 5000 })
    await page.mouse.move(2, 2)
    await page.waitForTimeout(500)
  }
  const shoot = async (name) => canvas.screenshot({ path: path.join(out, `${name}.png`) })
  const idle = { sanji: 'idle' }
  await pin(true, { sanji: 'working', luffy: 'idle', nami: 'idle', robin: 'idle', franky: 'working', usopp: 'idle', chopper: 'idle', zoro: 'idle', jinbe: 'idle', brook: 'idle' })
  await page.waitForTimeout(400)
  await shoot('lab-ship-night')
  await zoomRoom('galley')
  await shoot('lab-galley-night')
  await pin(true, idle)
  await page.waitForTimeout(300)
  await shoot('lab-galley-night-idle')
  await pin(false, { sanji: 'working' })
  await page.waitForTimeout(300)
  await shoot('lab-galley-day')
  // every crew member at their job, at night, one shot per station
  const allWorking = Object.fromEntries(['sanji', 'luffy', 'nami', 'robin', 'franky', 'usopp', 'chopper', 'zoro', 'jinbe', 'brook'].map((n) => [n, 'working']))
  await page.keyboard.press('Escape')
  await pin(true, allWorking)
  await page.waitForTimeout(300)
  await shoot('lab-ship-working')
  for (const id of ['figurehead', 'lawn', 'helm', 'crows_nest', 'library', 'factory', 'map_room', 'infirmary', 'engine_room']) {
    await zoomRoom(id)
    await shoot(`crew-${id}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
  // weather + gulls + bob (the clock is unpinned for the last pair so the ship moves)
  const setScene = (patch) =>
    page.evaluate((p) => {
      const g = (window.__gfScene ??= { rev: 0 })
      Object.assign(g, p)
      g.rev += 1
    }, patch)
  for (const [night, weather] of [[false, 'clear'], [false, 'rain'], [true, 'rain'], [true, 'fog'], [false, 'fog']]) {
    await setScene({ night, weather, timeMs: 4000 })
    await page.waitForTimeout(300)
    await shoot(`weather-${night ? 'night' : 'day'}-${weather}`)
  }
  await setScene({ night: false, weather: 'clear', timeMs: undefined })
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(700)
    await shoot(`bob-${i}`)
  }
  await setScene({ timeMs: 4000 })
  // wheel zoom + drag pan on the whole-ship view
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(300)
  await shoot('zoom-in')
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5 + 120, box.y + box.height * 0.5 + 40, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await shoot('zoom-pan')
  console.log('reset button visible:', await page.locator('button.scene-back').count())
  await app.close()
  rmSync(profile, { recursive: true, force: true })
  rmSync(binDir, { recursive: true, force: true })
  try {
    rmSync(voyagesRoot, { recursive: true, force: true })
  } catch {
    /* worktrees hold handles briefly on Windows */
  }
  console.log('lab shots in', out)
  if (errors.length) console.log('console errors:', errors.slice(-6))
  process.exit(0)
}
for (const id of roomIds) {
  const [tx, ty, tw, th] = ROOMS[id]
  const p = await worldToPage(tx + tw / 2, ty + 8)
  await page.mouse.click(p.x, p.y)
  await page.waitForFunction((id) => document.querySelector('canvas.pixel-canvas')?.dataset.view === id, id, { timeout: 5000 }).catch(() => console.log('no zoom for', id))
  await page.mouse.move(2, 2)
  await page.waitForTimeout(700)
  await canvas.screenshot({ path: path.join(out, `room-${id}.png`) })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('canvas.pixel-canvas')?.dataset.view === 'ship', null, { timeout: 5000 }).catch(() => undefined)
}

// hover plaque on the whole-ship view
const hp = await worldToPage(340, 200)
await page.mouse.move(hp.x, hp.y)
await page.waitForTimeout(300)
console.log('hover room:', await canvas.evaluate((c) => c.dataset.hover), 'view:', await canvas.evaluate((c) => c.dataset.view))
// read the canvas directly: an element screenshot can nudge the pointer and drop the hover state
const dataUrl = await canvas.evaluate((c) => c.toDataURL('image/png'))
writeFileSync(path.join(out, 'ship-hover.png'), Buffer.from(dataUrl.split(',')[1], 'base64'))
await page.mouse.move(2, 2)

// a pending permission request puts the agent in "waiting" -> "!" bubble
await page.locator('.wanted-card', { hasText: 'Sanji' }).locator('.card-hit').click()
await page.locator('.queue-input').fill('please write the notes')
await page.locator('.queue-input').press('Enter')
await page.waitForFunction(() => document.querySelector('canvas.pixel-canvas')?.getAttribute('aria-label')?.includes('waiting'), null, {
  timeout: 20000
}).catch(() => console.log('(no waiting state reached)'))
await page.waitForTimeout(400)
await canvas.screenshot({ path: path.join(out, 'ship-waiting.png') })

if (process.argv.includes('--night')) {
  await page.locator('button[title="Switch scene to night"]').click()
  await page.waitForTimeout(600)
  await canvas.screenshot({ path: path.join(out, 'ship-night.png') })
}
await app.close()
rmSync(profile, { recursive: true, force: true })
rmSync(binDir, { recursive: true, force: true })
try {
  rmSync(voyagesRoot, { recursive: true, force: true })
} catch {
  /* worktrees hold handles briefly on Windows */
}

// ---- side-by-side with references (nearest-neighbour scaling to a common height)
const load = (p) => PNG.sync.read(readFileSync(p))
function crop(img, x, y, w, h) {
  const o = new PNG({ width: w, height: h })
  PNG.bitblt(img, o, x, y, w, h, 0, 0)
  return o
}
function resizeTo(img, h) {
  const w = Math.round((img.width * h) / img.height)
  const o = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / w))
      const sy = Math.min(img.height - 1, Math.floor((y * img.height) / h))
      const si = (sy * img.width + sx) * 4
      const di = (y * w + x) * 4
      for (let k = 0; k < 4; k++) o.data[di + k] = img.data[si + k]
    }
  return o
}
const ours = load(path.join(out, 'ship.png'))
const H = ours.height
const panels = [ours]
const ggPath = path.join(out, 'ref-gg.png')
if (existsSync(ggPath)) panels.push(resizeTo(crop(load(ggPath), 205, 330, 250, 170), H))
panels.push(resizeTo(crop(load(path.join(root, 'design/refs/barotrauma-submarine-cutaway-teal.png')), 100, 85, 230, 150), H))
const gap = 8
const W = panels.reduce((n, p) => n + p.width, 0) + gap * (panels.length - 1)
const sheet = new PNG({ width: W, height: H })
sheet.data.fill(255)
let x0 = 0
for (const p of panels) {
  PNG.bitblt(p, sheet, 0, 0, p.width, p.height, x0, 0)
  x0 += p.width + gap
}
writeFileSync(path.join(out, 'compare.png'), PNG.sync.write(sheet))
console.log('wrote', path.join(out, 'compare.png'))
if (errors.length) console.log('console errors:', errors.slice(-6))




