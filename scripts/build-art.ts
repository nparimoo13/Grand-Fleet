/**
 * Compile art-src/ into assets/crews/<crewId>/ship/* PNGs + Aseprite JSON.
 * Run: pnpm art
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ShipArtManifest } from '../shared/types/art'
import type { ShipDef } from '../shared/types/crew'
import { buildFlagWaveFrames, buildOceanSheets, buildSkyDay, buildSkyNight } from '../art-src/ship/environment'
import { renderShipScenePng } from '../art-src/ship/compose-scene'
import { buildUiIconSheet } from '../art-src/ui/icons'
import { appIconIco, appIconPng } from '../art-src/icon/app-icon'
import { writeShipSheets } from '../art-src/ship-art/build'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'assets', 'crews')

function writeFile(rel: string, data: Buffer | string): void {
  const full = path.join(root, rel.replace(/\//g, path.sep))
  mkdirSync(path.dirname(full), { recursive: true })
  writeFileSync(full, data)
}

function buildCrewShip(crewId: string): void {
  const shipDir = path.join(assets, crewId, 'ship')
  const shipJsonPath = path.join(shipDir, 'ship.json')
  const ship = JSON.parse(readFileSync(shipJsonPath, 'utf8')) as ShipDef
  if (ship.tileSize !== 16) throw new Error(`${crewId}: only 16px tiles are supported in Phase 3`)

  const scenePng = renderShipScenePng(ship)
  writeFile(`assets/crews/${crewId}/ship/scene.png`, scenePng)

  const skyDay = buildSkyDay()
  const skyNight = buildSkyNight()
  const ocean = buildOceanSheets()
  const flag = buildFlagWaveFrames()
  const ui = buildUiIconSheet()

  writeFile(`assets/crews/${crewId}/ship/sky-day.png`, skyDay)
  writeFile(`assets/crews/${crewId}/ship/sky-night.png`, skyNight)
  writeFile(`assets/crews/${crewId}/ship/ocean-far.png`, ocean.far)
  writeFile(`assets/crews/${crewId}/ship/ocean-mid.png`, ocean.mid)
  writeFile(`assets/crews/${crewId}/ship/ocean-near.png`, ocean.near)
  writeFile(`assets/crews/${crewId}/ship/flag.png`, flag.png)
  writeFile(`assets/crews/${crewId}/ship/flag.json`, JSON.stringify(flag.json, null, 2))
  writeFile(`assets/crews/${crewId}/ship/ui-icons.png`, ui.png)
  writeFile(`assets/crews/${crewId}/ship/ui-icons.json`, JSON.stringify(ui.json, null, 2))

  const pxW = ship.size.w * ship.tileSize
  const pxH = ship.size.h * ship.tileSize

  const manifest: ShipArtManifest = {
    version: 1,
    tileSize: ship.tileSize,
    generatedAt: new Date().toISOString(),
    sheets: [
      { id: 'scene', label: 'Ship cross-section', png: 'ship/scene.png', w: pxW, h: pxH },
      { id: 'sky-day', label: 'Sky (day)', png: 'ship/sky-day.png', w: 256, h: 96 },
      { id: 'sky-night', label: 'Sky (night)', png: 'ship/sky-night.png', w: 256, h: 96 },
      { id: 'ocean-far', label: 'Ocean far', png: 'ship/ocean-far.png', w: 128, h: 16 },
      { id: 'ocean-mid', label: 'Ocean mid', png: 'ship/ocean-mid.png', w: 128, h: 16 },
      { id: 'ocean-near', label: 'Ocean near', png: 'ship/ocean-near.png', w: 128, h: 16 },
      { id: 'flag', label: 'Flag wave', png: 'ship/flag.png', json: 'ship/flag.json', w: flag.w, h: flag.h },
      { id: 'ui-icons', label: 'UI icons', png: 'ship/ui-icons.png', json: 'ship/ui-icons.json', w: ui.w, h: ui.h }
    ]
  }
  writeFile(`assets/crews/${crewId}/ship/art.json`, JSON.stringify(manifest, null, 2))
  console.log(`[art] ${crewId}: ${manifest.sheets.length} sheets → assets/crews/${crewId}/ship/`)
}

const crews = process.argv.slice(2)
const targets = crews.length ? crews : ['strawhats']
for (const id of targets) {
  buildCrewShip(id)
}

// Rebuilt ship art (galley first): sprite sheets in assets/ship/, compiled from art-src/ship-art/.
for (const s of writeShipSheets(path.join(root, 'assets', 'ship'), path.join(root, 'artifacts', 'ship'))) {
  console.log(`[art] ship/${s.id}.png ${s.w}x${s.h}, ${s.frames} frames`)
}
// App icon (Brook, 8-bit): the window/taskbar icon and the installer/shortcut .ico.
writeFile('assets/icon/icon.png', appIconPng(256))
writeFile('assets/icon/icon.ico', appIconIco())
console.log('[art] icon → assets/icon/icon.png, icon.ico')
console.log('[art] done.')
