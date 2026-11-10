import { compose, mirror, rep, sprite, type Sprite } from './sprite'
import type { NamedSprite } from './tiles'

/**
 * Galley props. Each is hand-drawn from small parts as text grids (see sprite.ts for the format).
 * Every prop leaves a 1px transparent margin where an outline should go; the build adds the
 * outline and a cast shadow. Light comes from the top-left: highlights on top/left edges, shade bottom/right.
 */

// ---------------------------------------------------------------- fridge (28x47)

const fridge = sprite('fridge', 28, [
  '.*',
  '.3 j* h3 g .3',
  '.2 j i* h4 g .2',
  '. j* h4 g .',
  '. j i* h4 g .',
  '. j i2 y x4 w i* h4 g .', // brass maker's plate
  '. j i2 w6 i* h4 g .',
  '. j i* h4 g .',
  ...rep(5, '. j i* h g i3 h4 g .'), // freezer handle
  '. j i* h4 g .',
  '. j i* h4 g .',
  '. j h* g5 .',
  '. f* .', // door seam
  '. j* h4 g .',
  '. j i* h4 g .',
  '. j i* h4 g .',
  '. j i3 j6 i* h g i3 h4 g .', // note pinned with magnets
  '. j i3 j h j h j h i* h g i3 h4 g .',
  '. j i3 j6 i* h g i3 h4 g .',
  '. j i3 h6 i* h g i3 h4 g .',
  '. j i* h g i3 h4 g .',
  '. j i4 v u2 i* h g i3 h4 g .',
  '. j i4 u3 i* h g i3 h4 g .',
  '. j i4 t3 i* h g i3 h4 g .',
  '. j i* h g i3 h4 g .',
  '. j i8 n m2 i* h g i3 h4 g .',
  '. j i8 m3 i* h g i3 h4 g .',
  '. j i8 l3 i* h g i3 h4 g .',
  ...rep(3, '. j i* h g i3 h4 g .'),
  ...rep(7, '. j i* h4 g .'),
  '. j h* g5 .',
  '. f g* f .',
  '.2 f3 .* f3 .2',
  '.2 f3 .* f3 .2',
  '.*'
])

// ---------------------------------------------------------------- barrel (18x24)

const barrel = sprite('barrel', 18, [
  '.*',
  '.4 e d* c b .4',
  '.3 e d* c2 b .3',
  '.2 j i* h2 .2',
  '.2 h* g2 .2',
  '.2 e d3 b d* c3 b c b .2',
  ...rep(11, '. e d3 b d* c3 b c2 b2 .'),
  '. j i* h2 .',
  '. h* g2 .',
  '. e d3 b d* c3 b c2 b2 .',
  '.2 e d3 b d* c3 b c b .2',
  '.3 e d* c2 b .3',
  '.4 c* b .4',
  '.*'
])

// ---------------------------------------------------------------- crate of oranges (18x17)

const orange = sprite('orange', 5, ['. y x2 .', 'y x3 w', 'x3 w2', '. w3 .'])
const crateBox = sprite('crate_box', 18, [
  '. c e* b .',
  '. c i d* i b .',
  '. c d* b .',
  '. c b* .',
  '. a* .',
  '. c e* b .',
  '. c i d* i b .',
  '. c d* b .',
  '. c b* .',
  '. a* .'
])
const crate = compose('crate', 18, 17, [
  [orange, 4, 1],
  [orange, 10, 1],
  [orange, 2, 3],
  [orange, 7, 3],
  [orange, 12, 3],
  [crateBox, 0, 6]
])

// ---------------------------------------------------------------- stove + hood (36x70)

const pipe = sprite('pipe', 8, rep(19, 'j i3 h3 g'))
const collar = sprite('collar', 10, ['y x8 w', 'w*'])

const hoodRows: string[] = []
for (let i = 0; i <= 10; i++) {
  hoodRows.push(`.${11 - i} j i${9 + 2 * i} h3 g .${11 - i}`)
}
hoodRows[6] = '.5 j i8 y x4 w i7 h3 g .5' // nameplate
hoodRows[7] = '.4 j i8 w6 i9 h3 g .4'
hoodRows.push('. y x32 w .', '. w34 .')
const hood = sprite('hood', 36, hoodRows)

