import { compose, rep, sprite, type Sprite } from './sprite'
import { wallVariants } from './wear'

/**
 * Structure tiles: walls, floors, deck bands, hull, sky, sea. Tiles are NOT auto-outlined
 * (they are meant to butt against each other); darkest shades are drawn by hand where needed.
 * All art is on the 16px grid. See design/STYLE.md.
 */

// ----- helpers (build-time only; they produce pixels, not runtime shapes) -----

const cat = (name: string, ...parts: Sprite[]): Sprite => {
  const w = parts.reduce((s, p) => s + p.w, 0)
  const h = parts[0].h
  let x = 0
  const layers = parts.map((p) => {
    const l = [p, x, 0] as const
    x += p.w
    return l
  })
  return compose(name, w, h, layers)
}

const stack = (name: string, ...parts: Sprite[]): Sprite => {
  const w = parts[0].w
  const h = parts.reduce((s, p) => s + p.h, 0)
  let y = 0
  const layers = parts.map((p) => {
    const l = [p, 0, y] as const
    y += p.h
    return l
  })
  return compose(name, w, h, layers)
}

const rotateX = (s: Sprite, n: number): Sprite => ({
  w: s.w,
  h: s.h,
  px: s.px.map((r) => r.map((_, x) => r[(x - n + s.w * 4) % s.w]))
})

/** A solid band `h` rows tall. */
const solid = (key: string, w: number, h: number): Sprite => sprite('solid', w, rep(h, `${key}*`))

/** 4-row dithered transition from colour a (above) to b (below), ordered 25/50/50/75% b. */
const ditherBand = (a: string, b: string, w: number): Sprite =>
  sprite('band', w, [
    `${a}3 ${b} `.repeat(w / 4),
    `${a} ${b} `.repeat(w / 2),
    `${b} ${a} `.repeat(w / 2),
    `${b}3 ${a} `.repeat(w / 4)
  ])

const recolor = (s: Sprite, map: Record<string, string>): Sprite => ({
  w: s.w,
  h: s.h,
  px: s.px.map((r) => r.map((c) => map[c] ?? c))
})

// ----- back wall: teal vertical planks (two variants so the pattern does not tile visibly) -----

export const wallTealA = sprite('wall_teal_a', 16, [
  'k m l6 k m l6',
  'k m l i l4 k m l4 i l',
  'k m l6 k m l2 k l3',
  'k m l3 k l2 k m l2 k l3',
  'k m l3 k l2 k m l6',
  'k m l6 k m l k l4',
  'k m l6 k m l k l4',
  'k m l6 k m l6',
  'k m l2 k2 l2 k m l6',
  'k m l2 k2 l2 k m l5 k',
  'k m l2 k l3 k m l5 k',
  'k m l6 k m l6',
  'k m l6 k m k l5',
  'k m l6 k m k l5',
  'k m l i l4 k m l4 i l',
  'k m l6 k m l6'
])

export const wallTealB = sprite('wall_teal_b', 16, [
  'k m l6 k m l6',
  'k m l4 i l k m l i l4',
  'k m l2 k l3 k m l6',
  'k m l2 k l3 k m l3 k l2',
  'k m l6 k m l3 k l2',
  'k m l6 k m l6',
  'k m l5 k k m l6',
  'k m l5 k k m l6',
  'k m l6 k m l2 k2 l2',
  'k m l6 k m l2 k2 l2',
  'k m l6 k m l3 k l2',
  'k m k l5 k m l6',
  'k m k l5 k m l6',
  'k m l6 k m l6',
  'k m l4 i l k m l i l4',
  'k m l6 k m l6'
])

// ----- trim -----

export const chairRail = sprite('chair_rail', 16, ['e*', 'd*', 'c*', 'a*'])
export const baseboard = sprite('baseboard', 16, ['c*', 'b*', 'b*', 'a*'])

/** Subway-tile dado: 8×6 ceramics in running bond, one teal accent per row. */
const brickCream = sprite('brick', 8, ['r7 o', 'r q6 o', 'q7 o', 'q6 p o', 'q5 p2 o', 'o*'])
const brickTeal = sprite('brick', 8, ['n7 k', 'n m6 k', 'm7 k', 'm6 l k', 'm5 l2 k', 'o*'])
const dadoRow = cat('dado_row', brickCream, brickTeal)
export const wainscot = stack('wainscot', dadoRow, rotateX(dadoRow, 4))

// ----- floor face: squashed 8×4 checker (gives 2.5D depth) -----

// mint checker: light/mid teal with a darker front edge, so the floor sits in the wall's colour family
const floorA = sprite('floor_a', 8, ['n7 m', 'n7 m', 'n7 m', 'm*'])
const floorB = sprite('floor_b', 8, ['m7 l', 'm7 l', 'm7 l', 'l*'])
export const floorChecker = stack('floor_checker', cat('r0', floorA, floorB), cat('r1', floorB, floorA), cat('r2', floorA, floorB))

