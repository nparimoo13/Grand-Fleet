import { FONT_SPECIAL_NAMES } from '../../shared/ship-font'
import { compose, rep, sprite, type Sprite } from './sprite'
import type { NamedSprite } from './tiles'

/** Status bubbles, selection arrow, plaque pieces and the 3x5 pixel font. */

// ---------------------------------------------------------------- speech bubbles (16x15, tail bottom-left)

const bubbleBody = sprite('bubble', 16, [
  '.*',
  '.3 j10 .3',
  '.2 j12 .2',
  ...rep(6, '. j14 .'),
  '.2 j12 .2',
  '.3 j10 .3',
  '.5 j3 .8',
  '.5 j2 .9',
  '.5 j .10',
  '.*'
])

const cog0 = sprite('cog0', 7, ['.3 l .3', '.2 m l2 .2', '. m j3 l .', 'm l j3 l2', '. l j3 l .', '.2 l3 .2', '.3 l .3'])
const cog1 = sprite('cog1', 7, ['.7', '. m l4 .', '. m j3 l .', '. l j3 l .', '. l j3 l .', '. l5 .', '.7'])
const bang = sprite('bang', 2, ['y x', 'x x', 'x w', 'x w', '.2', 'x w'])
const cross = sprite('cross', 5, ['u .3 u', '. u . u .', '.2 u .2', '. u . u .', 'u .3 t'])
const zzz = sprite('zzz', 4, ['g4', '.2 g .', '. g .2', 'g4'])

function bubble(name: string, glyph: Sprite): NamedSprite {
  const x = 1 + Math.floor((14 - glyph.w) / 2)
  const y = 1 + Math.floor((10 - glyph.h) / 2)
  return { name, sprite: compose(name, 16, 15, [[bubbleBody, 0, 0], [glyph, x, y]]) }
}

const arrow = compose('select_arrow', 9, 6, [[sprite('arrow', 7, ['y x5 w', '. y x3 w .', '.2 y x w .2', '.3 x .3']), 1, 1]])

// ---------------------------------------------------------------- plaque (11px tall, 9-slice horizontally)

const plaqueLeft = sprite('plaque_l', 3, ['.2 a', '. a x', ...rep(7, 'a x b'), '. a x', '.2 a'])
const plaqueMid = sprite('plaque_m', 1, ['a', 'x', ...rep(7, 'b'), 'x', 'a'])
const plaqueRight = sprite('plaque_r', 3, ['a .2', 'x a .', ...rep(7, 'b x a'), 'x a .', 'a .2'])

// ---------------------------------------------------------------- 3x5 font (r = cream)

const GLYPHS: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#.#|###|###|#.#|#.#',
  N: '##.|#.#|#.#|#.#|#.#',
  O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###',
  V: '#.#|#.#|#.#|#.#|.#.',
  W: '#.#|#.#|###|###|#.#',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###',
  '1': '.#.|##.|.#.|.#.|###',
  '2': '##.|..#|.#.|#..|###',
  '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.',
  '6': '.##|#..|###|#.#|###',
  '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###',
  '9': '###|#.#|###|..#|##.',
  amp: '.#.|#.#|.#.|#.#|.##',
  apos: '.#.|.#.|...|...|...',
  dash: '...|...|###|...|...',
  dot: '...|...|...|...|.#.',
  comma: '...|...|...|.#.|#..',
  colon: '...|.#.|...|.#.|...',
  bang: '.#.|.#.|.#.|...|.#.',
  q: '##.|..#|.#.|...|.#.'
}

function glyphSprite(name: string, spec: string): Sprite {
  return sprite(name, 3, spec.split('|').map((r) => r.replace(/#/g, 'r')))
}

export function uiSprites(): NamedSprite[] {
  for (const n of FONT_SPECIAL_NAMES) if (!(n in GLYPHS)) throw new Error(`font glyph missing for "${n}"`)
  return [
    bubble('bubble_working_0', cog0),
    bubble('bubble_working_1', cog1),
    bubble('bubble_waiting', bang),
    bubble('bubble_error', cross),
    bubble('bubble_idle', zzz),
    { name: 'select_arrow', sprite: arrow },
    { name: 'plaque_l', sprite: plaqueLeft },
    { name: 'plaque_m', sprite: plaqueMid },
    { name: 'plaque_r', sprite: plaqueRight },
    ...Object.entries(GLYPHS).map(([k, v]) => ({ name: `font_${k}`, sprite: glyphSprite(`font_${k}`, v) }))
  ]
}

/** UI sprites that get the auto outline (bubbles, arrow). Plaque pieces and glyphs are drawn flat. */
export const UI_OUTLINED = new Set([
  'bubble_working_0',
  'bubble_working_1',
  'bubble_waiting',
  'bubble_error',
  'bubble_idle',
  'select_arrow'
])
