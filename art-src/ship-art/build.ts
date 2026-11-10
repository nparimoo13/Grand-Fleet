import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import type { AsepriteFrameTag } from '../../shared/types/art'
import { packSheet, type FrameInput, type SheetPack } from '../lib/aseprite'
import { characterSprites } from './characters'
import { portraitSprites } from './characters-crew'
import { GF32 } from './palette'
import { ANCHORS, propSprites } from './props'
import { cabinPropSpritesA } from './props-cabins-a'
import { ENGINE_ANCHORS, cabinPropSpritesB } from './props-cabins-b'
import { AQUARIUM_ANCHOR, deckPropSprites, type RoomProp } from './props-deck'
import { REEF_ANCHOR, shipPropSprites } from './props-ship'
import { castShadow, floorShadow, outline, toRows, type Sprite } from './sprite'
import { tileSprites } from './tiles'
import { UI_OUTLINED, uiSprites } from './ui'
import { wearSprites } from './wear'
import { worldSprites } from './world'

/** Galley floor props (they predate the `floor` flag). */
const GALLEY_FLOOR = new Set(['fridge', 'barrel', 'crate_oranges', 'stove_hood', 'counter', 'bench', 'table'])

/** Props with a window: they get a `<name>_night` frame so the glass shows the night sky and sea. */
export const NIGHT_WINDOWS: ReadonlySet<string> = new Set(['porthole', 'viewport', 'window_big'])
const GLASS_NIGHT: Readonly<Record<string, string>> = { G: 'E', F: 'g', E: 'f' }
/** Seen from outside at night, a lit window is a warm yellow pane. */
const GLASS_LIT: Readonly<Record<string, string>> = { G: 'y', F: 'x', E: 'w' }
function remapGlass(s: Sprite, map: Readonly<Record<string, string>>): Sprite {
  return { w: s.w, h: s.h, px: s.px.map((r) => r.map((k) => map[k] ?? k)) }
}
const nightGlass = (s: Sprite): Sprite => remapGlass(s, GLASS_NIGHT)

/** Every prop in the ship, with its outline/shadow flags. */
export function allProps(): RoomProp[] {
  const galley: RoomProp[] = propSprites().map((p) => ({ name: p.name, sprite: p.sprite, solid: p.solid, floor: GALLEY_FLOOR.has(p.name) }))
  return [...galley, ...deckPropSprites(), ...cabinPropSpritesA(), ...cabinPropSpritesB(), ...shipPropSprites(), ...wearSprites()]
}

export interface BuiltSheet {
  id: 'tiles' | 'props' | 'characters' | 'ui' | 'world'
  pack: SheetPack
}

const frame = (name: string, s: Sprite): FrameInput => ({ name, grid: toRows(s) })

/** idle, walk and work tags for every `<id>_idle_N` / `_walk_N` / `_work_N` frame, in sheet order. */
function characterTags(names: string[]): AsepriteFrameTag[] {
  const tags: AsepriteFrameTag[] = []
  const seen = new Map<string, { from: number; to: number }>()
  names.forEach((n, i) => {
    const m = /^(.*)_(idle|walk|work)_\d+$/.exec(n)
    if (!m) return
    const tag = `${m[1]}_${m[2]}`
    const cur = seen.get(tag)
    if (cur) cur.to = i
    else seen.set(tag, { from: i, to: i })
  })
  for (const [name, r] of seen) tags.push({ name, from: r.from, to: r.to, direction: 'forward' })
  return tags
}