const ladle = sprite('ladle', 5, ['.2 x .2', ...rep(8, '.2 h .2'), '. i3 .', 'i h3 g', '. g3 .'])
const towel = sprite('towel', 7, [
  'y x5 w',
  'r q4 p o',
  'r q4 p o',
  'v u4 t o',
  'u5 t o',
  'r q4 p o',
  'r q4 p o',
  '. q4 p .'
])

const redPot = sprite('red_pot', 14, [
  '.6 y x .6',
  '. v u10 t .',
  '. t12 .',
  'v u12 t',
  'h u12 h',
  'v u12 t',
  'u13 t',
  't14'
])
const steelPot = sprite('steel_pot', 14, [
  '.6 i2 .6',
  '. j i10 g .',
  '. g12 .',
  'j i12 g',
  'h j i10 g h',
  'j i12 g',
  'i13 g',
  'h13 g'
])

const doorRows = [
  'j*',
  'j i2 y x* w i2 h', // brass oven handle
  'j i3 g* i3 h', // window frame
  'j i3 g h f* g i3 h', // glass with a glint
  'j i3 g f* g i3 h',
  'j i3 g w* g i3 h', // glow at the bottom of the oven (flames are animated on top)
  'j i3 g* i3 h',
  'j i* h',
  'j h* g'
]
const stoveBody = sprite('stove_body', 36, [
  '. j* g .',
  '. j i3 v u i5 v u i5 v u i5 v u i* h g .',
  '. j i3 u t i5 u t i5 u t i5 u t i* h g .',
  ...doorRows.map((r) => `. j i2 ${r} i h g .`),
  '. g* .',
  '.2 f3 .* f3 .2'
])

const stoveHood = compose('stove_hood', 36, 70, [
  [pipe, 14, 0],
  [collar, 13, 15],
  [hood, 0, 19],
  [ladle, 1, 32],
  [towel, 28, 32],
  [redPot, 6, 48],
  [steelPot, 20, 48],
  [stoveBody, 0, 56]
])

/**
 * Where animated overlays sit, relative to the top-left of their parent sprite. Written into props.json
 * (`meta.anchors`) by the build so the renderer never hard-codes art coordinates.
 */
export const ANCHORS = {
  stove_flame: { parent: 'stove_hood', x: 9, y: 62 },
  stove_steam: { parent: 'stove_hood', x: 23, y: 38 }
} as const

const tongue3 = sprite('tongue3', 3, ['.y.', 'yxy', 'xwx'])
const tongue2 = sprite('tongue2', 3, ['.y.', 'xxx'])
const flame0 = compose('flame_0', 18, 3, [
  [tongue3, 1, 0],
  [tongue2, 5, 1],
  [tongue3, 8, 0],
  [tongue2, 12, 1],
  [tongue3, 14, 0]
])
const flame1 = compose('flame_1', 18, 3, [
  [tongue2, 1, 1],
  [tongue3, 4, 0],
  [tongue2, 8, 1],
  [tongue3, 11, 0],
  [tongue2, 15, 1]
])

const STEAM_COLS = [5, 4, 3, 4, 5, 4, 3, 4, 5, 4]
const steamFrame = (phase: number): Sprite =>
  sprite(
    'steam',
    8,
    STEAM_COLS.map((_, y) => {
      const c = STEAM_COLS[(y + phase) % STEAM_COLS.length]
      return `.${c - 1} i j .${8 - c - 1}`
    })
  )

// ---------------------------------------------------------------- counter (46x25)

const tomato = sprite('tomato', 5, ['. A u2 .', 'v u3 t', 'u4 t', '. t3 .'])
const board = sprite('board', 14, ['r q12 p', 'o*'])
const plates = sprite('plates', 10, ['.2 j6 .2', '. j i6 h .', '.2 h6 .2', '. j i6 h .', '. i h6 g .', '.2 g6 .2'])
const faucet = sprite('faucet', 6, ['y x4 w', 'y x .3 w', 'y x .3 x', ...rep(5, 'y x .4'), 'x2 .4'])
const sinkRim = sprite('sink_rim', 12, ['j i10 h', 'h* g'])

