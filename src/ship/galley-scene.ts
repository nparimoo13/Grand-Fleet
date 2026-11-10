import { FONT_ADVANCE, fontGlyphName, fontTextWidth } from '@shared/ship-font'
import type { AgentStatus } from '@shared/ipc'
import { anchor, drawFrame, tileFrame, type Ctx, type FrameRect, type ShipAtlases } from './atlas'

/**
 * The galley vignette, composed from sprite sheets at native resolution (256x144, 16x9 tiles).
 * Nothing here draws shapes: every pixel comes from assets/ship/*.png. See design/STYLE.md.
 */

export const SCENE_W = 256
export const SCENE_H = 144

/** Interior of the galley (12x5 tiles) and the hover region used for its plaque. */
export const GALLEY = { id: 'galley', x: 32, y: 32, w: 192, h: 80 } as const
export const GALLEY_HOVER = { x: 32, y: 16, w: 192, h: 112 } as const

const BAND_TOP = 16
const BAND_BOTTOM = 112
const WALL_Y = 32
const RAIL_Y = 80
const DADO_Y = 84
const BASE_Y = 96
const FLOOR_Y = 100
/** Props stand on the back of the floor strip; crew walk on the front of it. */
const PROP_FEET_Y = 100
const CREW_FEET_Y = 105

export interface SceneCrew {
  id: string
  name: string
  status: AgentStatus
  selected: boolean
}

export interface SceneState {
  night: boolean
  /** Milliseconds; drives every animation. Pass 0 to freeze (reduced motion). */
  timeMs: number
  hover: boolean
  crew: readonly SceneCrew[]
  /** Freeze patrol walking too. */
  still: boolean
}

export interface CrewHit {
  id: string
  rect: { x: number; y: number; w: number; h: number }
}

interface Placement {
  prop: string
  x: number
  /** Prop's feet line (last content row). For wall-hung props this is the sprite's own bottom. */
  feetY?: number
  /** Absolute top y for hung props. */
  y?: number
  floorShadow?: boolean
}

/** Layout in native pixels. Back-to-front order. */
const PLACEMENTS: readonly Placement[] = [
  { prop: 'porthole', x: 66, y: 44 },
  { prop: 'shelf_jars', x: 32, y: 35 },
  { prop: 'menu_board', x: 181, y: 46 },
  { prop: 'shelf_jars', x: 144, y: 61 },
  { prop: 'stove_hood', x: 96, feetY: PROP_FEET_Y, floorShadow: true },
  { prop: 'fridge', x: 32, feetY: PROP_FEET_Y, floorShadow: true },
  { prop: 'barrel', x: 60, feetY: PROP_FEET_Y, floorShadow: true },
  { prop: 'crate_oranges', x: 78, feetY: PROP_FEET_Y, floorShadow: true },
  { prop: 'counter', x: 132, feetY: PROP_FEET_Y, floorShadow: true },
  { prop: 'pan_rack', x: 138, y: WALL_Y },
  { prop: 'bench', x: 179, feetY: PROP_FEET_Y, floorShadow: true },
  { prop: 'table', x: 179, feetY: PROP_FEET_Y + 4, floorShadow: true }
]

