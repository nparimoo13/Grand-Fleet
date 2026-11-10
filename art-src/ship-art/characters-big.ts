import { compose, rep, sprite, type Sprite } from './sprite'
import type { NamedSprite } from './tiles'

/**
 * Big chibi crew: 24x32 frames (about 2.5x the old 16x24 sprites by area), content inside x 1..22, y 1..30 so
 * the build's 1px outline has room. Head about 45% of the height, one pixel per character in the grids below
 * (`.` is transparent). Light comes from the top-left: `h`/`y` highlights on the left, `f`/`w` shade on the right.
 *
 * Every figure shares one skeleton (head, torso, two arms, two legs) so idle and walk stay consistent; what
 * differs is the head, the outfit grids and a few props.
 */

export const grid = (name: string, rows: readonly string[]): Sprite => sprite(name, rows[0].length, rows)

export type Layer = readonly [Sprite, number, number]

// ---------------------------------------------------------------- Sanji

/** Blond swept fringe over the right eye, curly brow, blush. 16 x 14. */
export const sanjiHead = grid('sanji_head', [
  '....wwwwwwww....',
  '..wwyrrryyyxxww.',
  '.wyyrryyyyyyxxxw',
  'wyyyyyyyyyyyyxxw',
  'wyyyyyyyyyyxxxxw',
  'wyyDDDDDxyyyyyxw',
  'wyDDwwwDDxyyyyxw',
  'wyDDfffDDDxyyyxw',
  'wCDDfjfDDDDxyyxw',
  'wCDDfffDDDDDxyxw',
  '.CDDvDDDDDDvDDC.',
  '.CDDDDDttDDDDDC.',
  '..CDDDDDDDDDDC..',
  '....CCCCCCCC....'
])

/** Black suit, cream shirt and a dark tie. 10 x 9. */
export const sanjiTorso = grid('sanji_torso', [
  'hgqrrrrqgf',
  'hggqrrqggf',
  'hggqffqggf',
  'hgggffgggf',
  'hgggffgggf',
  'hgggffgggf',
  'hgggggggff',
  'hggggggggf',
  'gggggggggf'
])

export const sleeveFront = grid('sleeve_front', ['hgf', 'hgf', 'hgf', 'hgf', 'hgf', 'hgf', 'hgf', 'DDC', '.CC'])
export const sleeveBack = grid('sleeve_back', ['ggf', 'ggf', 'ggf', 'ggf', 'ggf', 'ggf', 'ggf', 'CCC', '.CC'])

/** Trouser leg: 5 wide, 7 tall; `lift` raises the foot (walking) by trimming trouser rows and adding air below. */
function leg(lift: number, back: boolean): Sprite {
  const rows = [...rep(5 - lift, back ? 'ggff.' : 'hggf.'), back ? 'gfff.' : 'gffff', 'fffff', ...rep(lift, '.....')]
  return grid('leg', rows)
}

const cookArm = grid('cook_arm', ['hhgg', 'gggD', 'fffC'])
// handle (wood) on the left, dark pan with a lit rim
const pan = grid('frying_pan', ['.hhhh.', 'cggggf', '.ffff.'])
const panTilt = grid('frying_pan_tilt', ['..hhh.', 'cgggf.', '.fff..'])
const FOOD = [
  grid('food_0', ['.x.u', 'A..x']),
  grid('food_1', ['u..A', '.x.u']),
  grid('food_2', ['x.u.', '.A.x'])
]
const cigarette = grid('cigarette', ['rrrv'])

interface Leg {
  dx: number
  lift: number
}

export interface BigPose {
  /** Whole upper body drop (breathing, stepping). */
  dy: 0 | 1
  back: Leg
  front: Leg
  armF?: number
  armB?: number
  armFx?: number
  armBx?: number
}

const STAND: Leg = { dx: 0, lift: 0 }
export const POSES: ReadonlyArray<{ suffix: string; pose: BigPose }> = [
  { suffix: 'idle_0', pose: { dy: 0, back: STAND, front: STAND } },
  { suffix: 'idle_1', pose: { dy: 1, back: STAND, front: STAND } },
  { suffix: 'walk_0', pose: { dy: 1, back: { dx: -2, lift: 1 }, front: { dx: 2, lift: 0 }, armF: -1, armB: 1, armFx: -1, armBx: 1 } },
  { suffix: 'walk_1', pose: { dy: 0, back: { dx: 1, lift: 0 }, front: { dx: -1, lift: 2 } } },
  { suffix: 'walk_2', pose: { dy: 1, back: { dx: 2, lift: 0 }, front: { dx: -2, lift: 1 }, armF: 1, armB: -1, armFx: 1, armBx: -1 } },
  { suffix: 'walk_3', pose: { dy: 0, back: { dx: -1, lift: 2 }, front: { dx: 1, lift: 0 } } }
]

export const BODY_X = 7
export const TORSO_Y = 15
export const LEG_Y = 24
export const HEAD_Y = 1

interface Build {
  shift?: number
  /** Replace the front sleeve (cooking uses a raised arm instead). */
  noFrontArm?: boolean
  extra?: Layer[]
}

function sanjiFrame(name: string, pose: BigPose, opt: Build = {}): Sprite {
  const { dy } = pose
  const bx = BODY_X + (opt.shift ?? 0)
  const layers: Layer[] = [
    [leg(pose.back.lift, true), bx + pose.back.dx, LEG_Y],
    [leg(pose.front.lift, false), bx + 5 + pose.front.dx, LEG_Y],
    [sleeveBack, bx - 3 + (pose.armBx ?? 0), TORSO_Y + 1 + dy + (pose.armB ?? 0)],
    [sanjiTorso, bx, TORSO_Y + dy]
  ]
  if (!opt.noFrontArm) layers.push([sleeveFront, bx + 10 + (pose.armFx ?? 0), TORSO_Y + 1 + dy + (pose.armF ?? 0)])
  layers.push([sanjiHead, bx - 3, HEAD_Y + dy], [cigarette, bx + 8, HEAD_Y + dy + 11], ...(opt.extra ?? []))
  return compose(name, 24, 32, layers)
}

/**
 * Cooking: the body steps left to make room and the front arm holds a frying pan out over the stove.
 * Four frames at 4 fps: pan low with food, pan up, flip, catch.
 */
function sanjiCook(frameNo: number): Sprite {
  const shift = -3
  const bx = BODY_X + shift
  const up = [0, -2, -3, -1][frameNo]
  const dy: 0 | 1 = frameNo === 3 ? 1 : 0
  const handY = TORSO_Y + 5 + dy + up
  const panY = handY - 1
  const foodY = Math.max(1, panY - [2, 5, 7, 3][frameNo])
  return sanjiFrame(
    `sanji_work_${frameNo}`,
    { dy, back: STAND, front: STAND },
    {
      shift,
      noFrontArm: true,
      extra: [
        [cookArm, bx + 10, handY],
        [frameNo === 2 ? panTilt : pan, bx + 13, panY],
        [FOOD[frameNo % 3], bx + 14 + (frameNo === 2 ? 1 : 0), foodY]
      ]
    }
  )
}

export function bigCharacterSprites(): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const { suffix, pose } of POSES) out.push({ name: `sanji_${suffix}`, sprite: sanjiFrame(`sanji_${suffix}`, pose) })
  for (let i = 0; i < 4; i++) out.push({ name: `sanji_work_${i}`, sprite: sanjiCook(i) })
  return out
}

/** Crew ids drawn at this size; the 16x24 builder skips them. */
export const BIG_CREW_IDS: readonly string[] = ['sanji']