export function buildSheets(): BuiltSheet[] {
  const tiles = tileSprites().map((t) => frame(t.name, t.sprite))

  const props: FrameInput[] = []
  const floorWidths = new Set<number>([16, 24])
  const floorProps: string[] = []
  for (const p of allProps()) {
    const s = p.solid ? outline(p.sprite) : p.sprite
    props.push(frame(p.name, s))
    if (p.solid) props.push(frame(`${p.name}__shadow`, castShadow(s)))
    if (NIGHT_WINDOWS.has(p.name)) {
      props.push(frame(`${p.name}_night`, nightGlass(s)))
      props.push(frame(`${p.name}_lit`, remapGlass(s, GLASS_LIT)))
    }
    if (p.floor) {
      floorWidths.add(s.w)
      floorProps.push(p.name)
    }
  }
  for (const w of [...floorWidths].sort((a, b) => a - b)) props.push(frame(`floor_shadow_${w}`, floorShadow(w)))

  const charSprites = characterSprites()
  const outlined = charSprites.map((c) => ({ name: c.name, sprite: outline(c.sprite) }))
  // cast shadows go after every real frame so the animation tag ranges (by frame index) stay contiguous
  const chars = [...outlined.map((c) => frame(c.name, c.sprite)), ...outlined.map((c) => frame(`${c.name}__shadow`, castShadow(c.sprite)))]
  const ui = [
    ...uiSprites().map((u) => frame(u.name, UI_OUTLINED.has(u.name) ? outline(u.sprite) : u.sprite)),
    // 32x32 busts for the roster and the Captain's Deck (transparent: the UI puts them on the signature colour)
    ...portraitSprites().map((p) => frame(p.name, outline(p.sprite)))
  ]

  const characters = packSheet(chars, GF32, 256)
  characters.json.meta.frameTags = characterTags(charSprites.map((c) => c.name))
  const propPack = packSheet(props, GF32, 1024)
  const meta = propPack.json.meta as { anchors?: unknown; floorProps?: string[] }
  meta.anchors = { ...ANCHORS, aquarium_fish: AQUARIUM_ANCHOR, reef_fish: REEF_ANCHOR, ...ENGINE_ANCHORS }
  meta.floorProps = floorProps
  return [
    { id: 'tiles', pack: packSheet(tiles, GF32, 512) },
    { id: 'props', pack: propPack },
    { id: 'characters', pack: characters },
    { id: 'ui', pack: packSheet(ui, GF32, 256) },
    { id: 'world', pack: packSheet(worldSprites().map((w) => frame(w.name, w.sprite)), GF32, 1024) }
  ]
}

/** Nearest-neighbour upscale on a checker backdrop, for eyeballing sheets. */
export function contactSheet(pngBuf: Buffer, factor: number): Buffer {
  const src = PNG.sync.read(pngBuf)
  const out = new PNG({ width: src.width * factor, height: src.height * factor })
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const sx = Math.floor(x / factor)
      const sy = Math.floor(y / factor)
      const si = (sy * src.width + sx) * 4
      const di = (y * out.width + x) * 4
      if (src.data[si + 3] === 0) {
        const checker = (Math.floor(x / (factor * 4)) + Math.floor(y / (factor * 4))) % 2 === 0
        const v = checker ? 0x6a : 0x5e
        out.data[di] = v
        out.data[di + 1] = v
        out.data[di + 2] = v + 6
        out.data[di + 3] = 255
      } else {
        out.data[di] = src.data[si]
        out.data[di + 1] = src.data[si + 1]
        out.data[di + 2] = src.data[si + 2]
        out.data[di + 3] = 255
      }
    }
  }
  return PNG.sync.write(out)
}

/** Writes assets/ship/<sheet>.png + .json, and optionally scaled contact sheets for review. */
export function writeShipSheets(assetsShipDir: string, contactDir?: string): Array<{ id: string; w: number; h: number; frames: number }> {
  mkdirSync(assetsShipDir, { recursive: true })
  if (contactDir) mkdirSync(contactDir, { recursive: true })
  return buildSheets().map(({ id, pack }) => {
    writeFileSync(path.join(assetsShipDir, `${id}.png`), pack.png)
    writeFileSync(path.join(assetsShipDir, `${id}.json`), JSON.stringify(pack.json, null, 2))
    if (contactDir) writeFileSync(path.join(contactDir, `contact-${id}.png`), contactSheet(pack.png, 3))
    return { id, w: pack.width, h: pack.height, frames: Object.keys(pack.json.frames).length }
  })
}

