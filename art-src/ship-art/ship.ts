import { Pix, FUR, GOLD, STEEL, WOOD, CREAM } from './pix'
import { jolly } from './emblem'
import { nightify } from './night'
import { T, blank, mirror, outline, type Sprite } from './sprite'
import type { NamedSprite } from './tiles'
import { CONNECTORS } from '../../src/ship/connectors'
import { HULL_Y0, STRUCTURE, WORLD_W } from '../../src/ship/room-defs'
import { buildShell } from '../../src/ship/shell'

/**
 * The ship itself, built at art time from the layout in src/ship: the hull sprite (planks, beams, frames, cavity,
 * doorways and hatches cut where the connectors say), the mast and sail, the figurehead and bow scroll, the stern
 * dome, and a stair or ladder sprite for every connector. Palette-pure GF32, light from the top-left.
 */

/** The hull sprite covers world rows HULL_Y0 .. HULL_Y0 + HULL_H - 1 at full world width. */
export { HULL_Y0 }
export const HULL_H = 470
/** Headroom drawn above a stair's tread line for its handrail. */
export const STAIR_RAIL = 26

const hash = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) % 1000
}

// ------------------------------------------------------------------ hull

const RING_LIT = ['a', 'e', 'd', 'd', 'c', 'c', 'b']
const RING_SHADE = ['a', 'c', 'c', 'b', 'b', 'b', 'a']

function ringPixel(x: number, y: number, depth: number, lit: boolean): string {
  const k = (lit ? RING_LIT : RING_SHADE)[Math.min(depth, 7) - 1]
  // grain: now and then a board is a shade darker
  if (depth >= 3 && hash(x, y) % 19 === 0) return k === 'd' ? 'c' : k === 'c' ? 'b' : k
  return k
}

/** Dark mahogany backing between the frames: horizontal boards with staggered joints. */
function cavityPixel(x: number, y: number): string {
  const row = Math.floor(y / 6)
  if (y % 6 === 0) return 'a'
  if ((x + row * 37) % 53 === 0) return 'a'
  if (y % 6 === 1 && hash(x, y) % 9 === 0) return 'c'
  return 'b'
}

/** Red hull planks with gold wales, nails and staggered butt joints (the outside of the ship). */
function plankPixel(x: number, y: number): string {
  const row = Math.floor(y / 8)
  const yy = ((y % 8) + 8) % 8
  for (const y0 of [292, 396]) {
    if (y >= y0 && y < y0 + 4) return ['y', 'x', 'x', 'w'][y - y0]
  }
  const joint = (x + row * 53) % 96
  if (yy === 0) return 's'
  if (joint === 0) return 's'
  if (joint === 5 && yy === 3) return 'x' // nail head
  if (joint === 1 && yy < 5) return 'u'
  if (yy === 1) return hash(x, y) % 4 === 0 ? 'v' : 'u'
  if (yy >= 6) return 's'
  if (yy >= 4 && hash(x, y) % 17 === 0) return 's'
  return 't'
}

function openingPixel(style: number, x: number, y: number, edge: number, floorTop: number): string {
  if (style === 1) {
    // shaft: dark boards seen end-on, with a light lip so the cut reads as a cut
    if (edge === 1) return 'c'
    if (edge === 2) return 'a'
    return ((x >> 1) + (y >> 3)) % 2 === 0 ? 'a' : 'b'
  }
  // doorway: arched frame, dark passage, a strip of floor
  if (edge === 1) return 'd'
  if (edge === 2) return 'c'
  if (y >= floorTop) return y === floorTop ? 'e' : 'c'
  return x % 4 === 0 ? 'a' : 'b'
}

