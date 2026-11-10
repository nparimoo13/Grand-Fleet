import { BODY_X, HEAD_Y, LEG_Y, POSES, TORSO_Y, grid, sanjiHead, sanjiTorso, sleeveBack, sleeveFront, type BigPose, type Layer } from './characters-big'
import { Pix } from './pix'
import { blank, compose, rep, type Sprite } from './sprite'
import type { NamedSprite } from './tiles'

/**
 * The other nine crew at 24x32 (Sanji lives in characters-big.ts). One shared skeleton, drawn from parts:
 *  - a head built from a face base (skin oval, eyes, mouth) with a hair/hat layer in front and, for long hair, behind;
 *  - a 10x9 torso grid per outfit;
 *  - sleeves and trouser legs painted through key maps, so every outfit shares the same poses;
 *  - four `work` frames per person that match what their room is for (see `activity` in room-defs.ts).
 * Light comes from the top-left: `h`-ish keys are the lit side, `f`-ish keys the shaded side.
 */

// ---------------------------------------------------------------- parts

type ArmStyle = Record<'h' | 'g' | 'f' | 'D' | 'C', string>
type LegMap = (k: 'h' | 'g' | 'f', row: number, foot: boolean) => string

const SKIN_ARM: ArmStyle = { h: 'D', g: 'C', f: 'C', D: 'D', C: 'C' }

function paintRows(rows: readonly string[], style: ArmStyle): Sprite {
  const g = grid('arm', rows)
  return { w: g.w, h: g.h, px: g.px.map((r) => r.map((k) => (k === '.' ? k : style[k as keyof ArmStyle]))) }
}

/** Hanging sleeve: `len` rows including the two hand rows. */
function sleeve(style: ArmStyle, len = 9): Sprite {
  return paintRows([...rep(len - 2, 'hgf'), 'DDC', '.CC'], style)
}

/** Arm raised overhead, hand at the top. */
function armUp(style: ArmStyle, len: number): Sprite {
  return paintRows(['.CC', 'DDC', ...rep(len - 2, 'hgf')], style)
}

/** Forearm held out to the right at chest height. 4x3. */
function reach(style: ArmStyle): Sprite {
  return paintRows(['hhgg', 'gggD', 'fffC'], style)
}

const BRIDGE_H = (style: ArmStyle): Sprite => paintRows(['hhh', 'ggg', 'fff'], style)

function legSprite(lift: number, back: boolean, map: LegMap): Sprite {
  const trouser = 5 - lift
  const keys = back ? (['g', 'g', 'f', 'f'] as const) : (['h', 'g', 'g', 'f'] as const)
  const px: string[][] = []
  for (let r = 0; r < trouser; r++) px.push([...keys.map((k) => map(k, r, false)), '.'])
  px.push(back ? [map('g', trouser, true), map('f', trouser, true), map('f', trouser, true), map('f', trouser, true), '.'] : (['g', 'f', 'f', 'f', 'f'] as const).map((k) => map(k, trouser, true)))
  px.push((['f', 'f', 'f', 'f', 'f'] as const).map((k) => map(k, trouser + 1, true)))
  for (let i = 0; i < lift; i++) px.push(['.', '.', '.', '.', '.'])
  return { w: 5, h: px.length, px }
}

// ---------------------------------------------------------------- heads

interface HeadSpec {
  id: string
  skin?: { D: string; C: string }
  eyes: 'round' | 'sharp' | 'dot' | 'shades'
  mouth: 'smile' | 'grin' | 'flat' | 'shark'
  blush?: boolean
  /** Hair or hat in front of the face. 16x14, mostly transparent below the brow. */
  front: Sprite
  /** Long hair behind the face. */
  back?: Sprite
  /** Extra pixels: scars, earrings, a long nose. */
  dots?: ReadonlyArray<readonly [number, number, string]>
}

const FACE = [
  '..DDDDDDDD..',
  '.DDDDDDDDDD.',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  'DDDDDDDDDDDC',
  '.CDDDDDDDDC.',
  '..CCCCCCCC..'
]

