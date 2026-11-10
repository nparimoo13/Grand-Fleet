import { BIG_CREW_IDS, bigCharacterSprites } from './characters-big'
import { CREW_BIG_IDS, crewCharacterSprites } from './characters-crew'
import { Pix, BLUE } from './pix'
import { compose, sprite, T, type Sprite } from './sprite'
import type { NamedSprite } from './tiles'

/**
 * Chibi crew, 16x24: head about half the height, 1px outline (added by the build), light from the top-left.
 * Frames are composed from hand-drawn parts so the identity stays consistent across the 2-frame idle
 * and 4-frame walk. Sprites face right; the scene mirrors them for left.
 *
 * Content must stay inside x 1..14 and y 1..22: the outline pass needs the 1px transparent margin.
 * Every crew member shares the skeleton (head, torso, two arms, legs) and swaps heads, outfits and props.
 */

// ------------------------------------------------------------ shared parts

const armFront = sprite('arm_front', 2, ['h g', 'h g', 'h g', 'D D', 'C D'])
const armBack = sprite('arm_back', 2, ['g f', 'g f', 'g f', 'C D', 'C C'])

const legsStand = sprite('legs_stand', 8, [...Array(4).fill('h g2 .2 h g2'), 'f3 .2 f3'])
const legsContactA = sprite('legs_contact_a', 10, [...Array(4).fill('g2 f .4 h g2'), 'f3 .4 f3'])
const legsContactB = sprite('legs_contact_b', 10, [...Array(4).fill('h g2 .4 g2 f'), 'f3 .4 f3'])
const legsPassA = sprite('legs_pass_a', 8, ['h g2 .2 h g2', 'h g2 .2 h g2', 'h g2 .2 h g2', 'h g2 .3 f2', 'f3 .5'])
const legsPassB = sprite('legs_pass_b', 8, ['h g2 .2 h g2', 'h g2 .2 h g2', 'h g2 .2 h g2', 'f2 .3 h g2', '.5 f3'])

type KeyMap = (key: string, row: number) => string

function recolor(s: Sprite, fn: KeyMap): Sprite {
  return { w: s.w, h: s.h, px: s.px.map((r, y) => r.map((k) => (k === T ? T : fn(k, y)))) }
}

const swap = (m: Record<string, string>): KeyMap => (k) => m[k] ?? k

interface Pose {
  /** Body drop in px (contact frames and the idle "breath" sit 1px lower). */
  dy: 0 | 1
  legs: Sprite
  /** Arm swing offsets. */
  armF?: number
  armB?: number
}

interface Extra {
  sprite: Sprite
  x: number
  /** Offset from the body drop: y = base + dy. */
  y: number
  layer: 'back' | 'front'
}

interface CharSpec {
  id: string
  head: Sprite
  headX?: number
  torso: Sprite
  torsoX?: number
  arms?: { front: KeyMap; back: KeyMap }
  legs: KeyMap
  extras?: Extra[]
}

// ---------------------------------------------------------------- heads (12 rows, up to 14 wide)

const sanjiHead = sprite('sanji_head', 12, [
  '.3 x6 .3',
  '. x y7 x2 .',
  'x y9 x2',
  'x y5 x D5',
  'x y4 x D3 f2 D', // curly brow
  'w x y x D5 f D2', // the visible eye; the fringe hides the other
  'w x3 D5 f D2',
  'w x2 D7 C D',
  '. w x D5 C D3',
  '.2 w D7 C .',
  '.3 C D4 C .3',
  '.4 C4 .4'
])

const luffyHead = sprite('luffy_head', 14, [
  '.4 y6 .4',
  '.3 y8 .3',
  '.3 u8 .3', // hat band
  'w x12 w', // brim
  '.2 f2 D6 f2 .2',
  '. D3 f D4 f D3 .', // eyes
  '. D3 s D8 .', // scar under the left eye
  '. D12 .',
  '. D3 f6 D3 .', // grin
  '. D4 r4 D4 .',
  '. C D10 C .',
  '.3 C8 .3'
])

const zoroHead = sprite('zoro_head', 12, [
  '.3 A6 .3',
  '. A3 n2 A4 z .',
  'A2 n A7 z A',
  'A D10 A',
  'D2 f2 D4 f2 D2', // stern brows
  'D3 f D4 f D3',
  'x D2 f D4 f D3', // gold earring
  'x D11',
  'D4 f4 D4',
  'C D10 C',
  '.2 C8 .2',
  '.4 C4 .4'
])