const counterBase = sprite('counter_base', 46, [
  '. e* .',
  '. e d* c .',
  '. d c* b .',
  '. m22 m22 .',
  '. m l2 k16 l2 k m l2 k16 l2 k .',
  '. m l2 k l12 y x m l2 k m l2 k y x l12 m l2 k .',
  '. m l2 k l12 x w m l2 k m l2 k x w l12 m l2 k .',
  '. m l2 k l14 m l2 k m l2 k l14 m l2 k .',
  '. m l2 m16 l2 k m l2 m16 l2 k .',
  '. k44 .',
  '. a* .'
])
const counter = compose('counter', 46, 22, [
  [counterBase, 0, 10],
  [tomato, 3, 4],
  [tomato, 8, 4],
  [board, 2, 8],
  [plates, 20, 4],
  [sinkRim, 33, 10],
  [faucet, 37, 1]
])

// ---------------------------------------------------------------- pan rack (34x24)

const chain = sprite('chain', 2, rep(3, 'i h', 'h g'))
const rail = sprite('rail', 32, ['y j30 y', 'x h30 x', 'w g30 w'])
const pan = sprite('pan', 11, [
  ...rep(5, '.4 d c .5'),
  '.3 j i3 h .3',
  '.2 i g5 h .2',
  '. i g7 h .',
  '. i g7 h .',
  '. i g7 h .',
  '. i g4 f3 h .',
  '. i f7 h .',
  '.2 h g5 g .2',
  '.3 g5 .3'
])
const brassPot = sprite('brass_pot', 10, [
  ...rep(4, '.4 d c .4'),
  '. y x6 w .',
  'y2 x7 w',
  'y x8 w',
  'y x8 w',
  'x9 w',
  '. w8 .'
])
const bulb = sprite('bulb', 5, ['.2 r .2', '. r q p .', 'r q2 p o'])
const garlic = compose('garlic', 6, 14, [
  [sprite('twine', 6, rep(14, '.3 o .2')), 0, 0],
  [bulb, 0, 2],
  [bulb, 1, 6],
  [bulb, 0, 10]
])
const panRack = compose('pan_rack', 34, 24, [
  [chain, 3, 0],
  [chain, 29, 0],
  [rail, 1, 6],
  [pan, 2, 9],
  [brassPot, 13, 9],
  [ladle, 23, 9],
  [garlic, 28, 9]
])

// ---------------------------------------------------------------- lantern (12x21, two glow frames)

const lanternFrame = (core: 0 | 1): Sprite =>
  sprite('lantern', 12, [
    ...rep(4, '.5 i h .5', '.5 h g .5'),
    '.4 y x2 w .4',
    '.3 y x4 w .3',
    '.2 w8 .2',
    '.2 x y6 w .2',
    core === 0 ? '.2 x y2 j2 y2 w .2' : '.2 x y3 j y2 w .2',
    core === 0 ? '.2 x y j4 y w .2' : '.2 x y2 j2 y2 w .2',
    core === 0 ? '.2 x y j4 y w .2' : '.2 x y2 j2 y2 w .2',
    core === 0 ? '.2 x y2 j2 y2 w .2' : '.2 x y3 j y2 w .2',
    '.2 x y6 w .2',
    '.2 w8 .2',
    '.3 y x4 w .3',
    '.4 w4 .4',
    '.5 w2 .5'
  ])

// ---------------------------------------------------------------- spice shelf (30x19)

const jar = (L: string, B: string, S: string, lid: string): Sprite =>
  sprite('jar', 6, [`. ${lid} x2 w .`, '. i4 .', `j ${L} ${B}2 ${S} i`, `j ${B}3 ${S} i`, `j ${B}3 ${S} i`, `j ${B}3 ${S} i`, `. ${S}4 .`])
const tin = sprite('tin', 6, [
  '. h4 .',
  'j h4 g',
  'j u4 t',
  'j y x3 t',
  'j u4 t',
  'j u4 t',
  'j u4 t',
  'j u4 t',
  'j t4 g',
  '. g4 .'
])
const shelf = compose('shelf_jars', 30, 19, [
  [sprite('plank', 28, ['e*', 'd*', 'b*']), 1, 14],
  [sprite('brackets', 28, ['.2 c b .19 c b .3', '.2 b .20 b .4']), 1, 17],
  [jar('v', 'u', 't', 'y'), 2, 7],
  [jar('y', 'x', 'w', 'i'), 9, 7],
  [jar('n', 'A', 'z', 'y'), 16, 7],
  [tin, 23, 4]
])

