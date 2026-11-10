import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CONNECTORS, WALK_GRAPH, landingY, routeBetween } from '../../src/ship/connectors'
import { Mask, containedWithMargin, fillPolygon, fillRect, spline } from '../../src/ship/geometry'
import { HITBOXES, roomAtPoint } from '../../src/ship/hitboxes'
import {
  DECK_FLOOR_Y,
  HALLS,
  HORIZON_Y,
  HULL_CURVE,
  HULL_FITTINGS,
  HULL_Y0,
  OPEN_DECK,
  ROOMS,
  SPACES,
  STRUCTURE,
  THEMES,
  WORLD_H,
  WORLD_W,
  floorTopY,
  roomRect,
  type Placement,
  type Rect
} from '../../src/ship/room-defs'
import { buildShell, roomMask } from '../../src/ship/shell'
import { writeShipSheets } from './build'
import { HULL_Y0 as ART_HULL_Y0 } from './ship'
import * as world from './world'

const dir = mkdtempSync(path.join(os.tmpdir(), 'gf-ship-layout-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
writeShipSheets(dir)

interface Json {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>
  meta: { anchors?: Record<string, { parent: string }>; floorProps?: string[]; frameTags?: Array<{ name: string; from: number; to: number }> }
}
const load = (id: string) => {
  const json = JSON.parse(readFileSync(path.join(dir, `${id}.json`), 'utf8')) as Json
  const names = new Set(Object.keys(json.frames).map((n) => n.replace(/\.png$/, '')))
  const size = (n: string) => json.frames[`${n}.png`].frame
  return { json, names, size }
}
const props = load('props')
const tiles = load('tiles')
const worldSheet = load('world')
const chars = load('characters')

const nameOf = (p: Placement): string => p.prop ?? (p.anim as string[])[0]
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const within = (inner: Rect, outer: Rect): boolean => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

const ALL_IDS = [
  'aquarium_lounge',
  'captains_room',
  'crew_quarters',
  'crows_nest',
  'engine_room',
  'factory',
  'figurehead',
  'galley',
  'helm',
  'infirmary',
  'lawn',
  'library',
  'map_room',
  'storage',
  'weapons'
]

describe('world constants', () => {
  it('match the art build, so scene and sprites share one coordinate system', () => {
    expect({ WORLD_W, WORLD_H, HORIZON_Y, HULL_Y0 }).toEqual({ WORLD_W: world.WORLD_W, WORLD_H: world.WORLD_H, HORIZON_Y: world.HORIZON_Y, HULL_Y0: ART_HULL_Y0 })
    const bow = ROOMS.find((r) => r.id === 'figurehead')
    expect(DECK_FLOOR_Y).toBe(floorTopY(bow as NonNullable<typeof bow>))
  })
})

describe('room layout', () => {
  it('keeps all fifteen rooms (the original ten plus five new ones), individually placed inside the world', () => {
    expect(ROOMS.map((r) => r.id).sort()).toEqual(ALL_IDS)
    for (const r of SPACES) {
      const b = roomRect(r)
      expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= WORLD_W && b.y + b.h <= WORLD_H, r.id).toBe(true)
    }
    // no grid: the rooms do not share one size, and the floors are staggered
    expect(new Set(ROOMS.map((r) => `${r.rect.w}x${r.rect.h}`)).size).toBeGreaterThan(10)
    expect(new Set(ROOMS.map((r) => r.rect.y)).size).toBeGreaterThan(6)
  })

  it('never lets two enclosed rooms overlap', () => {
    const closed = SPACES.filter((r) => !r.open)
    for (const a of closed) for (const b of closed) if (a.id < b.id) expect(overlap(a.rect, b.rect), `${a.id} / ${b.id}`).toBe(false)
  })

  it('puts the gym in the crow nest on the mast and the captain in the raised stern', () => {
    const nest = roomRect(ROOMS.find((r) => r.id === 'crows_nest') as NonNullable<(typeof ROOMS)[number]>)
    const cap = roomRect(ROOMS.find((r) => r.id === 'captains_room') as NonNullable<(typeof ROOMS)[number]>)
    expect(nest.y + nest.h).toBeLessThan(DECK_FLOOR_Y - 100)
    expect(nest.x).toBeLessThan(STRUCTURE.mast.x)
    expect(nest.x + nest.w).toBeGreaterThan(STRUCTURE.mast.x)
    expect(cap.x).toBeGreaterThan(WORLD_W / 2)
    expect(cap.y + cap.h).toBeLessThan(DECK_FLOOR_Y + 12)
  })

  it('uses real tiles for every theme', () => {
    for (const [name, th] of Object.entries(THEMES)) {
      const used = [th.dado, th.rail, th.base, th.floor, ...(th.wall ?? [])]
      for (const t of used) expect(tiles.names.has(t), `${name}: ${t}`).toBe(true)
    }
    for (const n of ['rug_runner', 'light_pool', 'railing', 'floor_wood', 'floor_steel', 'ao_under', 'pipe_run', 'sea_day_0', 'sea_night_1', 'cloud']) {
      expect(tiles.names.has(n), n).toBe(true)
    }
  })

  it('only places props that exist, inside the room', () => {
    for (const r of SPACES) {
      const { w } = roomRect(r)
      for (const p of [...r.props, ...(r.decals ?? [])]) {
        for (const n of p.anim ?? [p.prop as string]) expect(props.names.has(n), `${r.id}: ${n}`).toBe(true)
        const f = props.size(nameOf(p))
        expect(p.x >= -4 && p.x + f.w <= w + 4, `${r.id}: ${nameOf(p)} spans ${p.x}..${p.x + f.w} of ${w}`).toBe(true)
      }
    }
    for (const p of OPEN_DECK) expect(props.names.has(nameOf(p)), nameOf(p)).toBe(true)
  })

  it('attaches every overlay to a placed prop through a real anchor', () => {
    const anchors = props.json.meta.anchors ?? {}
    for (const r of SPACES) {
      for (const o of r.overlays ?? []) {
        expect(anchors[o.anchor], `${r.id}: anchor ${o.anchor}`).toBeDefined()
        expect(r.props.some((p) => nameOf(p) === o.on), `${r.id}: ${o.on}`).toBe(true)
        for (const f of o.frames) expect(props.names.has(f), f).toBe(true)
      }
      for (const _ of r.lanterns ?? []) expect(props.names.has('lantern_0') && props.names.has('lantern_1')).toBe(true)
    }
  })

  it('gives every room 4-12 props', () => {
    for (const r of ROOMS) {
      expect(r.props.length, r.id).toBeGreaterThanOrEqual(4)
      expect(r.props.length, r.id).toBeLessThanOrEqual(12)
    }
  })

  it('leaves no bare floor stretch wider than 48px (props, rugs and ladder slots count as cover)', () => {
    const rug = tiles.size('rug_runner')
    const floorProps = new Set(props.json.meta.floorProps ?? [])
    for (const r of SPACES) {
      const { w } = roomRect(r)
      const floorTop = r.rect.h - 12
      const spans: Array<[number, number]> = []
      for (const p of r.props) {
        const f = props.size(nameOf(p))
        const bottom = p.y !== undefined ? p.y + f.h : (p.feetY ?? floorTop) + 2
        // floor-standing props, and tall hung ones that reach the floor (bookshelves)
        if (floorProps.has(nameOf(p)) || bottom >= floorTop) spans.push([p.x, p.x + f.w])
      }
      for (const x of r.rugs ?? []) spans.push([x, x + rug.w])
      for (const c of CONNECTORS) {
        if ((c.kind !== 'ladder' && c.kind !== 'stairs') || !c.art) continue
        if (c.a.space === r.id || c.b.space === r.id) spans.push([c.art.x - r.rect.x, c.art.x - r.rect.x + c.art.w])
      }
      spans.sort((a, b) => a[0] - b[0])
      let edge = 0
      let widest = 0
      for (const [a, b] of spans) {
        widest = Math.max(widest, a - edge)
        edge = Math.max(edge, b)
      }
      widest = Math.max(widest, w - edge)
      expect(widest, `${r.id}: widest bare floor ${widest}px`).toBeLessThanOrEqual(48)
    }
  })

  it('lets every enclosed room clear the curve of the hull by a plank or more', () => {
    const outer = new Mask(WORLD_W, WORLD_H)
    fillPolygon(outer, spline(HULL_CURVE, 10))
    fillRect(outer, 0, 150, WORLD_W, 110) // the deck line is flat: only the curved sides and keel matter
    for (const r of ROOMS) {
      if (r.open || r.id === 'crows_nest' || r.id === 'captains_room') continue
      const m = new Mask(WORLD_W, WORLD_H)
      m.add(roomMask(r), r.rect.x, r.rect.y)
      expect(containedWithMargin(m, outer, 10), `${r.id} pokes through the hull planks`).toBe(true)
    }
  })

  it('uses real sprites for hull fittings, on bare planks only', () => {
    const sh = buildShell()
    for (const f of HULL_FITTINGS) {
      let size: { w: number; h: number }
      if (f.world) {
        expect(worldSheet.names.has(`${f.prop}_day`), f.prop).toBe(true)
        expect(worldSheet.names.has(`${f.prop}_night`), f.prop).toBe(true)
        size = worldSheet.size(`${f.prop}_day`)
      } else {
        expect(props.names.has(f.prop), f.prop).toBe(true)
        size = props.size(f.prop)
      }
      for (let y = f.y; y < f.y + size.h; y++) {
        for (let x = f.x; x < f.x + size.w; x++) {
          expect(sh.silhouette.at(x, y) === 1 && sh.cavity.at(x, y) === 0, `${f.prop} at ${f.x},${f.y}: pixel ${x},${y} is off the planks`).toBe(true)
        }
      }
    }
  })
})

describe('hitboxes', () => {
  it('cover every room and its art, and never overlap each other', () => {
    expect(Object.keys(HITBOXES).sort()).toEqual(ALL_IDS)
    for (const r of ROOMS) expect(HITBOXES[r.id].some((h) => within(r.rect, h)), `${r.id}: hitbox does not cover the room`).toBe(true)
    const all = Object.entries(HITBOXES).flatMap(([id, rects]) => rects.map((rect) => ({ id, rect })))
    for (const a of all) for (const b of all) if (a !== b && a.id !== b.id) expect(overlap(a.rect, b.rect), `${a.id} / ${b.id}`).toBe(false)
  })

  it('resolves a click at each room centre to that room', () => {
    for (const r of ROOMS) expect(roomAtPoint(r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2), r.id).toBe(r.id)
    expect(roomAtPoint(2, 2)).toBeNull()
  })
})

describe('connectors and the walk graph', () => {
  const spaceIds = new Set(SPACES.map((s) => s.id))

  it('joins real spaces, and doors join rooms on the same floor', () => {
    for (const c of CONNECTORS) {
      expect(spaceIds.has(c.a.space) && spaceIds.has(c.b.space), c.id).toBe(true)
      if (c.kind === 'door' || c.kind === 'deck') expect(landingY(c.a.space), c.id).toBe(landingY(c.b.space))
      else expect(landingY(c.a.space), c.id).not.toBe(landingY(c.b.space))
    }
    expect(new Set(CONNECTORS.map((c) => c.id)).size).toBe(CONNECTORS.length)
  })

  it('draws a sprite for every stair and ladder, sized to its art rect', () => {
    for (const c of CONNECTORS) {
      if (!c.art) continue
      const f = worldSheet.size(`conn_${c.id}`)
      expect(f.w, c.id).toBe(c.art.w + 2)
      if (c.kind === 'ladder') expect(f.h, c.id).toBe(c.art.h + 2)
    }
  })

  it('connects every room to every other, so crew can walk anywhere', () => {
    for (const s of HALLS) expect((WALK_GRAPH.get(s.id) ?? []).length, s.id).toBeGreaterThan(0)
    for (const a of ROOMS) {
      for (const b of ROOMS) {
        const route = routeBetween(a.id, b.id)
        expect(route, `${a.id} -> ${b.id}`).not.toBeNull()
      }
    }
  })

  it('has landing spots inside the rooms they belong to', () => {
    for (const c of CONNECTORS) {
      for (const l of [c.a, c.b]) {
        const s = SPACES.find((r) => r.id === l.space) as NonNullable<(typeof SPACES)[number]>
        const slack = s.open ? 40 : 12 // the mast ladder lands on the open deck between the lawn and the helm
        expect(l.x >= s.rect.x - slack && l.x <= s.rect.x + s.rect.w + slack, `${c.id}: ${l.space} landing at ${l.x}`).toBe(true)
      }
    }
  })
})

describe('shell masks', () => {
  it('nest rooms inside beams inside the cavity inside the silhouette', () => {
    const sh = buildShell()
    for (let i = 0; i < sh.inner.data.length; i++) {
      if (sh.hole.data[i]) expect(sh.inner.data[i]).toBe(1)
      if (sh.inner.data[i]) expect(sh.cavity.data[i] && sh.silhouette.data[i]).toBe(1)
      if (sh.opening[i]) expect(sh.silhouette.data[i]).toBe(1)
    }
    expect(buildShell()).toBe(sh)
  })
})

describe('world sheet', () => {
  it('has every day and night layer the scene draws', () => {
    for (const tag of ['day', 'night']) {
      for (const n of ['sky', 'hull', 'mast', 'yard', 'sail', 'rigging', 'nest_roof', 'nest_base', 'dome', 'chimney', 'figurehead', 'bow_scroll']) {
        const name = n === 'sky' ? `sky_${tag}` : `${n}_${tag}`
        expect(worldSheet.names.has(name), name).toBe(true)
      }
      for (const f of [0, 1]) for (const n of ['sea_fill', 'fwave', 'flag']) expect(worldSheet.names.has(`${n}_${tag}_${f}`), `${n}_${tag}_${f}`).toBe(true)
    }
    for (const n of ['stars', 'sun', 'moon', 'cloud_l', 'cloud_m']) expect(worldSheet.names.has(n), n).toBe(true)
    expect(worldSheet.size('hull_day').w).toBe(WORLD_W)
  })
})

describe('crew sheet', () => {
  it('has a 16x24 idle (2) and walk (4) cycle for every crew member', () => {
    const tags = Object.fromEntries((chars.json.meta.frameTags ?? []).map((t) => [t.name, t.to - t.from + 1]))
    for (const id of ['luffy', 'nami', 'robin', 'franky', 'usopp', 'chopper', 'zoro', 'sanji', 'jinbe', 'brook']) {
      expect(tags[`${id}_idle`], id).toBe(2)
      expect(tags[`${id}_walk`], id).toBe(4)
    }
  })
})