// ----- deck band: plank layer + riveted steel girder (the visible ceiling beam / floor thickness) -----

export const deckBand = sprite('deck_band', 16, [
  'e*',
  'd15 b',
  'c15 b',
  'c15 b',
  'b*',
  'a*',
  'j*',
  'i*',
  'h*',
  'g*',
  'g3 i g7 i g4',
  'g3 h g7 h g4',
  'g*',
  'h*',
  'g*',
  'f*'
])

/** Dithered ambient-occlusion under the girder. Draw over the wall. */
export const aoUnder = sprite('ao_under', 16, [
  `${'f . '.repeat(8)}`,
  `${'. f '.repeat(8)}`,
  `${'f .3 '.repeat(4)}`,
  `${'.2 f . '.repeat(4)}`
])

export const ditherDark = sprite('dither_dark', 16, rep(8, 'f . '.repeat(8), '. f '.repeat(8)))

/** Riveted steel bulkhead plate: highlight top/left, shadow bottom/right. Used for adjoining spaces. */
const bulkheadPanel = 'f h g13 f'
const bulkheadRivets = 'f h g2 h g8 h g f'
export const bulkhead = sprite('bulkhead', 16, [
  'f*',
  'f h14 f',
  bulkheadPanel,
  bulkheadRivets,
  ...rep(8, bulkheadPanel),
  bulkheadRivets,
  bulkheadPanel,
  'f g14 f',
  'g*'
])

/** Ceiling conduit run with a coupling every 16px (tile horizontally). Barotrauma-style clutter. */
export const pipeRun = sprite('pipe_run', 16, ['f*', 'j6 f2 j8', 'i6 f g i8', 'h6 f g h8', 'g6 f g g8', 'f*'])

/** Warm lamp glow as a pure dither (no transparency blending): checker core, sparse rim. */
function lightPool(w: number, h: number, key: string): Sprite {
  const px: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2)
      const dy = (y + 0.5 - h / 2) / (h / 2)
      const r = Math.sqrt(dx * dx + dy * dy)
      const on = r < 0.5 ? (x + y) % 2 === 0 : r < 1 ? x % 2 === 0 && y % 2 === 0 : false
      row.push(on ? key : '.')
    }
    px.push(row)
  }
  return { w, h, px }
}
export const lightPoolWall = lightPool(44, 36, 'n')

// ----- hull wall: horizontal planks seen in cross-section, lit from the left -----

const hullPlank = [
  'a b14 a',
  'a e3 d10 c a',
  'a e d3 c4 b c2 b3 a',
  'a e d3 c7 b3 a',
  'a e d3 c2 x c4 b3 a',
  'a e d3 c7 b3 a',
  'a e d3 c3 b c3 b3 a',
  'a e d3 c7 b3 a'
]
export const hullWall = sprite('hull_wall', 16, [...hullPlank, ...hullPlank])

// ----- bulkhead door frame (right edge of the galley): steel jamb + hazard stripe -----

const hazard = (r: number): string => ['x2 f', 'x f2', 'f2 x', 'f x2'][r % 4]
const jambRows: string[] = []
for (let y = 0; y < 80; y++) {
  if (y % 20 === 19) jambRows.push(`g9 ${hazard(y)}`)
  else if (y % 20 === 3 || y % 20 === 15) jambRows.push(`j i j i2 h2 g f ${hazard(y)}`)
  else jambRows.push(`j i4 h2 g f ${hazard(y)}`)
}
export const doorJamb = sprite('door_jamb', 12, jambRows)

export const doorHeader = sprite('door_header', 24, [
  'j*',
  'i*',
  'i3 j i18 j i',
  'h*',
  'g*',
  `${'x2 f2 '.repeat(6)}`,
  `${'x f2 x '.repeat(6)}`,
  `${'f2 x2 '.repeat(6)}`,
  `${'f x2 f '.repeat(6)}`,
  'g*',
  'f*',
  'f*'
])

// ----- sky + sea (all pixel art; no CSS gradients) -----

function skyTile(top: string, mid: string, low: string, stars: boolean): Sprite {
  const w = 64
  const s = stack(
    'sky',
    solid(top, w, 32),
    ditherBand(top, mid, w),
    solid(mid, w, 36),
    ditherBand(mid, low, w),
    solid(low, w, 36)
  )
  if (stars) {
    const pts: Array<[number, number, string]> = [
      [5, 6, 'j'], [21, 13, 'i'], [37, 4, 'j'], [52, 19, 'i'], [12, 27, 'i'], [45, 33, 'j'], [29, 41, 'i'],
      [60, 46, 'j'], [8, 53, 'i'], [33, 58, 'j'], [50, 66, 'i'], [18, 70, 'j'], [58, 8, 'y'], [26, 22, 'y']
    ]
    for (const [x, y, c] of pts) s.px[y][x] = c
  }
  return s
}
export const skyDay = skyTile('F', 'G', 'j', false)
export const skyNight = skyTile('f', 'g', 'E', true)