function hullSprite(night: boolean): Sprite {
  const sh = buildShell()
  const W = WORLD_W
  const s = blank(W, HULL_H)
  const inS = (x: number, y: number): boolean => sh.silhouette.at(x, y) === 1
  const inU = (x: number, y: number): boolean => sh.cavity.at(x, y) === 1
  const op = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= sh.silhouette.h ? 0 : sh.opening[y * W + x])
  // the open-air deck band (lawn, bow, helm) keeps its own floor strip: the hull sprite never paints there, except hatches
  const inDeckBand = (x: number, y: number): boolean => y >= 176 && y < 256 && x < 730
  const floorOf = (x: number, y: number): number => {
    // the floor line of the doorway column this pixel belongs to
    for (const c of CONNECTORS) {
      const o = c.opening
      if (o && o.style === 'door' && x >= o.rect.x && x < o.rect.x + o.rect.w && y >= o.rect.y && y < o.rect.y + o.rect.h) return o.rect.y + o.rect.h - 12
    }
    return 1e9
  }

  for (let j = 0; j < HULL_H; j++) {
    const y = HULL_Y0 + j
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!inS(x, y)) continue
      const o = op(x, y)
      if (!o && inDeckBand(x, y)) continue
      let k: string
      if (o) {
        const e1 = op(x - 1, y) !== o || op(x + 1, y) !== o || op(x, y - 1) !== o || op(x, y + 1) !== o
        const e2 = !e1 && (op(x - 2, y) !== o || op(x + 2, y) !== o || op(x, y - 2) !== o || op(x, y + 2) !== o)
        k = openingPixel(o, x, y, e1 ? 1 : e2 ? 2 : 0, floorOf(x, y))
      } else if (sh.hole.data[i]) {
        continue
      } else if (sh.ring.depth[i]) {
        k = ringPixel(x, y, sh.ring.depth[i], sh.ring.lit[i] === 1)
      } else if (inU(x, y)) {
        const outside = (dx: number, dy: number): boolean => !inU(x + dx, y + dy)
        if (outside(-1, 0) || outside(1, 0) || outside(0, -1) || outside(0, 1)) k = 'a'
        else if (outside(-2, 0) || outside(2, 0) || outside(0, -2) || outside(0, 2) || outside(-1, -1) || outside(1, -1)) k = 'd'
        else k = cavityPixel(x, y)
      } else {
        k = plankPixel(x, y)
      }
      s.px[j][x] = k
    }
  }
  // 1px dark outline on the silhouette
  for (let j = 0; j < HULL_H; j++) {
    const y = HULL_Y0 + j
    for (let x = 0; x < W; x++) {
      if (!inS(x, y) || s.px[j][x] === T) continue
      if (!inS(x - 1, y) || !inS(x + 1, y) || !inS(x, y - 1) || !inS(x, y + 1)) {
        if (!inU(x, y) && !op(x, y)) s.px[j][x] = 's'
      }
    }
  }
  return night ? nightify(s) : s
}

// ------------------------------------------------------------------ small drawing helpers

/** Filled triangle (pixel centres), clipped to the canvas. */
function tri(p: Pix, a: [number, number], b: [number, number], c: [number, number], k: string): void {
  const minX = Math.floor(Math.min(a[0], b[0], c[0]))
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]))
  const minY = Math.floor(Math.min(a[1], b[1], c[1]))
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]))
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
  if (area === 0) return
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / area
      const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / area
      const w2 = 1 - w0 - w1
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) p.soft(x, y, k)
    }
  }
}

// ------------------------------------------------------------------ mast, yard, sail, rigging