const namiHead = sprite('nami_head', 12, [
  '.3 x6 .3',
  '. x y3 x5 x .',
  'x y2 x8 w',
  'x w D8 w x',
  'x w D8 w x',
  'x w D f D3 f D2 w x',
  'x w D f D3 f D2 w x',
  'x w D8 w x',
  'x w D3 u2 D3 w x',
  'x w C D6 C w x',
  '. w2 C6 w2 .',
  '.2 w2 .4 w2 .2'
])

const robinHead = sprite('robin_head', 12, [
  '.3 f6 .3',
  '. f2 h f6 f .',
  'f h f9 f',
  'f12',
  'f2 D8 f2',
  'f2 D f D3 f D2 f2',
  'f2 D8 f2',
  'f2 D8 f2',
  'f2 D3 t2 D3 f2',
  'f2 C D6 C f2',
  '. f2 C6 f2 .',
  '.2 f2 .4 f2 .2'
])

const frankyHead = sprite('franky_head', 12, [
  '.2 G2 F4 G2 .2', // the pompadour
  '. G F8 E2',
  'F G F9 E',
  'F2 D8 E2',
  'D f10 D', // shades
  'D f2 j f4 j f2 D',
  'D12',
  'D12',
  'D2 f8 D2',
  'D2 r8 D2',
  'C D10 C',
  '.2 C8 .2'
])

const usoppHead = sprite('usopp_head', 12, [
  '.2 a b a2 b2 a b .2', // curls
  '. b a b2 a2 b a b2 .',
  'a2 y8 a2', // goggle strap
  'a y h2 y4 h2 y a', // goggle lenses
  'a b D8 b a',
  'D3 f D4 f D3',
  'D5 C2 D5', // long nose
  'D4 C4 D4',
  'D12',
  'D4 f4 D4',
  'C D10 C',
  '.2 C8 .2'
])

const jinbeHead = sprite('jinbe_head', 12, [
  '.3 f6 .3',
  '. f10 .',
  'f F2 G F6 E f',
  'F2 G F7 E F',
  'F2 f2 F4 f2 F2',
  'F3 f F4 f F3',
  'F12',
  'F5 E2 F5', // shark nose
  'F3 f6 F3',
  'F3 j6 F3', // teeth
  'E F10 E',
  '.2 E8 .2'
])

/** Chopper: a big pink hat, antlers and a blue nose. Drawn directly; the shape is easier to shape than to type. */
function chopperHead(): Sprite {
  const p = new Pix(14, 12, 0)
  const fur = { out: 'c', sh: 'c', base: 'd', lt: 'e', hi: 'e' }
  p.disc(7, 7.5, 5.4, fur)
  // antlers
  p.vline(1, 0, 3, 'd')
  p.put(2, 3, 'c')
  p.vline(12, 0, 3, 'c')
  p.put(11, 3, 'c')
  p.put(0, 0, 'd')
  p.put(13, 0, 'c')
  // hat
  p.ellipse(7, 2, 5.4, 3.2, 'u')
  p.hline(2, 5, 10, 't')
  p.put(4, 1, 'v')
  p.put(5, 0, 'v')
  p.put(3, 2, 'v')
  p.rect(6, 0, 2, 5, 'r') // white cross
  p.rect(4, 2, 6, 2, 'r')
  p.put(6, 0, 'v')
  // face
  p.rect(4, 7, 2, 3, 'f')
  p.rect(9, 7, 2, 3, 'f')
  p.put(4, 7, 'j')
  p.put(9, 7, 'j')
  p.disc(7, 10, 1.7, BLUE)
  p.put(3, 10, 'v')
  p.put(11, 10, 'v')
  return p.sprite()
}

/** Brook: a black afro round a bone-white skull. */
function brookHead(): Sprite {
  const p = new Pix(14, 12, 0)
  p.disc(7, 6, 6.6, { out: 'f', sh: 'f', base: 'f', lt: 'g', hi: 'h' })
  p.disc(7, 8, 4.2, { out: 'o', sh: 'p', base: 'q', lt: 'r', hi: 'r' })
  p.rect(5, 6, 2, 3, 'f') // sockets
  p.rect(8, 6, 2, 3, 'f')
  p.put(7, 9, 'f') // nose hole
  p.hline(5, 10, 5, 'r')
  p.put(5, 11, 'f') // teeth gaps
  p.put(7, 11, 'f')
  p.put(9, 11, 'f')
  p.put(6, 11, 'r')
  p.put(8, 11, 'r')
  return p.sprite()
}