const crest = (shift: number): string[] => [
  shift === 0 ? 'G4 j2 G5 j2 G3' : 'G2 j2 G5 j2 G5',
  shift === 0 ? 'F2 G3 F4 G3 F4' : 'F4 G3 F4 G3 F2',
  'F*',
  shift === 0 ? 'F6 E2 F8' : 'F2 E2 F12',
  'F*',
  'F*',
  shift === 0 ? 'F3 E3 F10' : 'F9 E3 F4',
  'F*',
  'F*',
  'F*'
]
const seaBand = ditherBand('F', 'E', 16)
function seaTile(shift: 0 | 1): Sprite {
  const top = sprite('sea_top', 16, crest(shift))
  const deep = sprite('sea_deep', 16, [
    ...rep(4, 'E*'),
    shift === 0 ? 'E4 F2 E10' : 'E10 F2 E4',
    ...rep(5, 'E*'),
    shift === 0 ? 'E9 F E6' : 'E3 F E12',
    ...rep(5, 'E*')
  ])
  return stack('sea', top, seaBand, deep)
}
const NIGHT_SEA = { j: 'i', G: 'h', F: 'E', E: 'f' }
export const seaDay0 = seaTile(0)
export const seaDay1 = seaTile(1)
export const seaNight0 = recolor(seaDay0, NIGHT_SEA)
export const seaNight1 = recolor(seaDay1, NIGHT_SEA)

// ----- top context: lawn deck above the galley -----

export const grass = sprite('grass', 16, [
  '. A .2 A . A .3 A .2 A .2',
  'A2 n A3 n A3 n A3 n A',
  'A*',
  'A3 z2 A5 z2 A4',
  'A5 z A6 z A3',
  'z*',
  'z*',
  'k*'
])

export const railing = sprite('railing', 16, [
  'e*',
  'd*',
  'b*',
  ...rep(6, '. d .4 e d b .3 d .3'),
  'd*',
  'b*',
  '. d .4 e d b .3 d .3',
  '. d .4 e d b .3 d .3',
  'a*'
])

export const cloud = sprite('cloud', 28, [
  '.8 j6 .14',
  '.5 j12 .11',
  '.2 j20 .6',
  '. j24 .3',
  '. j4 i20 .3',
  '.2 i20 .6'
])

/** Floor runner that gives the walkway colour (Grand Gourmet carpets) and keeps the floor from reading empty. */
const diamonds = 'v u3 '.repeat(12)
export const rugRunner = sprite('rug_runner', 56, [
  '. s54 .',
  's t* s',
  's t q52 t s',
  `s t q u2 ${diamonds}q t s`,
  `s t q u ${diamonds}u q t s`,
  's t q52 t s',
  's t* s',
  '. s54 .'
])

export interface NamedSprite {
  name: string
  sprite: Sprite
}

// ----- room themes: recolours of the galley wall/dado plus a few extra floors (all GF32) -----

type KeyMap = Record<string, string>
export const THEMES = ['map', 'library', 'factory', 'engine', 'infirmary', 'helm', 'gym'] as const

const WALL_MAP: Record<(typeof THEMES)[number], KeyMap> = {
  map: { k: 'f', l: 'E', m: 'g', n: 'F', i: 'G' }, // navy chart-room wallpaper
  library: { k: 'a', l: 'b', m: 'c', n: 'd', i: 'c' }, // dark wood panelling
  factory: { k: 'f', l: 'g', m: 'h', n: 'i', i: 'j' }, // riveted steel
  engine: { k: 'f', l: 'f', m: 'g', n: 'h', i: 'h' }, // soot-dark steel
  infirmary: { k: 'o', l: 'p', m: 'q', n: 'r', i: 'j' }, // clean plaster
  helm: { k: 'b', l: 'c', m: 'd', n: 'e', i: 'e' }, // warm teak
  gym: { k: 'f', l: 'g', m: 'E', n: 'F', i: 'G' } // padded blue-steel
}
const DADO_MAP: Record<(typeof THEMES)[number], KeyMap> = {
  map: { n: 'G', m: 'F', l: 'E', k: 'E' },
  library: { r: 'e', q: 'd', p: 'c', o: 'b', n: 'v', m: 'u', l: 't', k: 's' },
  factory: { r: 'j', q: 'i', p: 'h', o: 'g', n: 'h', m: 'g', l: 'g', k: 'f' },
  engine: { r: 'i', q: 'h', p: 'g', o: 'f', n: 'g', m: 'g', l: 'f', k: 'f' },
  infirmary: { r: 'j', q: 'r', p: 'q', o: 'p' },
  helm: { r: 'e', q: 'd', p: 'c', o: 'b', n: 'd', m: 'c', l: 'b', k: 'a' },
  gym: { r: 'i', q: 'h', p: 'g', o: 'f', n: 'F', m: 'E', l: 'E', k: 'E' }
}