function placementOf(prop: string): Placement {
  const p = PLACEMENTS.find((q) => q.prop === prop)
  if (!p) throw new Error(`no placement for ${prop}`)
  return p
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctx2d(c: HTMLCanvasElement): Ctx {
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d canvas unavailable')
  ctx.imageSmoothingEnabled = false
  return ctx
}

export class GalleyScene {
  private readonly sky: Record<'day' | 'night', HTMLCanvasElement>
  private readonly ship: HTMLCanvasElement

  constructor(private readonly a: ShipAtlases) {
    this.sky = { day: this.buildSky(false), night: this.buildSky(true) }
    this.ship = this.buildShip()
  }

  private buildSky(night: boolean): HTMLCanvasElement {
    const c = canvas(SCENE_W, SCENE_H)
    const g = ctx2d(c)
    for (let x = 0; x < SCENE_W; x += 64) drawFrame(g, this.a.tiles, night ? 'sky_night' : 'sky_day', x, 0)
    if (!night) {
      drawFrame(g, this.a.tiles, 'cloud', 52, 3)
      drawFrame(g, this.a.tiles, 'cloud', 168, 6)
    }
    return c
  }

  private prop(g: Ctx, name: string, x: number, placement: Pick<Placement, 'feetY' | 'y'>): FrameRect {
    const f = this.a.props.frames.get(name)
    if (!f) throw new Error(`unknown prop "${name}"`)
    const y = placement.y ?? (placement.feetY ?? PROP_FEET_Y) + 2 - f.h
    if (this.a.props.frames.has(`${name}__shadow`)) drawFrame(g, this.a.props, `${name}__shadow`, x, y)
    drawFrame(g, this.a.props, name, x, y)
    return f
  }

  /** Everything that never changes: structure, props, shadows. Transparent where the sea shows. */
  private buildShip(): HTMLCanvasElement {
    const c = canvas(SCENE_W, SCENE_H)
    const g = ctx2d(c)
    const t = this.a.tiles

    // lawn deck above: railing behind, turf in front
    tileFrame(g, t, 'railing', 16, 2, SCENE_W - 16, 14)
    tileFrame(g, t, 'grass', 16, 8, SCENE_W - 16, 8)

    // hull wall on the left, full height
    tileFrame(g, t, 'hull_wall', 16, 16, 16, SCENE_H - 16)

    // below the bottom band: the deck beneath is a steel-plated lower deck
    tileFrame(g, t, 'bulkhead', 32, 128, SCENE_W - 32, 16)

    // back wall: planks, chair rail, subway-tile dado, baseboard
    for (let x = 32; x < SCENE_W; x += 16) {
      const col = (x - 32) / 16
      for (let y = WALL_Y; y < RAIL_Y; y += 16) drawFrame(g, t, (col + (y - WALL_Y) / 16) % 2 === 0 ? 'wall_teal_a' : 'wall_teal_b', x, y)
    }
    tileFrame(g, t, 'chair_rail', 32, RAIL_Y, SCENE_W - 32, 4)
    tileFrame(g, t, 'wainscot', 32, DADO_Y, SCENE_W - 32, 12)
    tileFrame(g, t, 'baseboard', 32, BASE_Y, SCENE_W - 32, 4)
    tileFrame(g, t, 'floor_checker', 32, FLOOR_Y, SCENE_W - 32, 12)

    // ceiling conduit and the warm lantern glow (a dither, not a translucent fill) sit on the wall
    tileFrame(g, t, 'pipe_run', 32, WALL_Y + 5, 192, 6)
    drawFrame(g, t, 'light_pool', 195, 36)

    // the bulkhead beyond the door: solid steel plates down to the baseboard
    tileFrame(g, t, 'bulkhead', 224, WALL_Y, SCENE_W - 224, BASE_Y + 4 - WALL_Y)

    // deck bands (plank layer + steel girder) above and below the room
    tileFrame(g, t, 'deck_band', 16, BAND_TOP, SCENE_W - 16, 16)
    tileFrame(g, t, 'deck_band', 16, BAND_BOTTOM, SCENE_W - 16, 16)
    tileFrame(g, t, 'ao_under', 32, WALL_Y, SCENE_W - 32, 4)

    // structure: corner braces, bulkhead jamb and header
    this.prop(g, 'brace_l', 32, { y: WALL_Y })
    this.prop(g, 'brace_r', 208, { y: WALL_Y })
    drawFrame(g, t, 'door_jamb', 224, WALL_Y)
    drawFrame(g, t, 'door_header', 224, WALL_Y)

    // walkway runner, then props back to front
    // three runners with 8px gaps: no bare floor stretch wider than 3 tiles anywhere in the lane
    for (const rx of [40, 104, 168]) drawFrame(g, t, 'rug_runner', rx, 103)
    for (const p of PLACEMENTS) {
      const f = this.prop(g, p.prop, p.x, p)
      if (p.floorShadow) {
        const shadow = `floor_shadow_${f.w}`
        if (this.a.props.frames.has(shadow)) drawFrame(g, this.a.props, shadow, p.x, (p.feetY ?? PROP_FEET_Y) + 2)
      }
    }
    return c
  }

  /** Draw one frame into `ctx` (native-size canvas). Returns crew hit boxes in native pixels. */
  draw(ctx: Ctx, s: SceneState): CrewHit[] {
    const { a } = this
    const tick = Math.floor(s.timeMs / 125) // 8 fps
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, SCENE_W, SCENE_H)
    ctx.drawImage(this.sky[s.night ? 'night' : 'day'], 0, 0)
    drawFrame(ctx, a.tiles, `${s.night ? 'sea_night' : 'sea_day'}_${Math.floor(tick / 4) % 2}`, 0, 112)
    ctx.drawImage(this.ship, 0, 0)

    // animated props, positioned from the anchors the art build wrote into props.json
    const stove = placementOf('stove_hood')
    const stoveTop = PROP_FEET_Y + 2 - (a.props.frames.get('stove_hood')?.h ?? 0)
    const flame = anchor(a.props, 'stove_flame')
    const steam = anchor(a.props, 'stove_steam')
    drawFrame(ctx, a.props, `stove_flame_${tick % 2}`, stove.x + flame.x, stoveTop + flame.y)
    drawFrame(ctx, a.props, `steam_${Math.floor(tick / 2) % 3}`, stove.x + steam.x, stoveTop + steam.y)
    drawFrame(ctx, a.props, `lantern_${Math.floor(tick / 3) % 2}`, 211, WALL_Y)

    const hits = this.drawCrew(ctx, s, tick)
    if (s.hover) this.drawPlaque(ctx, 'Galley & dining room')
    return hits
  }

  private crewPose(index: number, s: SceneState): { x: number; walking: boolean; flip: boolean } {
    // stand beside the stove (never on it) so the hood, pots and flames stay readable
    const home = 146 + index * 20
    if (s.still) return { x: home, walking: false, flip: false }
    const stationary = s.crew[index].status !== 'idle'
    if (stationary) return { x: home, walking: false, flip: false }
    // idle crew stroll between the stove and the table: stand 4s, walk, stand 4s, walk back
    const dist = 56
    const speed = 16 // px per second
    const walkMs = (dist / speed) * 1000
    const standMs = 4000
    const cycle = 2 * (standMs + walkMs)
    const t = (s.timeMs + index * 3000) % cycle
    if (t < standMs) return { x: home, walking: false, flip: false }
    if (t < standMs + walkMs) return { x: home + Math.floor(((t - standMs) / 1000) * speed), walking: true, flip: false }
    if (t < 2 * standMs + walkMs) return { x: home + dist, walking: false, flip: true }
    return { x: home + dist - Math.floor(((t - 2 * standMs - walkMs) / 1000) * speed), walking: true, flip: true }
  }

  private drawCrew(ctx: Ctx, s: SceneState, tick: number): CrewHit[] {
    const hits: CrewHit[] = []
    const { characters, props, ui } = this.a
    const ordered = s.crew.map((c, i) => ({ c, i }))
    for (const { c, i } of ordered) {
      // Only Sanji has a sprite so far; the other crew arrive with their rooms.
      const idle = characters.tags.get(`${c.id}_idle`)
      const walk = characters.tags.get(`${c.id}_walk`)
      if (!idle || !walk) continue
      const pose = this.crewPose(i, s)
      const frames = pose.walking ? walk : idle
      const frame = pose.walking ? frames[tick % frames.length] : frames[Math.floor(tick / 4) % frames.length]
      const f = characters.frames.get(frame)
      if (!f) continue
      const x = Math.round(pose.x - f.w / 2)
      const y = CREW_FEET_Y + 2 - f.h
      drawFrame(ctx, props, 'floor_shadow_16', x, CREW_FEET_Y - 1)
      drawFrame(ctx, characters, frame, x, y, pose.flip)
      hits.push({ id: c.id, rect: { x, y, w: f.w, h: f.h } })

      // status bubble above the head
      let bubble: string | null = null
      let bob = 0
      if (c.status === 'working') bubble = `bubble_working_${Math.floor(tick / 2) % 2}`
      else if (c.status === 'waiting') {
        bubble = 'bubble_waiting'
        bob = tick % 4 < 2 ? 0 : -1
      } else if (c.status === 'error') bubble = 'bubble_error'
      else if (c.status === 'idle') bubble = 'bubble_idle'
      // the bubble's tail (cols 5-7) points at the head centre, which mirrors with the sprite
      if (bubble) drawFrame(ctx, ui, bubble, x + (pose.flip ? 2 : 1), y - 13 + bob)
      if (c.selected) drawFrame(ctx, ui, 'select_arrow', x + 3, y - 21)
    }
    return hits
  }

  private drawPlaque(ctx: Ctx, label: string): void {
    const { ui } = this.a
    const text = label.toUpperCase()
    const textW = fontTextWidth(text)
    const x0 = 36
    const y0 = 18
    drawFrame(ctx, ui, 'plaque_l', x0, y0)
    const midW = textW + 2
    for (let i = 0; i < midW; i++) drawFrame(ctx, ui, 'plaque_m', x0 + 3 + i, y0)
    drawFrame(ctx, ui, 'plaque_r', x0 + 3 + midW, y0)
    let x = x0 + 4
    for (const ch of text) {
      const g = fontGlyphName(ch)
      if (g) drawFrame(ctx, ui, g, x, y0 + 3)
      x += FONT_ADVANCE
    }
  }
}

export function inRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h
}
