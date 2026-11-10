// End-to-end smoke test: launches the built app with a throwaway profile.
// Usage: pnpm smoke   (builds first)
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shots = path.join(root, 'artifacts', 'smoke')
mkdirSync(shots, { recursive: true })

const profile = mkdtempSync(path.join(os.tmpdir(), 'gf profile '))
const voyagesRoot = mkdtempSync(path.join(os.tmpdir(), 'gf voyages '))

let failures = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`)
  if (!ok) failures++
}

// A fake `claude` (scripts/fake-claude.mjs) goes first on PATH so sessions are deterministic and free.
// Set GRANDFLEET_SMOKE_REAL=1 to use the real CLI instead (sessions then start but nothing is sent).
const useReal = process.env.GRANDFLEET_SMOKE_REAL === '1'
const binDir = mkdtempSync(path.join(os.tmpdir(), 'gf bin '))
const fakeScript = path.join(root, 'scripts', 'fake-claude.mjs')
const fakeLog = path.join(os.tmpdir(), 'gf-fake-claude.log')
rmSync(fakeLog, { force: true })
if (process.platform === 'win32') {
  writeFileSync(path.join(binDir, 'claude.cmd'), `@echo off\r\nnode "${fakeScript}" %*\r\n`)
} else {
  writeFileSync(path.join(binDir, 'claude'), `#!/bin/sh\nexec node "${fakeScript}" "$@"\n`)
  chmodSync(path.join(binDir, 'claude'), 0o755)
}
const childEnv = useReal ? process.env : { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` }

// Set GRANDFLEET_EXE to test a packaged build (e.g. dist/win-unpacked/Grand Fleet.exe).
const packagedExe = process.env.GRANDFLEET_EXE
console.log(packagedExe ? `Testing packaged build: ${packagedExe}` : 'Testing dev build (out/)')
console.log(useReal ? 'Using the REAL claude CLI' : 'Using the fake claude CLI')
const launch = () =>
  electron.launch({
    executablePath: packagedExe ?? electronPath,
    args: packagedExe ? [] : [root],
    env: { ...childEnv, GRANDFLEET_USER_DATA: profile }
  })

const waitFor = async (fn, ms, label) => {
  const start = Date.now()
  for (;;) {
    try {
      if (await fn()) return true
    } catch {
      /* retry */
    }
    if (Date.now() - start > ms) {
      console.log(`      timed out waiting for: ${label}`)
      return false
    }
    await new Promise((r) => setTimeout(r, 150))
  }
}

let app = await launch()
let page = await app.firstWindow()
const consoleErrors = []
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  p.on('pageerror', (e) => consoleErrors.push(String(e)))
}
watch(page)
await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined)
await page.waitForSelector('.wizard')
await page.waitForSelector('.cli-card')
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(shots, '01-wizard.png') })

// --- security boundary
const sec = await page.evaluate(async () => {
  let blocked = false
  try {
    await window.grandFleet.invoke('shell:exec', { cmd: 'calc' })
  } catch {
    blocked = true
  }
  return {
    noRequire: typeof window.require === 'undefined',
    noProcess: typeof window.process === 'undefined',
    bridge: typeof window.grandFleet?.invoke === 'function',
    blocked
  }
})
check(sec.noRequire && sec.noProcess, 'renderer has no Node access')
check(sec.bridge, 'typed bridge exposed')
check(sec.blocked, 'unknown IPC channel is rejected')

// --- wizard
const cards = await page.locator('.cli-card').count()
check(cards === 2, 'wizard shows both CLI providers', `${cards} cards`)
const cardText = await page.locator('.cli-card').allInnerTexts()
check(cardText.some((t) => /Claude Code/.test(t)), 'Claude Code card present')
const codexMissing = cardText.find((t) => /Codex/.test(t))
console.log('      codex card:', JSON.stringify(codexMissing?.replace(/\s+/g, ' ')))
await page.getByRole('button', { name: 'next' }).click()
await page.screenshot({ path: path.join(shots, '02-wizard-keys.png') })
await page.getByRole('button', { name: 'next' }).click()
await page.getByRole('button', { name: 'set sail' }).click()
await page.waitForSelector('.wizard', { state: 'detached' })
await page.waitForSelector('.wanted-card')
await page.screenshot({ path: path.join(shots, '03-main-demo.png') })

const cardCount = await page.locator('.wanted-card').count()
check(cardCount === 10, 'roster shows 10 crew from crew pack', `${cardCount}`)
check((await page.locator('.top-center').innerText()).includes('The Sunny Deck'), 'ship name comes from ship.json')
check((await page.locator('.ship-select option:disabled').count()) === 3, 'three locked coming-soon crews')
// the default scene is the native-resolution pixel ship (1024x576 world, sprites from assets/ship/*.png)
check(
  await waitFor(() => page.locator('canvas.pixel-canvas[data-ready="true"]').count().then((n) => n === 1), 10000, 'pixel canvas ready'),
  'pixel ship scene renders from the sprite sheets'
)
const scaleAttr = await page.locator('canvas.pixel-canvas').getAttribute('data-scale')
check(/^[1-9]\d*$/.test(scaleAttr ?? ''), 'pixel scene uses an integer scale', `x${scaleAttr}`)
const smoothing = await page.locator('canvas.pixel-canvas').evaluate((c) => getComputedStyle(c).imageRendering)
check(smoothing === 'pixelated', 'pixel canvas is nearest-neighbour scaled', smoothing)
await page.locator('canvas.pixel-canvas').hover({ position: { x: 200, y: 200 } })
await page.waitForTimeout(250)
await page.screenshot({ path: path.join(shots, '03b-galley-hover.png') })
{
  // whole ship -> click a room -> zoomed room view at a larger integer scale -> Escape -> back to the ship
  const c = page.locator('canvas.pixel-canvas')
  const shipDims = await c.evaluate((el) => ({ w: el.width, h: el.height, scale: Number(el.dataset.scale), view: el.dataset.view }))
  check(shipDims.view === 'ship' && shipDims.w === 1024 * shipDims.scale && shipDims.h === 576 * shipDims.scale, 'ship view shows the whole 1024x576 world at an integer scale', JSON.stringify(shipDims))
  const box = await c.boundingBox()
  const k = (await c.evaluate((el) => Number(el.dataset.scale) / (window.devicePixelRatio || 1)))
  await page.mouse.click(box.x + 240 * k, box.y + 200 * k)
  const zoomed = await waitFor(() => c.evaluate((el) => el.dataset.view === 'lawn'), 4000, 'room zoom')
  check(zoomed, 'clicking a room zooms the camera into it')
  const roomScale = Number(await c.getAttribute('data-scale'))
  check(Number.isInteger(roomScale) && roomScale >= shipDims.scale, 'room view keeps an integer scale', `x${roomScale}`)
  await page.keyboard.press('Escape')
  check(await waitFor(() => c.evaluate((el) => el.dataset.view === 'ship'), 4000, 'back to ship'), 'Escape returns to the whole ship')
}
const legacyView = () => page.getByRole('button', { name: 'Full ship (legacy)' }).click()
await legacyView()
check((await page.locator('.room').count()) === 10, 'scene renders 10 rooms from ship.json')
const scenePng = path.join(root, 'assets', 'crews', 'strawhats', 'ship', 'scene.png')
check(existsSync(scenePng), 'ship art bundle on disk (scene.png — run pnpm art in CI if missing)')
check((await page.locator('.ship-pixel-art').count()) === 1, 'ship scene uses generated pixel art')
check(
  await waitFor(
    () => page.locator('.ship-pixel-art').evaluate((img) => img.complete && img.naturalWidth > 0),
    8000,
    'grandfleet:// scene image'
  ),
  'grandfleet:// scene image loads in renderer'
)
check((await page.locator('.tab-btn.ringing').count()) === 1, 'den den mushi tab rings for demo request')

// --- voyages and worktrees through the real IPC
const repo = await page.evaluate(
  async ({ voyagesRoot }) => {
    await window.grandFleet.invoke('settings:set', { voyagesRoot })
    const v = await window.grandFleet.invoke('voyages:create', { crewId: 'strawhats', name: 'Smoke Voyage' })
    return v
  },
  { voyagesRoot }
)
check(existsSync(path.join(repo.path, '.git')), 'voyages:create made a git repo', repo.path)
const bad = await page.evaluate(() =>
  window.grandFleet.invoke('voyages:create', { crewId: 'strawhats', name: '..\\evil' }).then(
    () => 'created',
    (e) => String(e.message)
  )
)
check(bad !== 'created', 'path-traversal voyage name rejected')

await page.reload()
await page.waitForSelector('.wanted-card')
await page.waitForTimeout(600)
check((await page.locator('.voyage-name').innerText()) === 'Smoke Voyage', 'voyage restored after reload')
check((await page.locator('.demo-tag').count()) === 0, 'demo data hidden once a voyage is open')
await legacyView() // a reload resets the scene toggle to the galley view
check((await page.locator('.crew-chip').count()) === 0, 'no crew on duty initially (off duty = no chip)')

// activate three crew from the roster UI
const dutyButtons = page.getByRole('button', { name: 'on duty' })
for (let i = 0; i < 3; i++) {
  await dutyButtons.first().click()
  await page.waitForTimeout(1500)
}
await page.waitForSelector('.crew-chip')
const chips = await page.locator('.crew-chip').count()
check(chips === 3, 'three crew on duty show in the scene', `${chips}`)
await page.getByRole('button', { name: 'Pixel ship (new art)' }).click()
const galleyLabel = (await page.locator('canvas.pixel-canvas').getAttribute('aria-label')) ?? ''
// the first three roster crew (Luffy, Nami, Robin) are on duty and stand in their own rooms; the cook is off duty
check(/Luffy/.test(galleyLabel) && /Nami/.test(galleyLabel) && /Robin/.test(galleyLabel), 'pixel ship shows the three crew on duty', galleyLabel)
check(!/Sanji/.test(galleyLabel), 'pixel ship shows no cook while Sanji is off duty', galleyLabel)
await legacyView()
const wtRoot = path.join(repo.path, '.grandfleet', 'worktrees')
const dirs = existsSync(wtRoot) ? (await import('node:fs')).readdirSync(wtRoot) : []
check(dirs.length === 3, 'each active crew member has their own worktree', dirs.join(','))
const offDutyDirs = 10 - dirs.length
check(offDutyDirs === 7, 'off-duty crew have no directory')
await page.getByRole('tab', { name: 'activity' }).click()
await page.waitForTimeout(200)
const activity = await page.locator('.list-panel li').allInnerTexts()
check(activity.some((t) => /reported for duty/.test(t)), 'activity log records duty changes', `${activity.length} rows`)
await page.screenshot({ path: path.join(shots, '04-voyage-active.png') })

// --- live agent sessions: terminal, status, usage, Den Den Mushi approvals, log, typing
if (useReal) {
  // Real CLI: only prove the session starts inside a real terminal (no prompt is sent).
  await page.getByRole('tab', { name: 'terminal' }).click()
  await page.waitForSelector('.terminal-mount .xterm')
  await page.waitForTimeout(6000)
  await page.screenshot({ path: path.join(shots, '10-real-claude-terminal.png') })
  check(true, 'real claude session screenshot captured (see 10-real-claude-terminal.png)')
} else {
  await page.getByRole('tab', { name: 'terminal' }).click()
  await page.waitForSelector('.terminal-mount .xterm')
  const termText = () => page.locator('.terminal-mount .xterm-rows').innerText()
  const seen = async (re) => re.test(await termText())
  check(await waitFor(() => seen(/FAKE CLAUDE ready/), 20000, 'fake claude banner in the terminal'), 'terminal shows the live session output')
  check(
    await waitFor(async () => (await page.locator('.deck-status-line').innerText()).includes('Ready for orders'), 10000, 'SessionStart status'),
    'status line follows the SessionStart hook'
  )
  check(
    await waitFor(async () => /12%/.test(await page.locator('.wanted-card.selected .card-stats').innerText()), 10000, 'context % on the roster card'),
    'roster card shows context % from the status line'
  )
  const cardStats = await page.locator('.wanted-card.selected .card-stats').innerText()
  check(/\$0\.012/.test(cardStats), 'roster card shows cost', cardStats.replace(/\s+/g, ' '))
  await page.screenshot({ path: path.join(shots, '10-live-terminal.png') })

  const denTab = page.locator('.tab-btn', { hasText: 'den den mushi' })
  const pill = () => page.locator('.deck-meta .status-pill').innerText()
  const send = async (text) => {
    await page.locator('.queue-input').fill(text)
    await page.locator('.queue-input').press('Enter')
  }

  // typing straight into the terminal
  await page.locator('.terminal-mount').click()
  await page.keyboard.type('ping')
  await page.keyboard.press('Enter')
  check(await waitFor(() => seen(/echo: ping/), 10000, 'typed input echoed'), 'keystrokes in the terminal reach the agent')

  // approval path: auto mode is off, so the Write must go to the Den Den Mushi queue
  await send('please write the notes')
  check(await waitFor(async () => (await page.locator('.tab-btn.ringing').count()) === 1, 10000, 'den den mushi rings'), 'permission request rings the Den Den Mushi tab')
  check(await waitFor(async () => (await pill()).toLowerCase() === 'waiting', 5000, 'waiting pill'), 'agent shows as waiting while a request is pending')
  await denTab.click({ force: true })
  await page.waitForSelector('.den-item')
  const denText = await page.locator('.den-item').first().innerText()
  check(/notes\.txt/.test(denText) && /auto mode is off/.test(denText), 'queue entry names the file and why it was not auto-approved', denText.replace(/\s+/g, ' ').slice(0, 120))
  await page.screenshot({ path: path.join(shots, '11-den-den-mushi.png') })
  await page.locator('.den-item').first().getByRole('button', { name: 'allow' }).click()
  await page.getByRole('tab', { name: 'terminal' }).click()
  check(await waitFor(() => seen(/RESULT: allow/), 10000, 'RESULT: allow'), 'allow reaches the agent through the hook response')
  check(await waitFor(async () => (await page.locator('.tab-btn.ringing').count()) === 0, 5000, 'queue clears'), 'queue clears after allow')
  check(await waitFor(async () => (await pill()).toLowerCase() === 'idle', 10000, 'idle again'), 'agent returns to idle after the turn')

  await send('write again please')
  await waitFor(async () => (await page.locator('.tab-btn.ringing').count()) === 1, 10000, 'second request')
  await denTab.click({ force: true })
  await page.waitForSelector('.den-item')
  await page.locator('.den-item').first().getByRole('button', { name: 'deny' }).click()
  await page.getByRole('tab', { name: 'terminal' }).click()
  check(await waitFor(() => seen(/RESULT: deny/), 10000, 'RESULT: deny'), 'deny reaches the agent')

  // auto mode: an edit inside the agent's own worktree is approved by policy without queueing
  await page.locator('.auto-toggle input').check()
  await waitFor(async () => (await pill()).toLowerCase() === 'idle', 10000, 'idle before auto test')
  await send('write with auto mode')
  check(await waitFor(async () => (await termText()).split('RESULT: allow').length - 1 >= 2, 10000, 'auto-approved'), 'auto mode approves an in-worktree edit with no prompt')
  check((await page.locator('.tab-btn.ringing').count()) === 0, 'nothing was queued for the auto-approved edit')
  await page.locator('.auto-toggle input').uncheck()

  await page.getByRole('tab', { name: 'log' }).click()
  await page.waitForSelector('.log-row')
  const logText = (await page.locator('.log-list').innerText()).replace(/\s+/g, ' ')
  check(/Asking permission/.test(logText) && /Auto-approved/.test(logText) && /Finished a turn/.test(logText), 'log records approvals, auto-approval and finished turns')
  await page.screenshot({ path: path.join(shots, '12-log.png') })

  await page.getByRole('tab', { name: 'terminal' }).click()
  await page.getByRole('button', { name: 'Increase font size' }).click()
  check(await waitFor(async () => /font 14/.test(await page.locator('.terminal-toolbar').innerText()), 3000, 'font 14'), 'terminal font size is adjustable')

  // a provider that is not built yet becomes a visible, retryable error (never a silent failure)
  await page.evaluate(() =>
    window.grandFleet.invoke('settings:set', { characterOverrides: { strawhats: { brook: { provider: 'codex-cli' } } } })
  )
  await page.reload()
  await page.waitForSelector('.wanted-card')
  await legacyView()
  await page.waitForSelector('.terminal-mount .xterm')
  check(await waitFor(() => seen(/RESULT: deny/), 10000, 'terminal replay'), 'terminal history replays after a renderer reload')
  const brook = page.locator('.wanted-card', { hasText: 'Brook' })
  await brook.getByRole('button', { name: 'on duty' }).click()
  await brook.locator('.card-hit').click()
  check(await waitFor(async () => (await page.locator('.terminal-banner').count()) === 1, 8000, 'error banner'), 'unavailable provider shows an error banner')
  check((await page.locator('.terminal-banner').innerText()).includes('not wired up'), 'error banner explains the cause')
  check((await page.getByRole('button', { name: 'retry' }).count()) === 1, 'error banner offers retry')
  await page.screenshot({ path: path.join(shots, '13-provider-error.png') })
  await brook.getByRole('button', { name: 'stand down' }).click()
  await page.waitForTimeout(1500)
  await page.locator('.wanted-card').first().locator('.card-hit').click()
}

// stand down the last one
const standDown = page.getByRole('button', { name: 'stand down' })
await standDown.first().click()
await page.waitForTimeout(1500)
check((await page.locator('.crew-chip').count()) === 2, 'stand down removes a clean worktree')

// settings
await page.getByTitle('Settings', { exact: true }).click()
await page.waitForSelector('.settings-modal')
for (const [label, shot] of [
  ['Crew', '05-settings-crew'],
  ['Auto-approval', '06-settings-policy'],
  ['API keys', '07-settings-keys'],
  ['Voyage & editor', '08-settings-voyage'],
  ['Scene', '08b-settings-scene']
]) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(shots, `${shot}.png`) })
}
await page.getByRole('button', { name: 'Open art preview' }).click()
await page.waitForSelector('.art-preview-modal')
const artCards = await page.locator('.art-card').count()
check(artCards >= 8, 'art preview lists generated sheets', `${artCards}`)
await page.screenshot({ path: path.join(shots, '15-art-preview.png') })
await page.locator('.art-preview-modal').getByRole('button', { name: 'close' }).click()
await page.keyboard.press('Escape')

// crew override persists across a full restart
await page.getByTitle('Settings', { exact: true }).click()
await page.getByRole('button', { name: 'Crew', exact: true }).click()
await page.locator('.settings-pane input[type="text"]').first().fill('Grand Admiral')
await page.getByRole('button', { name: /^Save / }).click()
await page.waitForTimeout(300)
await page.keyboard.press('Escape')

await app.close()
app = await launch()
page = await app.firstWindow()
watch(page)
await page.waitForSelector('.wanted-card')
await page.waitForTimeout(800)
check((await page.locator('.voyage-name').innerText()) === 'Smoke Voyage', 'voyage persists across restart (SQLite + prefs)')
await legacyView()
check((await page.locator('.crew-chip').count()) === 2, 'active crew restored from worktrees on disk')
await page.locator('.wanted-card').first().getByLabel(/Info about/).click()
check((await page.locator('.info-list').innerText()).includes('Grand Admiral'), 'role override persisted across restart')
await page.keyboard.press('Escape')
await page.screenshot({ path: path.join(shots, '09-after-restart.png') })

if (!useReal) {
  // Sessions of the restored crew come back by themselves and resume their previous conversation.
  await page.locator('.wanted-card', { hasText: 'Nami' }).locator('.card-hit').click()
  await page.waitForSelector('.terminal-mount .xterm')
  check(
    await waitFor(async () => (await page.locator('.deck-status-line').innerText()).includes('Ready for orders'), 25000, 'restored session ready'),
    'restored crew sessions start again after a restart'
  )
  const fakeLines = readFileSync(fakeLog, 'utf8')
  check(/start args=.*--resume/.test(fakeLines), 'restored sessions resume their previous conversation (--resume)')
  await page.screenshot({ path: path.join(shots, '14-restored-session.png') })
}

check(consoleErrors.length === 0, 'no console errors', consoleErrors.slice(0, 3).join(' | '))

await app.close()
rmSync(binDir, { recursive: true, force: true })
rmSync(profile, { recursive: true, force: true })
try {
  // Worktrees hold file handles briefly on Windows; best effort.
  rmSync(voyagesRoot, { recursive: true, force: true })
} catch {
  /* ignore */
}
console.log(failures === 0 ? '\nSmoke test passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