function mast(h: number, night: boolean): Sprite {
  const p = new Pix(12, h, 1)
  p.vcyl(0, 0, 12, h, WOOD)
  // iron bands every 44px
  for (let y = 18; y < h - 4; y += 44) {
    p.hline(0, y, 12, 'g')
    p.hline(0, y + 1, 12, 'h')
    p.hline(0, y + 2, 12, 'f')
  }
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

function yard(w: number, night: boolean): Sprite {
  const p = new Pix(w, 6, 1)
  p.hcyl(0, 0, w, 6, WOOD)
  p.rect(0, 0, 3, 6, 'b')
  p.rect(w - 3, 0, 3, 6, 'b')
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

/** The mainsail: billowed canvas with folds, reef bands, a patch and the huge Straw Hat jolly roger. */
function sail(w: number, h: number, night: boolean): Sprite {
  const folds = 9
  const p = new Pix(w, h, 1)
  const foldW = Math.floor(w / folds)
  const bottom = (x: number) => h - 1 - Math.round(7 * Math.pow(Math.abs((2 * x) / w - 1), 2.2))
  for (let x = 0; x < w; x++) {
    const bx = bottom(x)
    // the sail bellies out to the left: the leech (right edge) is pulled in a little
    const top = Math.round(3 * Math.pow(Math.abs((2 * x) / w - 1), 3))
    const t = (x % foldW) / foldW
    for (let y = top; y <= bx; y++) {
      let k = t < 0.18 ? 'r' : t < 0.58 ? 'q' : t < 0.84 ? 'p' : 'o'
      if (t >= 0.84 && t < 0.92 && (x + y) % 2 === 0) k = 'p'
      if (y > bx - 3) k = k === 'r' ? 'q' : k === 'q' ? 'p' : 'o'
      p.put(x, y, k)
    }
  }
  p.hline(0, 0, w, 'b')
  p.hline(0, 1, w, 'c')
  for (const ry of [Math.round(h * 0.3), Math.round(h * 0.78)]) {
    p.hline(0, ry, w, 'o')
    for (let x = 4; x < w; x += 12) p.vline(x, ry + 1, 3, 'o')
  }
  const px = Math.round(w * 0.1)
  const py = Math.round(h * 0.58)
  p.rect(px, py, 12, 10, 'p')
  p.hline(px, py, 12, 'q')
  p.vline(px, py, 10, 'q')
  for (let i = 1; i < 12; i += 2) {
    p.put(px + i, py + 9, 'o')
    p.put(px + i, py + 1, 'o')
  }
  jolly(p, Math.round(w / 2), Math.round(h * 0.5), 'huge')
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

function rigging(night: boolean): Sprite {
  const Y0 = STRUCTURE.rigging.y
  const p = new Pix(WORLD_W, STRUCTURE.rigging.h, 0)
  const lines: Array<[[number, number], [number, number]]> = [
    [[440, 50], [96, 242]],
    [[600, 50], [716, 244]],
    [[486, 124], [376, 238]],
    [[554, 124], [662, 238]],
    [[424, 136], [330, 240]],
    [[616, 136], [700, 240]]
  ]
  for (const [a, b] of lines) p.line(a[0], a[1] - Y0, b[0], b[1] - Y0, 'b')
  const s = p.sprite()
  return night ? nightify(s) : s
}

// ------------------------------------------------------------------ crow's nest roof, collar, dome, chimneys

function nestRoof(night: boolean): Sprite {
  const W = 204
  const H = 32
  const p = new Pix(W, H, 1)
  // deck lip, rail, balusters, end posts
  p.box(0, 24, W, 8, WOOD)
  p.hline(2, 28, W - 4, 'b')
  for (let x = 6; x < W - 6; x += 12) p.put(x, 30, 'e')
  p.hcyl(0, 10, W, 4, WOOD)
  for (let x = 4; x < W - 4; x += 8) p.vcyl(x, 14, 2, 10, WOOD)
  for (const x of [0, W - 4]) {
    p.vcyl(x, 6, 4, 20, WOOD)
    p.disc(x + 2, 5, 2.4, GOLD)
  }
  // flag pole at the centre
  p.vcyl(W / 2 - 1, 0, 3, 24, WOOD)
  p.disc(W / 2 + 0.5, 1, 2, GOLD)
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

/** The collar under the cabin where the mast goes into it. */
function nestBase(night: boolean): Sprite {
  const W = 96
  const H = 22
  const p = new Pix(W, H, 1)
  for (let y = 0; y < H; y++) {
    const half = Math.round(48 - (y / (H - 1)) * 36)
    const x0 = 48 - half
    for (let x = x0; x < x0 + half * 2; x++) {
      const t = (x - x0) / (half * 2)
      p.put(x, y, t < 0.12 ? 'd' : t < 0.4 ? 'c' : t < 0.8 ? 'b' : 'a')
    }
  }
  for (let y = 3; y < H; y += 6) p.hline(48 - Math.round(48 - (y / (H - 1)) * 36), y, Math.round(48 - (y / (H - 1)) * 36) * 2, 'a')
  for (const x of [26, 48, 70]) p.rect(x, 8, 2, 2, 'x')
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

function dome(night: boolean): Sprite {
  const W = 184
  const H = 56
  const p = new Pix(W, H, 1)
  const rx = W / 2
  const ry = H - 6
  const stripes = 16
  for (let y = 0; y < H - 5; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - rx) / rx
      const ny = (y + 0.5 - ry) / ry
      if (nx * nx + ny * ny > 1) continue
      const stripe = Math.floor(((Math.asin(Math.max(-1, Math.min(1, nx))) / Math.PI) + 0.5) * stripes)
      const red = stripe % 2 === 0
      const edge = Math.sqrt(nx * nx + ny * ny)
      const light = -nx * 0.7 - ny * 0.3
      let k: string
      if (red) k = light > 0.55 ? 'v' : light > 0.05 ? 'u' : light > -0.5 ? 'u' : 't'
      else k = light > 0.5 ? 'r' : light > -0.2 ? 'y' : 'x'
      if (edge > 0.93 && nx > 0.2) k = red ? 't' : 'x'
      p.put(x, y, k)
    }
  }
  // gold rim and a finial
  p.box(0, H - 6, W, 6, GOLD)
  p.hline(2, H - 4, W - 4, 'w')
  p.disc(rx, 2, 3, GOLD)
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

function chimney(night: boolean): Sprite {
  const p = new Pix(14, 40, 1)
  p.vcyl(1, 4, 12, 36, CREAM)
  p.box(0, 0, 14, 5, STEEL)
  p.hline(0, 3, 14, 'f')
  p.rect(1, 14, 12, 2, 'o')
  p.rect(1, 26, 12, 2, 'o')
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

// ------------------------------------------------------------------ figurehead and bow scroll

/** The big sun-lion on the stem: a ring of flame petals round a laughing face, on a carved neck. */
function figurehead(night: boolean): Sprite {
  const W = 104
  const H = 128
  const p = new Pix(W, H, 1)
  const cx = 50
  const cy = 54
  // carved neck and collar running back into the hull
  p.vcyl(58, 78, 26, 46, WOOD)
  p.box(54, 76, 34, 7, GOLD)
  p.hline(56, 79, 30, 'w')
  p.hcyl(70, 96, 32, 8, WOOD)
  p.hcyl(70, 112, 32, 8, WOOD)
  // flame petals: alternating long and short
  const n = 18
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.15
    const r1 = i % 2 === 0 ? 50 : 42
    const d = 0.17
    const base = (da: number): [number, number] => [cx + Math.cos(a + da) * 27, cy + Math.sin(a + da) * 27]
    const tip: [number, number] = [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]
    tri(p, base(-d), base(d), tip, 'x')
    p.line(Math.round(base(-d)[0]), Math.round(base(-d)[1]), Math.round(tip[0]), Math.round(tip[1]), 'y')
    p.line(Math.round(base(d)[0]), Math.round(base(d)[1]), Math.round(tip[0]), Math.round(tip[1]), 'w')
  }
  p.disc(cx, cy, 29, { out: 'w', sh: 'w', base: 'x', lt: 'y', hi: 'y' })
  // face
  p.disc(cx - 1, cy + 1, 23, FUR)
  p.ellipse(cx - 10, cy + 12, 14, 10, 'r')
  p.ellipse(cx - 10, cy + 12, 13, 9, 'q')
  p.ellipse(cx - 12, cy + 10, 10, 6, 'r')
  // laughing mouth, fangs and tongue
  p.ellipse(cx - 12, cy + 20, 11, 7, 's')
  p.ellipse(cx - 12, cy + 22, 7, 4, 'u')
  for (const dx of [-20, -8]) tri(p, [cx + dx, cy + 14], [cx + dx + 4, cy + 14], [cx + dx + 2, cy + 20], 'r')
  // nose, eyes, brows
  p.rect(cx - 25, cy + 3, 8, 6, 'a')
  p.hline(cx - 24, cy + 3, 5, 'h')
  for (const [ex, ey] of [[cx - 13, cy - 9], [cx + 4, cy - 11]]) {
    p.ellipse(ex, ey, 5, 6, 'r')
    p.rect(ex - 2, ey - 2, 4, 5, 'f')
    p.put(ex - 1, ey - 2, 'j')
    p.line(ex - 6, ey - 8, ex + 5, ey - 10, 'w')
    p.line(ex - 6, ey - 9, ex + 5, ey - 11, 'w')
  }
  p.ellipse(cx - 2, cy + 6, 4, 3, 'v')
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

/** The curl that rises from the bow above the deck. */
function bowScroll(night: boolean): Sprite {
  const W = 46
  const H = 66
  const p = new Pix(W, H, 1)
  // stem
  p.vcyl(30, 28, 10, 38, WOOD)
  // spiral: radius shrinks as the angle grows
  const cxs = 22
  const cys = 24
  for (let t = 0; t <= 1; t += 0.004) {
    const a = Math.PI * 0.2 + t * Math.PI * 3.1
    const r = 20 - t * 15
    const x = cxs + Math.cos(a) * r
    const y = cys + Math.sin(a) * r
    // the arm thickens toward the stem
    const th = 2.4 - t * 0.9
    p.disc(x, y, th, { out: 'b', sh: 'b', base: 'c', lt: 'd', hi: 'e' })
  }
  p.disc(cxs + 1, cys + 1, 2.2, GOLD)
  p.box(26, 24, 18, 6, GOLD)
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

// ------------------------------------------------------------------ stairs and ladders

function stairs(w: number, h: number, dir: 'up-right' | 'up-left', night = false): Sprite {
  const rise = 8
  const n = Math.max(1, Math.round(h / rise))
  const p = new Pix(w, h + STAIR_RAIL, 1)
  const base = STAIR_RAIL + h
  const lineY = (x: number): number => Math.round(base - (x * h) / w)
  for (let x = 0; x < w; x++) {
    const step = Math.min(n - 1, Math.floor((x * n) / w))
    const treadTop = Math.round(base - ((step + 1) * h) / n)
    const bot = Math.min(h + STAIR_RAIL - 1, lineY(x) + 9)
    for (let y = treadTop; y <= bot; y++) {
      const d = y - treadTop
      const firstCol = Math.floor((x * n) / w) !== Math.floor(((x - 1) * n) / w)
      p.soft(x, y, d === 0 ? 'e' : d === 1 ? 'd' : firstCol ? 'b' : y > bot - 2 ? 'b' : 'c')
    }
  }
  // handrail: a rail parallel to the treads, on turned posts
  const rail = (x: number): number => lineY(x) - 22
  for (let x = 2; x < w - 1; x++) {
    p.soft(x, rail(x), 'e')
    p.soft(x, rail(x) + 1, 'd')
    p.soft(x, rail(x) + 2, 'b')
  }
  const post = (x: number): void => {
    const step = Math.min(n - 1, Math.floor((x * n) / w))
    const treadTop = Math.round(base - ((step + 1) * h) / n)
    for (let y = rail(x) + 3; y < treadTop; y++) p.soft(x, y, 'c')
  }
  for (let x = 3; x < w - 2; x += Math.max(8, Math.round(w / n) * 2)) post(x)
  for (const x of [1, w - 3]) {
    for (let y = rail(x) - 3; y < Math.round(base - (Math.min(n - 1, Math.floor((x * n) / w)) * h) / n - h / n); y++) {
      p.soft(x, y, 'c')
      p.soft(x + 1, y, 'b')
    }
    p.disc(x + 1, rail(x) - 4, 2, GOLD)
  }
  const s = outline(p.sprite())
  const out = dir === 'up-left' ? mirror(s) : s
  return night ? nightify(out) : out
}

function ladder(w: number, h: number): Sprite {
  const p = new Pix(w, h, 1)
  p.vcyl(0, 0, 3, h, WOOD)
  p.vcyl(w - 3, 0, 3, h, WOOD)
  for (let y = 6; y < h - 2; y += 7) {
    p.hline(3, y, w - 6, 'd')
    p.hline(3, y + 1, w - 6, 'c')
    p.hline(3, y + 2, w - 6, 'a')
  }
  return outline(p.sprite())
}

/** One sprite per connector that has art: `conn_<id>`. Stairs get STAIR_RAIL extra rows above for the handrail. */
export function connectorSprites(): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const c of CONNECTORS) {
    if (!c.art) continue
    out.push({ name: `conn_${c.id}`, sprite: c.kind === 'stairs' ? stairs(c.art.w, c.art.h, c.art.dir ?? 'up-right') : ladder(c.art.w, c.art.h) })
  }
  return out
}

/** The mast stands from the nest down to the deck. */
const mastHeight = (): number => STRUCTURE.mast.bottom - STRUCTURE.mast.y

export function shipStructureSprites(): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const night of [false, true]) {
    const tag = night ? 'night' : 'day'
    out.push({ name: `hull_${tag}`, sprite: hullSprite(night) })
    out.push({ name: `mast_${tag}`, sprite: mast(mastHeight(), night) })
    out.push({ name: `yard_${tag}`, sprite: yard(STRUCTURE.yardW, night) })
    out.push({ name: `sail_${tag}`, sprite: sail(STRUCTURE.sailW, STRUCTURE.sailH, night) })
    out.push({ name: `rigging_${tag}`, sprite: rigging(night) })
    out.push({ name: `nest_roof_${tag}`, sprite: nestRoof(night) })
    out.push({ name: `nest_base_${tag}`, sprite: nestBase(night) })
    out.push({ name: `dome_${tag}`, sprite: dome(night) })
    out.push({ name: `chimney_${tag}`, sprite: chimney(night) })
    out.push({ name: `figurehead_${tag}`, sprite: figurehead(night) })
    out.push({ name: `bow_scroll_${tag}`, sprite: bowScroll(night) })
  }
  out.push(...connectorSprites())
  return out
}