// ---------------------------------------------------------------- porthole (24x24)

/** [outer width, glass width] per row, top to bottom (22 rows, a circle). */
const PORT: Array<[number, number]> = [
  [6, 0], [10, 0], [14, 0], [16, 8], [18, 12], [20, 14], [20, 14], [22, 16], [22, 16], [22, 16], [22, 16],
  [22, 16], [22, 16], [22, 16], [22, 16], [20, 14], [20, 14], [18, 12], [16, 8], [14, 0], [10, 0], [6, 0]
]
const GLASS: Record<number, string> = {
  3: 'E8',
  4: 'E G11',
  5: 'E j G12',
  6: 'E G j G11',
  7: 'E G2 j G12',
  8: 'E G15',
  9: 'E G5 j4 G6',
  10: 'E G4 j2 G5 j2 G2',
  11: 'E F15',
  12: 'E F3 G3 F9',
  13: 'E F15',
  14: 'E F8 E7',
  15: 'E F4 E9',
  16: 'E F2 E11',
  17: 'E12',
  18: 'E8'
}
const portRows = PORT.map(([ow, gw], y) => {
  const pad = (24 - ow) / 2
  if (y === 0) return `.${pad} y x4 w .${pad}`
  if (y === 1) return `.${pad} y x3 j x4 w .${pad}` // top bolt
  if (y === 2) return `.${pad} y x12 w .${pad}`
  if (y === 19) return `.${pad} x w13 .${pad}`
  if (y === 20) return `.${pad} w4 h w5 .${pad}` // bottom bolt
  if (y === 21) return `.${pad} w6 .${pad}`
  const t = (ow - gw) / 2
  const lower = y >= 14
  let left = lower ? `x${t - 1} w` : `y x${t - 1}`
  let right = lower ? `w${t}` : `x w${t - 1}`
  if (y === 11) {
    left = 'y j x' // side bolts
    right = 'x j w'
  }
  return `.${pad} ${left} ${GLASS[y]} ${right} .${pad}`
})
const porthole = compose('porthole', 24, 24, [[sprite('porthole_ring', 24, portRows), 0, 1]])

// ---------------------------------------------------------------- menu board (28x24)

const menuFrame = sprite('menu_frame', 28, [
  '.*',
  '. e* b .',
  '. d* c .',
  ...rep(18, '. e d f* c b .'),
  '. c* b .',
  '. b* .',
  '.*'
])
const chalk = sprite('chalk', 22, [
  'f*',
  'f5 j2 f j2 f j2 f j2 f6', // header scribble
  'f2 i18 f2',
  'f*',
  'f2 j5 f2 i3 f* y f2',
  'f2 j3 f2 i5 f* y f2',
  'f2 j6 f2 i2 f* y f2',
  'f2 j4 f2 i4 f* y f2',
  'f*',
  'f2 i8 f*',
  'f*',
  ...rep(7, 'f*')
])
const chalkFish = sprite('chalk_fish', 8, ['.2 G3 .3', '. G5 . G', 'G j G5 .', '. G5 . G', '.2 G3 .3'])
const menuBoard = compose('menu_board', 28, 24, [
  [menuFrame, 0, 0],
  [chalk, 3, 3],
  [chalkFish, 12, 14]
])

// ---------------------------------------------------------------- bench + table (44 wide)

const bench = sprite('bench', 44, [
  '.*',
  '.2 v* u .2',
  '. v u* t .',
  '. v u* t .',
  '. v u* t .',
  '. t* .',
  '. e* c .',
  '. d* b .',
  '. c* a .',
  '.3 c b .* c b .3',
  '.3 c b .* c b .3',
  '.3 c b .* c b .3',
  '.*'
])