// ---------------------------------------------------------------- outfits

const SKIN_ARMS: KeyMap = (k) => ({ h: 'D', g: 'C', f: 'C' })[k] ?? k
const swords = sprite('zoro_swords', 3, ['. x u', '. f f', 'f f .', 'f g .', 'g .2'])
const cigarette = sprite('cigarette', 2, ['j v'])

const SPECS: CharSpec[] = [
  {
    id: 'sanji',
    head: sanjiHead,
    torso: sprite('sanji_torso', 8, ['h g j4 g f', 'h g2 j2 g f2', 'h g2 f2 g2 f', 'h g3 f g2 f', 'g7 f']),
    legs: (k) => k,
    extras: [{ sprite: cigarette, x: 13, y: 9, layer: 'front' }]
  },
  {
    id: 'luffy',
    head: luffyHead,
    torso: sprite('luffy_torso', 8, ['u2 D4 t2', 'u2 D4 t2', 'u2 C4 t2', 'x8', 'F6 E2']),
    arms: { front: SKIN_ARMS, back: SKIN_ARMS },
    legs: (k, row) => {
      if (row < 1) return k === 'h' ? 'F' : 'E'
      if (row < 4) return k === 'h' ? 'D' : 'C'
      return k === 'f' ? 'c' : k
    }
  },
  {
    id: 'zoro',
    head: zoroHead,
    torso: sprite('zoro_torso', 8, ['j2 D2 i2 h2', 'j3 i2 h3', 'j3 i2 h3', 'A8', 'z8']),
    arms: { front: swap({ h: 'j', g: 'i' }), back: swap({ h: 'i', g: 'h', f: 'g' }) },
    legs: (k, row) => (row === 4 ? (k === 'f' ? 'a' : k) : swap({ h: 'g', g: 'f', f: 'f' })(k, row)),
    extras: [{ sprite: swords, x: 1, y: 17, layer: 'back' }]
  },
  {
    id: 'nami',
    head: namiHead,
    torso: sprite('nami_torso', 8, ['x2 D2 x2 w2', 'x3 y x2 w2', 'x6 w2', 'D6 C2', 'F6 E2']),
    arms: { front: SKIN_ARMS, back: SKIN_ARMS },
    legs: (k, row) => (row < 4 ? (k === 'h' ? 'F' : 'E') : k === 'f' ? 'a' : k)
  },
  {
    id: 'robin',
    head: robinHead,
    torso: sprite('robin_torso', 8, ['E2 D2 E2 f2', 'E6 f2', 'E6 f2', 'E6 f2', 'y2 x4 w2']),
    arms: { front: swap({ h: 'E', g: 'f' }), back: swap({ h: 'F', g: 'E', f: 'f' }) },
    legs: (k, row) => (row < 4 ? swap({ h: 'F', g: 'E', f: 'f' })(k, row) : k === 'f' ? 't' : k)
  },
  {
    id: 'franky',
    head: frankyHead,
    torso: sprite('franky_torso', 8, ['u2 D4 t2', 'u D6 t', 'u2 D4 t2', 'f8', 'F6 E2']),
    arms: { front: SKIN_ARMS, back: SKIN_ARMS },
    legs: (k, row) => {
      if (row < 1) return k === 'h' ? 'F' : 'E'
      if (row < 4) return k === 'h' ? 'D' : 'C'
      return k === 'f' ? 'a' : k
    }
  },
  {
    id: 'usopp',
    head: usoppHead,
    torso: sprite('usopp_torso', 8, ['j x2 j2 x2 j', 'x6 w2', 'x6 w2', 'x6 w2', 'c6 b2']),
    arms: { front: swap({ h: 'j', g: 'i' }), back: swap({ h: 'i', g: 'h', f: 'g' }) },
    legs: (k, row) => ({ h: 'c', g: 'b', f: 'a' })[k] ?? k
  },
  {
    id: 'jinbe',
    head: jinbeHead,
    headX: 2,
    torso: sprite('jinbe_torso', 10, ['E F3 D2 F3 E', 'E F8 E', 'E F8 E', 'E F8 E', 'f10']),
    arms: { front: swap({ h: 'F', g: 'E', D: 'F', C: 'E' }), back: swap({ h: 'E', g: 'E', f: 'f', D: 'E', C: 'E' }) },
    legs: (k) => ({ h: 'F', g: 'E', f: 'f' })[k] ?? k
  },
  {
    id: 'brook',
    head: brookHead(),
    torso: sprite('brook_torso', 8, ['g f j2 f2 g f', 'g f2 u2 f g f', 'g f2 u f3 g', 'g f7', 'f8']),
    arms: { front: swap({ h: 'g', g: 'f', D: 'r', C: 'q' }), back: swap({ h: 'f', g: 'f', f: 'f', D: 'q', C: 'p' }) },
    legs: (k, row) => (row < 4 ? ({ h: 'g', g: 'f', f: 'f' })[k] ?? k : k === 'f' ? 'j' : k)
  }
]