function headOf(h: HeadSpec): Sprite {
  const skin = h.skin ?? { D: 'D', C: 'C' }
  const f = blank(16, 14)
  FACE.forEach((row, i) =>
    [...row].forEach((k, j) => {
      if (k !== '.') f.px[2 + i][2 + j] = k === 'D' ? skin.D : skin.C
    })
  )
  const put = (x: number, y: number, k: string): void => {
    f.px[y][x] = k
  }
  switch (h.eyes) {
    case 'round':
      for (const x of [5, 9]) {
        put(x, 7, 'j')
        put(x + 1, 7, 'f')
        for (const y of [8, 9]) {
          put(x, y, 'f')
          put(x + 1, y, 'f')
        }
      }
      break
    case 'sharp':
      for (const [x, bx] of [[5, 4], [9, 10]] as const) {
        put(bx, 7, 'f')
        put(bx + 1, 7, 'f')
        put(x, 8, 'f')
        put(x + 1, 8, 'f')
        put(x, 9, 'f')
        put(x + 1, 9, 'j')
      }
      break
    case 'dot':
      for (const x of [5, 10]) {
        put(x, 8, 'f')
        put(x, 9, 'f')
      }
      break
    case 'shades':
      for (let x = 3; x <= 12; x++) put(x, 7, 'f')
      for (const x of [3, 4, 5, 6, 9, 10, 11, 12]) put(x, 8, 'f')
      put(4, 7, 'j')
      put(10, 7, 'j')
      break
  }
  if (h.blush) {
    put(3, 10, 'v')
    put(12, 10, 'v')
  }
  switch (h.mouth) {
    case 'smile':
      for (let x = 6; x <= 9; x++) put(x, 11, 't')
      break
    case 'grin':
      for (let x = 5; x <= 10; x++) put(x, 11, 'f')
      for (let x = 6; x <= 9; x++) put(x, 12, 'j')
      break
    case 'flat':
      for (let x = 6; x <= 9; x++) put(x, 11, 'f')
      break
    case 'shark':
      for (let x = 4; x <= 11; x++) {
        put(x, 11, 'f')
        put(x, 12, x % 2 === 0 ? 'j' : 'f')
      }
      break
  }
  for (const [x, y, k] of h.dots ?? []) put(x, y, k)
  return compose(`${h.id}_head`, 16, 14, [...(h.back ? ([[h.back, 0, 0]] as const) : []), [f, 0, 0], [h.front, 0, 0]])
}

const recolorMap = (s: Sprite, m: Record<string, string>): Sprite => ({ w: s.w, h: s.h, px: s.px.map((r) => r.map((k) => m[k] ?? k)) })

const LONG_BACK = grid('long_back', [
  '....xxxxxxxx....',
  '..xxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.xxxxxxxxxxxxxw.',
  '.wxxxxxxxxxxxww.',
  '..wwxxxxxxxxww..'
])