const FOLDS = 7
const tableBase = sprite('table_base', 44, [
  '. r* q .',
  '. r q* p .',
  '. q* p2 .',
  '. p* o .',
  `. ${'r q3 p2 '.repeat(FOLDS)}.`,
  `. ${'r q3 p2 '.repeat(FOLDS)}.`,
  `. ${'v u3 t2 '.repeat(FOLDS)}.`,
  `. ${'u2 t4 '.repeat(FOLDS)}.`,
  `. ${'r q3 p2 '.repeat(FOLDS)}.`,
  `. ${'r q3 p2 '.repeat(FOLDS)}.`,
  `. ${'q3 p3 '.repeat(FOLDS)}.`,
  `. ${'. p4 . '.repeat(FOLDS)}.`,
  '.4 c b .* c b .4',
  '.4 c b .* c b .4',
  '.4 b a .* b a .4',
  '.*'
])
const platter = sprite('platter', 16, [
  '.5 y x4 w .5',
  '.3 y x8 w .3',
  '.2 y x9 w .3',
  '.3 x2 A2 x2 w3 .4',
  'j i14 h',
  'h* g',
  '.2 g12 .2'
])
const goblet = sprite('goblet', 3, ['i u h', 'i u h', '. h .', '. h .', '. h .', 'h3'])
const candle = sprite('candle', 5, ['.2 y .2', '.2 x .2', '.2 r .2', '.2 q .2', '.2 q .2', '. y x w .', '.2 x .2', '. x3 .', 'x w3 w'])
const soup = sprite('soup', 8, ['. v u4 t .', 'j i6 h', '. j i4 h .', '.2 h4 .2', '.3 g2 .3'])
const table = compose('table', 44, 26, [
  [tableBase, 0, 10],
  [goblet, 3, 5],
  [goblet, 7, 5],
  [platter, 12, 4],
  [candle, 30, 2],
  [soup, 36, 6]
])

// ---------------------------------------------------------------- corner brace (16x15)

const brace = compose('brace', 16, 15, [
  [
    sprite('brace_body', 14, [
      'e d11 b .',
      'e d10 b .2',
      'e d y d7 b .3',
      'e d8 b .4',
      'e d7 b .5',
      'e d6 b .6',
      'e d y d3 b .7',
      'e d4 b .8',
      'e d3 b .9',
      'e d2 b .10',
      'e d b .11',
      'e b .12',
      'b .13'
    ]),
    1,
    1
  ]
])

// ---------------------------------------------------------------- export

export interface PropSprite extends NamedSprite {
  /** Gets an auto outline and a cast shadow. Overlays (flames, steam) opt out. */
  solid: boolean
}

export function propSprites(): PropSprite[] {
  return [
    { name: 'fridge', sprite: fridge, solid: true },
    { name: 'barrel', sprite: barrel, solid: true },
    { name: 'crate_oranges', sprite: crate, solid: true },
    { name: 'stove_hood', sprite: stoveHood, solid: true },
    { name: 'counter', sprite: counter, solid: true },
    { name: 'pan_rack', sprite: panRack, solid: true },
    { name: 'lantern_0', sprite: lanternFrame(0), solid: true },
    { name: 'lantern_1', sprite: lanternFrame(1), solid: true },
    { name: 'shelf_jars', sprite: shelf, solid: true },
    { name: 'porthole', sprite: porthole, solid: true },
    { name: 'menu_board', sprite: menuBoard, solid: true },
    { name: 'bench', sprite: bench, solid: true },
    { name: 'table', sprite: table, solid: true },
    { name: 'brace_l', sprite: brace, solid: true },
    { name: 'brace_r', sprite: mirror(brace), solid: true },
    { name: 'stove_flame_0', sprite: flame0, solid: false },
    { name: 'stove_flame_1', sprite: flame1, solid: false },
    { name: 'steam_0', sprite: steamFrame(0), solid: false },
    { name: 'steam_1', sprite: steamFrame(3), solid: false },
    { name: 'steam_2', sprite: steamFrame(6), solid: false }
  ]
}

/** The 12 distinct galley props (the brief allows 6-12). Structure pieces such as braces are not props. */
export const GALLEY_PROP_TYPES = [
  'fridge',
  'shelf_jars',
  'barrel',
  'crate_oranges',
  'porthole',
  'stove_hood',
  'pan_rack',
  'counter',
  'lantern',
  'bench',
  'table',
  'menu_board'
] as const