const floorWood = sprite('floor_wood', 16, [
  'd*',
  'c7 b c8',
  'c*',
  'b*',
  'd*',
  'c3 b c12',
  'c*',
  'b*',
  'd*',
  'c11 b c4',
  'c*',
  'b*'
])
const floorSteel = recolor(floorWood, { e: 'j', d: 'i', c: 'h', b: 'g', a: 'f' })
const floorCarpet = sprite('floor_carpet', 16, [
  't*',
  'u*',
  'u3 v u3 t u3 v u4',
  'u2 v u3 t u3 v u5',
  'u3 v u3 t u3 v u4',
  'u*',
  'u2 t u3 v u3 t u5',
  'u3 t u3 v u3 t u4',
  'u2 t u3 v u3 t u5',
  'u*',
  't*',
  's*'
])
const floorClean = recolor(floorChecker, { n: 'j', m: 'i', l: 'h' })
const floorLawn = sprite('floor_lawn', 16, [
  'A3 n A5 n A6',
  'A*',
  'A2 z A7 z A5',
  'A*',
  'A5 n A9 n',
  'A*',
  'A3 z A8 z A3',
  'A*',
  'z2 A5 z2 A5 z A',
  'z*',
  'z*',
  'k*'
])
const railSteel = recolor(chairRail, { e: 'j', d: 'i', c: 'h', a: 'g' })
const baseSteel = recolor(baseboard, { c: 'h', b: 'g', a: 'f' })

function themeTiles(): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const t of THEMES) {
    out.push({ name: `wall_${t}_a`, sprite: recolor(wallTealA, WALL_MAP[t]) })
    out.push({ name: `wall_${t}_b`, sprite: recolor(wallTealB, WALL_MAP[t]) })
    for (const v of wallVariants(wallTealA, wallTealB)) out.push({ name: `wall_${t}_${v.suffix}`, sprite: recolor(v.sprite, WALL_MAP[t]) })
    out.push({ name: `dado_${t}`, sprite: recolor(wainscot, DADO_MAP[t]) })
  }
  out.push(
    { name: 'floor_wood', sprite: floorWood },
    { name: 'floor_steel', sprite: floorSteel },
    { name: 'floor_carpet', sprite: floorCarpet },
    { name: 'floor_clean', sprite: floorClean },
    { name: 'floor_lawn', sprite: floorLawn },
    { name: 'rail_steel', sprite: railSteel },
    { name: 'base_steel', sprite: baseSteel }
  )
  return out
}

export function tileSprites(): NamedSprite[] {
  return [
    { name: 'wall_teal_a', sprite: wallTealA },
    { name: 'wall_teal_b', sprite: wallTealB },
    ...wallVariants(wallTealA, wallTealB).map((v) => ({ name: `wall_teal_${v.suffix}`, sprite: v.sprite })),
    { name: 'chair_rail', sprite: chairRail },
    { name: 'baseboard', sprite: baseboard },
    { name: 'wainscot', sprite: wainscot },
    { name: 'floor_checker', sprite: floorChecker },
    { name: 'deck_band', sprite: deckBand },
    { name: 'ao_under', sprite: aoUnder },
    { name: 'dither_dark', sprite: ditherDark },
    { name: 'bulkhead', sprite: bulkhead },
    { name: 'pipe_run', sprite: pipeRun },
    { name: 'light_pool', sprite: lightPoolWall },
    { name: 'hull_wall', sprite: hullWall },
    { name: 'door_jamb', sprite: doorJamb },
    { name: 'door_header', sprite: doorHeader },
    { name: 'sky_day', sprite: skyDay },
    { name: 'sky_night', sprite: skyNight },
    { name: 'sea_day_0', sprite: seaDay0 },
    { name: 'sea_day_1', sprite: seaDay1 },
    { name: 'sea_night_0', sprite: seaNight0 },
    { name: 'sea_night_1', sprite: seaNight1 },
    { name: 'grass', sprite: grass },
    { name: 'railing', sprite: railing },
    { name: 'cloud', sprite: cloud },
    { name: 'rug_runner', sprite: rugRunner },
    ...themeTiles()
  ]
}