const HEADS: Record<string, Sprite> = {
  luffy: headOf({
    id: 'luffy',
    eyes: 'round',
    mouth: 'grin',
    dots: [[4, 10, 's'], [5, 10, 's']],
    front: grid('luffy_hair', [
      '....yyyyyyyy....',
      '...yyrryyyyyxx..',
      '..yyyyyyyyyyxxx.',
      '..vuuuuuuuuuutt.',
      'eexxxxxxxxxxxxww',
      '..fgfffffgffff..',
      '..f..........f..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  }),
  zoro: headOf({
    id: 'zoro',
    eyes: 'sharp',
    mouth: 'flat',
    dots: [[1, 8, 'x'], [1, 9, 'y'], [1, 10, 'x']],
    front: grid('zoro_hair', [
      '....A..A..AA....',
      '...AAAAAAAAAA...',
      '..AAnnAAAAAAAz..',
      '..AAAAAAAAAAAz..',
      '..AAAAAAAAAAAz..',
      '..A.AA....AA.A..',
      '..A..........z..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  }),
  nami: headOf({
    id: 'nami',
    eyes: 'round',
    mouth: 'smile',
    blush: true,
    back: LONG_BACK,
    front: grid('nami_hair', [
      '....xxxxxxxx....',
      '..xxyyyyxxxxxxw.',
      '.xxyyyyxxxxxxxw.',
      '.xyyxxxxxxxxxxw.',
      '.xxx..xxxxxxxxw.',
      '.xx.........xxw.',
      '.x..........xxw.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  }),
  robin: headOf({
    id: 'robin',
    eyes: 'round',
    mouth: 'smile',
    back: recolorMap(LONG_BACK, { x: 'f', w: 'f' }),
    front: grid('robin_hair', [
      '....ffffffff....',
      '..ffgghfffffff..',
      '.ffgghffffffffg.',
      '.fgfffffffffffg.',
      '.ffff.ffffffffg.',
      '.ff.........fff.',
      '.f..........ff..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  }),
  franky: headOf({
    id: 'franky',
    eyes: 'shades',
    mouth: 'grin',
    front: grid('franky_hair', [
      '...GGGGGGGGGG...',
      '..GGFFFFFFFFFF..',
      '.GGFFFFFFFFFFFE.',
      '..GFFFFFFFFFFE..',
      '..FFFFFFFFFFEE..',
      '..F..........E..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  }),
  usopp: headOf({
    id: 'usopp',
    eyes: 'dot',
    mouth: 'grin',
    dots: [[8, 9, 'C'], [9, 9, 'C'], [10, 9, 'C'], [11, 10, 'C']],
    front: grid('usopp_hair', [
      '...ababababab...',
      '..babababababa..',
      '.baabbbbbbbbaab.',
      '.aayyyyyyyyyyaa.',
      '.ayyhhyyyyhhyya.',
      '.ab..........ba.',
      '.a............a.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  }),
  jinbe: headOf({
    id: 'jinbe',
    skin: { D: 'F', C: 'E' },
    eyes: 'sharp',
    mouth: 'shark',
    dots: [[7, 9, 'E'], [8, 9, 'E']],
    front: grid('jinbe_hair', [
      '....ffffffff....',
      '..fffggggfffff..',
      '.fffggggggfffff.',
      '..ffffffffffff..',
      '..fff......fff..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ])
  })
}

/** Brook: a black afro round a bone-white skull. */
function brookHead(): Sprite {
  const p = new Pix(14, 12)
  p.disc(7, 6, 6.6, { out: 'f', sh: 'f', base: 'f', lt: 'g', hi: 'h' })
  p.disc(7, 8, 4.2, { out: 'o', sh: 'p', base: 'q', lt: 'r', hi: 'r' })
  p.rect(5, 6, 2, 3, 'f')
  p.rect(8, 6, 2, 3, 'f')
  p.put(7, 9, 'f')
  p.hline(5, 10, 5, 'r')
  for (const x of [5, 7, 9]) p.put(x, 11, 'f')
  return p.sprite()
}

/** Chopper: a big pink hat, antlers and a blue nose. */
function chopperHead(): Sprite {
  const p = new Pix(14, 12)
  const fur = { out: 'c', sh: 'c', base: 'd', lt: 'e', hi: 'e' }
  p.disc(7, 7.5, 5.4, fur)
  p.vline(1, 0, 3, 'd')
  p.put(2, 3, 'c')
  p.vline(12, 0, 3, 'c')
  p.put(11, 3, 'c')
  p.put(0, 0, 'd')
  p.put(13, 0, 'c')
  p.ellipse(7, 2, 5.4, 3.2, 'u')
  p.hline(2, 5, 10, 't')
  p.put(4, 1, 'v')
  p.put(5, 0, 'v')
  p.put(3, 2, 'v')
  p.rect(6, 0, 2, 5, 'r')
  p.rect(4, 2, 6, 2, 'r')
  p.put(6, 0, 'v')
  p.rect(4, 7, 2, 3, 'f')
  p.rect(9, 7, 2, 3, 'f')
  p.put(4, 7, 'j')
  p.put(9, 7, 'j')
  p.disc(7, 10, 1.7, { out: 'E', sh: 'E', base: 'F', lt: 'G', hi: 'j' })
  p.put(3, 10, 'v')
  p.put(11, 10, 'v')
  return p.sprite()
}

// ---------------------------------------------------------------- outfits

interface WorkFrame {
  dy: 0 | 1
  /** Body x shift (to make room for what the arms hold). */
  shift: number
  /** Drop the normal front and/or back sleeve; `layers` then draws the arms itself. */
  noFront?: boolean
  noBack?: boolean
  /** Everything held or raised, drawn after the head. `bx` is the torso's left edge. */
  layers: (bx: number) => Layer[]
}

interface Outfit {
  id: string
  head: Sprite
  torso: Sprite
  arm: ArmStyle
  legs: LegMap
  /** Drawn behind the legs / between the back arm and the torso / after the head. */
  back?: (bx: number) => Layer[]
  mid?: (bx: number) => Layer[]
  front?: (bx: number) => Layer[]
  work: (n: number) => WorkFrame
}

function frame(o: Outfit, name: string, pose: BigPose, wf?: WorkFrame): Sprite {
  const dy = wf ? wf.dy : pose.dy
  const bx = BODY_X + (wf?.shift ?? 0)
  const layers: Layer[] = [...(o.back?.(bx) ?? [])]
  layers.push([legSprite(pose.back.lift, true, o.legs), bx + pose.back.dx, LEG_Y], [legSprite(pose.front.lift, false, o.legs), bx + 5 + pose.front.dx, LEG_Y])
  if (!wf?.noBack) layers.push([sleeve(o.arm), bx - 3 + (pose.armBx ?? 0), TORSO_Y + 1 + dy + (pose.armB ?? 0)])
  layers.push(...(o.mid?.(bx) ?? []), [o.torso, bx, TORSO_Y + dy])
  if (!wf?.noFront) layers.push([sleeve(o.arm), bx + 10 + (pose.armFx ?? 0), TORSO_Y + 1 + dy + (pose.armF ?? 0)])
  layers.push([o.head, bx - 3, HEAD_Y + dy], ...(o.front?.(bx) ?? []), ...(wf?.layers(bx) ?? []))
  return compose(name, 24, 32, layers)
}

const STAND = { dx: 0, lift: 0 }
const WORK_POSE: BigPose = { dy: 0, back: STAND, front: STAND }

function sprites(o: Outfit): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const { suffix, pose } of POSES) out.push({ name: `${o.id}_${suffix}`, sprite: frame(o, `${o.id}_${suffix}`, pose) })
  for (let n = 0; n < 4; n++) out.push({ name: `${o.id}_work_${n}`, sprite: frame(o, `${o.id}_work_${n}`, WORK_POSE, o.work(n)) })
  return out
}

/** A struck tool: forearm out front, tool held upright, a spark on the hit. */
function strike(style: ArmStyle, tool: Sprite, n: number, spark: boolean): WorkFrame {
  const up = [0, -3, -1, 3][n]
  return {
    dy: n === 3 ? 1 : 0,
    shift: -3,
    noFront: true,
    layers: (bx) => {
      const handY = TORSO_Y + 4 + up + (n === 3 ? 1 : 0)
      const out: Layer[] = [[reach(style), bx + 10, handY], [tool, bx + 12, handY - tool.h + 2]]
      if (spark && n === 3) out.push([grid('spark', ['y.x', '.y.', 'x.y']), bx + 15, handY + 1])
      return out
    }
  }
}

// ---- torsos

const T = {
  luffy: grid('luffy_torso', ['uuDDDDDDtt', 'uuDDDDDDtt', 'uuDDDDDCtt', 'uuuDDDDCtt', 'exxxxxxxww', 'xxxxxxxxww', 'FFFFFFFFFE', 'FFFFFFFFEE', 'FFFFFFFEEE']),
  zoro: grid('zoro_torso', ['jjjDDDDiih', 'jjjDCCDiih', 'jjjjDDiiih', 'jjjjjjiiih', 'nAAAAAAAAz', 'AAAAAAAAzz', 'ggggggggff', 'gggggggfff', 'ggggggffff']),
  nami: grid('nami_torso', ['qrrDDDDrpo', 'qrrrDDrrpo', 'qrrrrrrrpo', 'xxxxxxxxxw', 'DDDDDDDDDC', 'DDDDDDDDCC', 'cccccccccb', 'FFFFFFFFFE', 'FFFFFFFFEE']),
  robin: grid('robin_torso', ['EEEDDDDEEf', 'EEEEDDEEEf', 'EEEEEEEEEf', 'EEEEEEEEEf', 'yxxxxxxxxw', 'ttttttttts', 'ttttttttts', 'tttttttsss', 'ssssssssss']),
  franky: grid('franky_torso', ['uxuDDDDutt', 'uuuDDDDttt', 'uxuDDDDutt', 'uuuuDDttxt', 'wxwxwxwxwx', 'FFFFFFFFFE', 'FFFFFFFFEE', 'FFFFFFFEEE', 'FFFFFFEEEE']),
  usopp: grid('usopp_torso', ['xxcxxxxcxx', 'xxcxxxxcxw', 'cccccccccb', 'cccbbbcccb', 'cccccccccb', 'cccccccccb', 'cccccccccb', 'cccccccbbb', 'ccccccbbbb']),
  jinbe: grid('jinbe_torso', ['ggFFFFFFgf', 'ggFFFEFFgf', 'ggFFFFFFgf', 'gggFFFFggf', 'xxxxxxxxxw', 'gggggggggf', 'gggggggggf', 'gggggggggf', 'ggggggggff']),
  brook: grid('brook_torso', ['hgfrrrrfgf', 'hggrttrggf', 'hggfttfggf', 'hgggttgggf', 'hgggffgggf', 'hgggffgggf', 'hgggggggff', 'hggggggggf', 'gggggggggf'])
}

const plain = (h: string, g: string, f: string): LegMap => (k) => ({ h, g, f })[k]
const shoed = (trouser: LegMap, shoe: [string, string, string]): LegMap => (k, row, foot) => (foot ? plain(...shoe)(k, row, foot) : trouser(k, row, foot))

// ---- work props

const BOOK = grid('book', ['tuuuuuut', 'urrqqrru', 'urrqqrru', 'urrqqrru', 'urrqqrru', 'tuuuuuut'])
const PAGE_FLIP = [
  null,
  grid('page_1', ['.....r..']),
  grid('page_2', ['....rr..', '.....r..']),
  grid('page_3', ['...rrr..', '....rr..', '.....q..'])
]
const PAPER = grid('chart', ['rrrrq', 'rqrrq', 'rrrrq', 'rrqrq', 'rrrrq', 'rqrrq', 'rrrrq', 'qqqqo'])
const WRENCH = grid('wrench', ['i.i', 'iii', '.h.', '.h.', '.h.', '.g.', '.g.', '.g.'])
const HAMMER = grid('hammer', ['jhhg', 'hhgg', '.cb.', '.cb.', '.cb.', '.cb.', '.cb.'])
const VIOLIN = grid('violin', ['.dcc....', 'dcccbaaa', 'ccbbc...', '.cbb....'])
const BOW = grid('bow', ['aaiiiiijj'])
const SWORDS = grid('swords', ['.....x', '....ux', '...ff.', '..fg..', '.fg...', 'fg....', 'g.....'])

function barbell(): Sprite {
  const s = blank(22, 6)
  const plate = (x0: number): void => {
    for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) s.px[y][x0 + x] = x === 0 ? 'h' : x === 2 ? 'f' : 'g'
  }
  plate(0)
  plate(19)
  for (let x = 3; x < 19; x++) {
    s.px[2][x] = 'j'
    s.px[3][x] = 'h'
  }
  return s
}
const BARBELL = barbell()

const CHEER_TOP: ReadonlyArray<readonly [number, number]> = [[6, 9], [3, 7], [6, 4], [9, 6]]

const OUTFITS: Outfit[] = [
  {
    id: 'luffy',
    head: HEADS.luffy,
    torso: T.luffy,
    arm: SKIN_ARM,
    legs: shoed((k, row) => (row < 2 ? plain('F', 'E', 'E')(k, row, false) : plain('D', 'C', 'C')(k, row, false)), ['c', 'b', 'a']),
    // cheering on the figurehead: both arms pump overhead
    work: (n) => ({
      dy: n === 3 ? 1 : 0,
      shift: 0,
      noFront: true,
      noBack: true,
      layers: (bx) => {
        const [ft, bt] = CHEER_TOP[n]
        const dy = n === 3 ? 1 : 0
        return [
          [BRIDGE_H(SKIN_ARM), bx - 3, TORSO_Y + 1 + dy],
          [armUp(SKIN_ARM, 19 - bt), bx - 6, bt],
          [BRIDGE_H(SKIN_ARM), bx + 10, TORSO_Y + 1 + dy],
          [armUp(SKIN_ARM, 19 - ft), bx + 13, ft]
        ]
      }
    })
  },
  {
    id: 'zoro',
    head: HEADS.zoro,
    torso: T.zoro,
    arm: { h: 'j', g: 'i', f: 'h', D: 'D', C: 'C' },
    legs: shoed(plain('g', 'f', 'f'), ['b', 'a', 'a']),
    mid: (bx) => [[SWORDS, bx - 2, TORSO_Y + 4]],
    // curls a barbell in the crow's nest
    work: (n) => {
      const barY = [23, 20, 18, 20][n]
      const style: ArmStyle = { h: 'j', g: 'i', f: 'h', D: 'D', C: 'C' }
      return {
        dy: 0,
        shift: 0,
        noFront: true,
        noBack: true,
        layers: (bx) => [
          [sleeve(style, barY - 15), bx - 3, TORSO_Y + 1],
          [sleeve(style, barY - 15), bx + 10, TORSO_Y + 1],
          [BARBELL, 1, barY - 2]
        ]
      }
    }
  },
  {
    id: 'nami',
    head: HEADS.nami,
    torso: T.nami,
    arm: SKIN_ARM,
    legs: shoed(plain('F', 'E', 'E'), ['c', 'b', 'a']),
    // studies a chart, marking the route as she goes
    work: (n) => ({
      dy: n === 1 ? 1 : 0,
      shift: -2,
      noFront: true,
      layers: (bx) => {
        const px = bx + 13
        const py = TORSO_Y - 1
        const paper = { w: PAPER.w, h: PAPER.h, px: PAPER.px.map((r) => [...r]) }
        const trail: ReadonlyArray<readonly [number, number]> = [[1, 6], [2, 5], [3, 4], [3, 2]]
        trail.slice(0, n + 1).forEach(([x, y], i) => {
          paper.px[y][x] = i === n ? 'u' : 'x'
        })
        return [[paper, px, py], [reach(SKIN_ARM), bx + 10, TORSO_Y + 6]]
      }
    })
  },
  {
    id: 'robin',
    head: HEADS.robin,
    torso: T.robin,
    arm: { h: 'F', g: 'E', f: 'f', D: 'D', C: 'C' },
    legs: shoed(plain('F', 'E', 'f'), ['u', 't', 's']),
    // reads, turning a page
    work: (n) => ({
      dy: n === 2 ? 1 : 0,
      shift: -3,
      noFront: true,
      layers: (bx) => {
        const flip = PAGE_FLIP[n]
        const out: Layer[] = [[BOOK, bx + 11, TORSO_Y]]
        if (flip) out.push([flip, bx + 11, TORSO_Y - flip.h])
        out.push([reach({ h: 'F', g: 'E', f: 'f', D: 'D', C: 'C' }), bx + 10, TORSO_Y + 5])
        return out
      }
    })
  },
  {
    id: 'franky',
    head: HEADS.franky,
    torso: T.franky,
    arm: SKIN_ARM,
    legs: shoed((k, row) => (row < 2 ? plain('F', 'E', 'E')(k, row, false) : plain('D', 'C', 'C')(k, row, false)), ['g', 'f', 'f']),
    // hammers a wrench at the engine
    work: (n) => strike(SKIN_ARM, WRENCH, n, true)
  },
  {
    id: 'usopp',
    head: HEADS.usopp,
    torso: T.usopp,
    arm: { h: 'y', g: 'x', f: 'w', D: 'D', C: 'C' },
    legs: shoed(plain('c', 'b', 'a'), ['b', 'a', 'a']),
    // tinkers on the anvil
    work: (n) => strike({ h: 'y', g: 'x', f: 'w', D: 'D', C: 'C' }, HAMMER, n, true)
  },
  {
    id: 'jinbe',
    head: HEADS.jinbe,
    torso: T.jinbe,
    arm: { h: 'F', g: 'E', f: 'E', D: 'F', C: 'E' },
    legs: shoed(plain('g', 'f', 'f'), ['c', 'b', 'a']),
    // both hands on the wheel, turning it a little each frame
    work: (n) => {
      const off = [0, 1, 0, -1][n]
      const style: ArmStyle = { h: 'F', g: 'E', f: 'E', D: 'F', C: 'E' }
      return {
        dy: n % 2 === 1 ? 1 : 0,
        shift: -3,
        noFront: true,
        layers: (bx) => [
          [reach(style), bx + 10, TORSO_Y + 7 + off],
          [reach(style), bx + 11, TORSO_Y + 5 - off]
        ]
      }
    }
  },
  {
    id: 'brook',
    head: brookHead(),
    torso: T.brook,
    arm: { h: 'g', g: 'f', f: 'f', D: 'r', C: 'q' },
    legs: shoed(plain('g', 'f', 'f'), ['j', 'i', 'h']),
    // plays the violin
    work: (n) => {
      const dx = [0, 1, 2, 1][n]
      const style: ArmStyle = { h: 'g', g: 'f', f: 'f', D: 'r', C: 'q' }
      return {
        dy: n === 2 ? 1 : 0,
        shift: -2,
        noFront: true,
        layers: (bx) => [
          [VIOLIN, bx + 9, TORSO_Y],
          [BOW, bx + 7 + dx, TORSO_Y + 3],
          [reach(style), bx + 8 + dx, TORSO_Y + 3]
        ]
      }
    }
  }
]

// ---------------------------------------------------------------- Chopper (small: a big head on a short body)

const CHOPPER_HEAD = chopperHead()
const CHOPPER_BODY = grid('chopper_body', ['cddeeddc', 'cddeeddc', 'cddeeddc', 'GFFFFFFE', 'FFFFFFEE', 'FFFFFFEE'])
const HOOF = grid('chopper_hoof', ['dc', 'dc', 'aa'])
const PESTLE = grid('pestle', ['ji', 'hg', 'hg', 'hg', 'hg', 'gf'])
const FUR_ARM: ArmStyle = { h: 'd', g: 'd', f: 'c', D: 'd', C: 'c' }
const CIRCLE: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, -1], [2, 0], [1, 1]]

function chopperFrame(name: string, pose: BigPose, n?: number): Sprite {
  const dy = n === undefined ? pose.dy : n % 2 === 1 ? 1 : 0
  const layers: Layer[] = [
    [HOOF, 9 + pose.back.dx, 28 - pose.back.lift + (pose.back.lift ? 1 : 0)],
    [HOOF, 13 + pose.front.dx, 28 - pose.front.lift + (pose.front.lift ? 1 : 0)],
    [CHOPPER_BODY, 8, 22 + dy],
    [CHOPPER_HEAD, 4, 8 + dy]
  ]
  if (n !== undefined) {
    const [cx, cy] = CIRCLE[n]
    layers.push([PESTLE, 16 + cx, 18 + cy + dy], [reach(FUR_ARM), 14, 23 + dy])
  }
  return compose(name, 24, 32, layers)
}

function chopperSprites(): NamedSprite[] {
  const out: NamedSprite[] = []
  for (const { suffix, pose } of POSES) out.push({ name: `chopper_${suffix}`, sprite: chopperFrame(`chopper_${suffix}`, pose) })
  for (let n = 0; n < 4; n++) out.push({ name: `chopper_work_${n}`, sprite: chopperFrame(`chopper_work_${n}`, WORK_POSE, n) })
  return out
}

// ---------------------------------------------------------------- portraits

/**
 * 32x32 busts for the roster cards and the Captain's Deck: the same head and outfit as the scene sprite with the
 * torso carried down to the frame's bottom edge. Transparent, so the UI can sit it on each crew member's signature
 * colour. Shown at 2x (64px) by `Portrait`.
 */
function bust(id: string, head: Sprite, torso: Sprite, front: Sprite, back: Sprite): Sprite {
  const rows = Array.from({ length: 13 }, (_, i) => torso.px[Math.min(i, torso.h - 1)])
  const body: Sprite = { w: torso.w, h: rows.length, px: rows.map((r) => [...r]) }
  return compose(`${id}_portrait`, 32, 32, [
    [back, 8, 19],
    [body, 11, 18],
    [front, 21, 19],
    [head, 8, 4]
  ])
}

export function portraitSprites(): NamedSprite[] {
  const out: NamedSprite[] = [{ name: 'portrait_sanji', sprite: bust('sanji', sanjiHead, sanjiTorso, sleeveFront, sleeveBack) }]
  for (const o of OUTFITS) {
    out.push({ name: `portrait_${o.id}`, sprite: bust(o.id, o.head, o.torso, sleeve(o.arm, 9), sleeve(o.arm, 9)) })
  }
  // Chopper's body is small; the portrait is mostly head and hat
  const longBody: Sprite = { w: CHOPPER_BODY.w, h: 9, px: Array.from({ length: 9 }, (_, i) => [...CHOPPER_BODY.px[Math.min(i, CHOPPER_BODY.h - 1)]]) }
  const p = compose('chopper_portrait', 32, 32, [
    [longBody, 12, 21],
    [CHOPPER_HEAD, 8, 6]
  ])
  out.push({ name: 'portrait_chopper', sprite: p })
  return out
}

/** Crew ids drawn here. */
export const CREW_BIG_IDS: readonly string[] = [...OUTFITS.map((o) => o.id), 'chopper']

export function crewCharacterSprites(): NamedSprite[] {
  return [...OUTFITS.flatMap(sprites), ...chopperSprites()]
}