import { Pix, WOOD } from './pix'
import { jolly } from './emblem'
import { nightify } from './night'
import { T, outline, sprite, type Sprite } from './sprite'
import { shipStructureSprites } from './ship'
import type { NamedSprite } from './tiles'
import { HORIZON_Y, WORLD_H, WORLD_W } from '../../src/ship/room-defs'

/**
 * The world around the rooms: sky, sun/moon, clouds, sea, flag and cannon ports. The ship itself (hull with its
 * beams and cut-outs, mast, sail, stairs, figurehead) is built in ship.ts from the layout in src/ship. Everything is
 * generated at build time from the GF32 palette into assets/ship/world.png, so the scene composes pixels from a
 * sheet like every other layer. Light comes from the top-left; every solid shape gets a 1px outline.
 *
 * World space (1024x576) and its landmarks live in src/ship/room-defs.ts; they are re-exported here for the build.
 */

export { HORIZON_Y, WORLD_H, WORLD_W }

const hash = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) % 1000
}

// ------------------------------------------------------------------ sky, sun, moon, clouds

function skyColumn(night: boolean): Sprite {
  const h = HORIZON_Y
  const p = new Pix(64, h, 0)
  const [c0, c1, c2] = night ? ['f', 'g', 'E'] : ['F', 'G', 'j']
  const b1 = Math.round(h * 0.33)
  const b2 = Math.round(h * 0.64)
  p.rect(0, 0, 64, h, c0)
  p.rect(0, b1 + 16, 64, b2 - b1 - 16, c1)
  p.rect(0, b2 + 16, 64, h - b2 - 16, c2)
  // 50% checker bands between the colour steps, with a ragged transition (4 stages)
  for (const [y0, from, to] of [[b1, c0, c1], [b2, c1, c2]] as const) {
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 64; i++) {
        const stage = Math.floor(j / 4)
        const on = stage === 0 ? (i % 4 === 0 && j % 2 === 0) : stage === 1 ? (i + j) % 2 === 0 && (i % 2 === 0) : stage === 2 ? (i + j) % 2 === 0 : (i + j) % 2 === 0 || (i % 2 === 0 && j % 2 === 1)
        p.put(i, y0 + j, on ? to : from)
      }
    }
  }
  return p.sprite()
}

function stars(): Sprite {
  const p = new Pix(WORLD_W, HORIZON_Y - 30, 0)
  for (let n = 0; n < 170; n++) {
    const x = hash(n, 1) % WORLD_W
    const y = hash(n, 2) % (HORIZON_Y - 60)
    const k = hash(n, 3) % 9 === 0 ? 'y' : hash(n, 3) % 3 === 0 ? 'j' : 'i'
    p.soft(x, y, k)
    if (n % 11 === 0) {
      p.soft(x - 1, y, 'h')
      p.soft(x + 1, y, 'h')
      p.soft(x, y - 1, 'h')
      p.soft(x, y + 1, 'h')
    }
  }
  return p.sprite()
}

function sun(): Sprite {
  const p = new Pix(44, 44, 0)
  // halo: a dithered ring of the sky's own light blue, then the shaded disc
  for (let j = 0; j < 44; j++) {
    for (let i = 0; i < 44; i++) {
      const d = Math.hypot(i - 21.5, j - 21.5)
      if (d > 14 && d <= 21 && (i + j) % 2 === 0) p.put(i, j, d > 18 ? 'j' : 'y')
    }
  }
  p.disc(22, 22, 13, { out: 'x', sh: 'x', base: 'y', lt: 'y', hi: 'r' })
  // short rays, like the reference's sun
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    p.line(Math.round(21.5 + Math.cos(a) * 15), Math.round(21.5 + Math.sin(a) * 15), Math.round(21.5 + Math.cos(a) * 20), Math.round(21.5 + Math.sin(a) * 20), 'y')
  }
  return p.sprite()
}

function moon(): Sprite {
  const p = new Pix(30, 30, 0)
  p.disc(15, 15, 11, { out: 'h', sh: 'h', base: 'i', lt: 'j', hi: 'j' })
  p.rect(10, 12, 3, 2, 'h')
  p.rect(17, 18, 3, 3, 'h')
  p.put(14, 20, 'h')
  p.put(19, 10, 'h')
  return p.sprite()
}

function cloud(w: number, h: number, seed: number): Sprite {
  const p = new Pix(w, h, 0)
  const bumps = Math.max(3, Math.floor(w / 14))
  for (let n = 0; n < bumps; n++) {
    const cx = Math.round(((n + 0.5) / bumps) * w)
    const rad = Math.round(h * (0.38 + ((hash(n, seed) % 30) / 100)))
    const cy = h - rad - 1 - (hash(n, seed + 7) % 3)
    p.disc(cx, cy, rad, { out: 'i', sh: 'i', base: 'j', lt: 'j', hi: 'j' })
  }
  // flat underside and a shaded belly in the sky's own pale blue
  for (let x = 0; x < w; x++) {
    p.soft(x, h - 1, 'i')
    if (p.get(x, h - 2) !== T) p.soft(x, h - 2, x % 2 === 0 ? 'i' : 'j')
  }
  return p.sprite()
}

// ------------------------------------------------------------------ sea

