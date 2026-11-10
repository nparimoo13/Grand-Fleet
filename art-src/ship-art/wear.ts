import { clone, sprite, type Sprite } from './sprite'
import type { RoomProp } from './props-deck'

/**
 * Wear and grime: wall-plank variants (knots, butt joints, stains, nails, patched boards) and wall/floor decals.
 * Barotrauma's interiors read as lived-in because no two metres of wall match; these break the tile repetition.
 * Everything is palette-pure. The wall variants only use the teal wall's keys (k m l n i) so each theme's
 * recolour map carries them along.
 */

type Px = readonly [number, number]

function put(s: Sprite, x: number, y: number, k: string): void {
  if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.px[y][x] = k
}

/** 4x3 knot: dark ring, shaded centre. */
function knot(s: Sprite, x: number, y: number): void {
  for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]] as Px[]) put(s, x + dx, y + dy, 'k')
  put(s, x + 1, y + 1, 'l')
  put(s, x + 2, y + 1, 'k')
}

/** Horizontal butt joint across one plank (`w` px, starting at x). */
function joint(s: Sprite, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i++) {
    put(s, x + i, y, 'k')
    put(s, x + i, y + 1, 'm')
  }
}

/** Damp stain: a dithered dark patch with a couple of drips running down. */
function stain(s: Sprite, x: number, y: number, w: number, h: number, drips: number[]): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // thins out towards the bottom edge
      const dense = j < h - 2 ? (i + j) % 2 === 0 : (i + j) % 4 === 0
      if (dense) put(s, x + i, y + j, 'k')
    }
  }
  for (const d of drips) for (let j = 0; j < 3; j++) put(s, x + d, y + h + j - 1, 'k')
}

const nail = (s: Sprite, x: number, y: number): void => {
  put(s, x, y, 'i')
  put(s, x, y + 1, 'k')
}

/** A lighter replacement board nailed over a damaged plank. */
function patch(s: Sprite, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1
      put(s, x + i, y + j, edge ? 'k' : j === 1 || i === 1 ? 'n' : 'm')
    }
  }
  for (const [nx, ny] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]] as Px[]) put(s, x + nx, y + ny, 'k')
  put(s, x + 3, y + Math.floor(h / 2), 'l') // a grain mark
  put(s, x + 4, y + Math.floor(h / 2), 'l')
}

/** Wall-plank variants built from the two hand-drawn teal tiles. */
export function wallVariants(a: Sprite, b: Sprite): Array<{ suffix: string; sprite: Sprite }> {
  const c = clone(a)
  knot(c, 9, 3)
  joint(c, 1, 9, 7)
  nail(c, 3, 13)
  const d = clone(b)
  stain(d, 1, 0, 7, 6, [2, 5])
  joint(d, 9, 5, 7)
  knot(d, 2, 10)
  nail(d, 11, 13)
  const e = clone(a)
  patch(e, 8, 2, 7, 11)
  knot(e, 1, 5)
  nail(e, 4, 12)
  const f = clone(b)
  joint(f, 1, 12, 7)
  nail(f, 3, 3)
  nail(f, 12, 7)
  stain(f, 9, 9, 6, 5, [3])
  return [
    { suffix: 'c', sprite: c },
    { suffix: 'd', sprite: d },
    { suffix: 'e', sprite: e },
    { suffix: 'f', sprite: f }
  ]
}

// ---------------------------------------------------------------- decals

/** Builds a sprite from a width and a painter. `.` is transparent. */
function paint(w: number, h: number, fn: (s: Sprite) => void): Sprite {
  const s = sprite('decal', w, Array.from({ length: h }, () => '.*'))
  fn(s)
  return s
}

/** Grease and soot above the stove: sparse dark checker that fades upward. */
const grease = paint(44, 26, (s) => {
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 44; x++) {
      const cx = Math.abs(x - 22) / 22
      const fade = (y / 26) * (1 - cx * cx)
      const on = fade > 0.55 ? (x + y) % 2 === 0 : fade > 0.3 ? x % 2 === 0 && y % 2 === 0 : fade > 0.15 ? (x + y) % 4 === 0 && x % 2 === 0 : false
      if (on) put(s, x, y, 'k')
    }
  }
})