// ---------------------------------------------------------------- frames

function frame(spec: CharSpec, name: string, pose: Pose): Sprite {
  const { dy, legs: rawLegs } = pose
  const tx = spec.torsoX ?? 3
  const legs = recolor(rawLegs, spec.legs)
  const legX = tx + Math.floor((spec.torso.w - legs.w) / 2)
  const front = recolor(armFront, spec.arms?.front ?? ((k) => k))
  const back = recolor(armBack, spec.arms?.back ?? ((k) => k))
  const extras = spec.extras ?? []
  const layers: [Sprite, number, number][] = [
    ...extras.filter((e) => e.layer === 'back').map((e): [Sprite, number, number] => [e.sprite, e.x, e.y + dy]),
    [legs, legX, 18],
    [back, tx - 2, 13 + dy + (pose.armB ?? 0)],
    [spec.torso, tx, 13 + dy],
    [front, tx + spec.torso.w, 13 + dy + (pose.armF ?? 0)],
    [spec.head, spec.headX ?? 1, 1 + dy],
    ...extras.filter((e) => e.layer === 'front').map((e): [Sprite, number, number] => [e.sprite, e.x, e.y + dy])
  ]
  return compose(name, 16, 24, layers)
}

/** Chopper is tiny: a huge head on a 2px-tall body, so he gets his own geometry. */
function chopperFrame(name: string, pose: Pose): Sprite {
  const { dy } = pose
  const stride = pose.legs === legsContactA || pose.legs === legsPassB ? 1 : 0
  const hoof = sprite('chopper_legs_a', 6, ['F2 .2 F2', 'c2 .2 c2'])
  const hoofB = sprite('chopper_legs_b', 6, ['.1 F2 F2 .1', '.1 c2 c2 .1'])
  const body = sprite('chopper_body', 8, ['. d6 .', 'u2 d4 t2'])
  return compose(name, 16, 24, [
    [stride ? hoofB : hoof, 5, 21],
    [body, 4, 19 + dy],
    [chopperHead(), 1, 7 + dy]
  ])
}

const POSES: { suffix: string; pose: Pose }[] = [
  { suffix: 'idle_0', pose: { dy: 0, legs: legsStand } },
  { suffix: 'idle_1', pose: { dy: 1, legs: legsStand } },
  { suffix: 'walk_0', pose: { dy: 1, legs: legsContactA, armF: -1, armB: 1 } },
  { suffix: 'walk_1', pose: { dy: 0, legs: legsPassA } },
  { suffix: 'walk_2', pose: { dy: 1, legs: legsContactB, armF: 1, armB: -1 } },
  { suffix: 'walk_3', pose: { dy: 0, legs: legsPassB } }
]

export const CREW_IDS = [...SPECS.map((s) => s.id), 'chopper'] as const

export const CHARACTER_ANIMS = {
  idle: { frames: ['idle_0', 'idle_1'], fps: 2 },
  walk: { frames: ['walk_0', 'walk_1', 'walk_2', 'walk_3'], fps: 8 }
} as const

export function characterSprites(): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const spec of SPECS) {
    if (BIG_CREW_IDS.includes(spec.id) || CREW_BIG_IDS.includes(spec.id)) continue // redrawn at 24x32
    for (const { suffix, pose } of POSES) {
      const name = `${spec.id}_${suffix}`
      out.push({ name, sprite: frame(spec, name, pose) })
    }
  }
  out.push(...bigCharacterSprites(), ...crewCharacterSprites())
  return out
}