function seaFill(shift: 0 | 1, night: boolean): Sprite {
  const p = new Pix(16, 16, 0)
  const base = night ? 'f' : 'E'
  const fleck = night ? 'E' : 'F'
  p.rect(0, 0, 16, 16, base)
  const o = shift === 0 ? 0 : 8
  for (const [x, y, w] of [[(2 + o) % 16, 3, 3], [(9 + o) % 16, 9, 4], [(5 + o) % 16, 13, 2]] as const) {
    for (let i = 0; i < w; i++) p.put((x + i) % 16, y, fleck)
  }
  return p.sprite()
}

/** Foreground swell that hides the waterline: transparent above the crest. */
function foreWave(phase: number, night: boolean): Sprite {
  const w = 32
  const h = 22
  const p = new Pix(w, h, 0)
  const [foam, lit, base, deep] = night ? ['i', 'h', 'E', 'f'] : ['j', 'G', 'F', 'E']
  for (let x = 0; x < w; x++) {
    const top = 4 + Math.round(3 * Math.sin(((x + phase) / w) * Math.PI * 2)) + Math.round(1.2 * Math.sin(((x * 2 + phase * 2) / w) * Math.PI * 2))
    for (let y = top; y < h; y++) {
      const d = y - top
      p.put(x, y, d === 0 ? foam : d === 1 ? lit : d < 7 ? base : (x + y) % 2 === 0 ? deep : base)
    }
  }
  return p.sprite()
}

// ------------------------------------------------------------------ flag

function flag(frame: number, night: boolean): Sprite {
  const w = 40
  const h = 24
  const p = new Pix(w, h, 1)
  // cloth waves: each column shifts a little; light on top, shade underneath
  for (let x = 0; x < w; x++) {
    const dy = Math.round(1.6 * Math.sin(((x + frame * 6) / 12) * Math.PI))
    const hh = 18 - Math.floor(x / 14)
    for (let y = 0; y < hh; y++) p.soft(x, 2 + dy + y, y === 0 ? 'g' : 'f')
  }
  const dy0 = Math.round(1.6 * Math.sin(((14 + frame * 6) / 12) * Math.PI))
  jolly(p, 15, 11 + dy0, 'small', 'r')
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

/** Cannon port in the hull planking: a shut hatch with iron straps, or open with the muzzle showing. */
function gunport(open: boolean, night: boolean): Sprite {
  const p = new Pix(22, 16, 1)
  p.box(0, 0, 22, 16, WOOD)
  if (open) {
    p.rect(2, 2, 18, 12, 'f')
    p.hcyl(5, 5, 14, 6, { out: 'f', sh: 'f', base: 'g', lt: 'h', hi: 'i' })
    p.rect(17, 4, 3, 8, 'h')
    p.vline(17, 4, 8, 'i')
    p.rect(19, 7, 1, 2, 'f')
    p.put(4, 12, 'h')
  } else {
    p.rect(2, 2, 18, 12, 'b')
    for (const x of [7, 12, 17]) p.vline(x, 2, 12, 'a')
    p.hline(2, 2, 18, 'c')
    p.hline(2, 5, 18, 'g')
    p.hline(2, 10, 18, 'g')
    for (const x of [4, 9, 14]) {
      p.put(x, 5, 'h')
      p.put(x, 10, 'h')
    }
    p.ellipse(15, 8, 1, 1, 'h')
  }
  const s = outline(p.sprite())
  return night ? nightify(s) : s
}

/** Seagull, 11x4, three wing positions (up, level, down). Cream wings with a dark body spot and wing tips. */
const GULLS = [
  ['f.........f', 'rr...f...rr', '.rrr.r.rrr.', '...rrrrr...'],
  ['...........', '.rrr.f.rrr.', 'frrrrrrrrrf', '...rrrrr...'],
  ['...rrrrr...', '.rrr.f.rrr.', 'rr.......rr', 'f.........f']
]

export function worldSprites(): NamedSprite[] {
  const out: NamedSprite[] = [
    ...GULLS.map((rows, i) => ({ name: `gull_${i}`, sprite: sprite(`gull_${i}`, 11, rows) })),
    { name: 'sky_day', sprite: skyColumn(false) },
    { name: 'sky_night', sprite: skyColumn(true) },
    { name: 'stars', sprite: stars() },
    { name: 'sun', sprite: sun() },
    { name: 'moon', sprite: moon() },
    { name: 'cloud_l', sprite: cloud(72, 22, 3) },
    { name: 'cloud_m', sprite: cloud(46, 16, 9) },
    ...shipStructureSprites()
  ]
  for (const night of [false, true]) {
    const tag = night ? 'night' : 'day'
    for (const f of [0, 1]) {
      out.push({ name: `sea_fill_${tag}_${f}`, sprite: seaFill(f as 0 | 1, night) })
      out.push({ name: `fwave_${tag}_${f}`, sprite: foreWave(f * 12, night) })
      out.push({ name: `flag_${tag}_${f}`, sprite: flag(f, night) })
    }
  }
  for (const night of [false, true]) {
    const tag = night ? 'night' : 'day'
    out.push({ name: `gunport_closed_${tag}`, sprite: gunport(false, night) })
    out.push({ name: `gunport_open_${tag}`, sprite: gunport(true, night) })
  }
  return out
}