/** Rust run: orange-brown streaks under a pipe joint. */
const rustRun = paint(9, 22, (s) => {
  for (const [x, len] of [[1, 14], [3, 20], [4, 9], [6, 17], [7, 7]] as Px[]) {
    for (let y = 0; y < len; y++) if (y < 3 || (y + x) % 3 !== 0) put(s, x, y, y > len - 4 ? 'b' : 'w')
  }
  put(s, 0, 0, 'w')
  put(s, 8, 0, 'w')
  put(s, 2, 1, 'x')
  put(s, 5, 1, 'x')
})

/** Floor scuffs and a wet patch: pale dashes and a dark dither blob. */
const floorScuff = paint(30, 8, (s) => {
  for (const [x, y, len] of [[1, 2, 5], [9, 5, 4], [16, 1, 6], [23, 4, 5], [12, 3, 3]] as Px[]) {
    for (let i = 0; i < len; i++) put(s, x + i, y, 'n')
  }
  for (let y = 4; y < 8; y++) for (let x = 3; x < 12; x++) if ((x + y) % 2 === 0) put(s, x, y, 'k')
})

/** Dark wet patch for floors. */
const wetPatch = paint(22, 6, (s) => {
  for (let y = 0; y < 6; y++) {
    const half = Math.round(10 * Math.sqrt(1 - ((y - 2.5) / 3) ** 2))
    for (let x = 11 - half; x < 11 + half; x++) if ((x + y) % 2 === 0) put(s, x, y, 'k')
  }
})

/** Barnacle-like scale and moss: for the waterline (green flecks). */
const mossPatch = paint(16, 10, (s) => {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 8, (y - 7) * 1.4)
      if (d < 7 && (x * 7 + y * 3) % 4 !== 0) put(s, x, y, d < 4 ? 'A' : 'z')
    }
  }
})

const vent = sprite('vent', 14, [
  '. f12 .',
  'f j12 f',
  'f i g10 h f',
  'f i f2 g f2 g f2 g2 h f',
  'f i g10 h f',
  'f i f2 g f2 g f2 g2 h f',
  'f i g10 h f',
  'f h12 f',
  '. f12 .'
])

const junctionBox = sprite('junction_box', 10, [
  '. f8 .',
  'f j8 f',
  'f i2 u2 i4 f',
  'f i8 f',
  'f h2 f4 h2 f',
  'f h2 f4 h2 f',
  'f g8 f',
  '. f8 .'
])

/** Vertical conduit with clamps and a gate valve, wall-mounted. */
const pipeVert = sprite('pipe_vert', 6, [
  '. f4 .',
  'f j i g f .',
  'f j i g f .',
  'f2 h2 f2',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f2 h2 f2',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f2 h2 f2',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f j i g f .',
  'f2 h2 f2',
  'f j i g f .',
  'f j i g f .',
  '. f4 .'
])

/**
 * Fairy lights: a wire in three swags of 32px with a warm bulb every 8px. The bulbs are painted lit; the
 * lighting pass adds the pool of light around each one and makes them twinkle.
 */
const stringLights = paint(96, 11, (s) => {
  for (let x = 0; x < 96; x++) {
    const wireY = 1 + Math.round(4 * Math.sin((Math.PI * (x % 32)) / 32))
    put(s, x, wireY, 'f')
    if (x % 8 === 0 && x % 32 !== 0) {
      put(s, x, wireY + 1, 'f') // cap
      put(s, x + 1, wireY + 1, 'f')
      put(s, x, wireY + 2, 'y')
      put(s, x + 1, wireY + 2, 'x')
      put(s, x, wireY + 3, 'x')
      put(s, x + 1, wireY + 3, 'w')
      put(s, x, wireY + 2, 'r')
    }
  }
})

export function wearSprites(): RoomProp[] {
  const decal = (name: string, s: Sprite): RoomProp => ({ name, sprite: s, solid: false })
  const solid = (name: string, s: Sprite): RoomProp => ({ name, sprite: s, solid: true })
  return [
    decal('decal_grease', grease),
    decal('decal_rust_run', rustRun),
    decal('decal_floor_scuff', floorScuff),
    decal('decal_wet_patch', wetPatch),
    decal('decal_moss', mossPatch),
    decal('string_lights', stringLights),
    solid('vent_grate', vent),
    solid('junction_box', junctionBox),
    solid('pipe_vert', pipeVert)
  ]
}
