import { DWOOD, GOLD, RED, STEEL, WOOD, draw } from './pix'
import type { RoomProp } from './props-deck'
import type { Sprite } from './sprite'

/**
 * Props for the rooms the organic layout adds around the original ten: crew quarters, aquarium lounge, captain's
 * room, storage hold and weapons room. Same rules as the other prop files: palette-pure, light from the top-left,
 * outline and cast shadow added by the build.
 */

const prop = (name: string, sprite: Sprite, floor = true, solid = true): RoomProp => ({ name, sprite, solid, floor })

// =============================================================== crew quarters

function bunkBed(): Sprite {
  return draw(52, 60, (p) => {
    // posts and the canopy beam
    p.vcyl(0, 0, 4, 60, WOOD)
    p.vcyl(48, 0, 4, 60, WOOD)
    p.box(0, 0, 52, 4, WOOD)
    // upper bunk: frame, mattress, blanket, pillow
    p.box(4, 24, 44, 4, DWOOD)
    p.rect(5, 15, 42, 9, 'q')
    p.hline(5, 15, 42, 'r')
    p.rect(17, 14, 30, 10, 'u')
    p.hline(17, 14, 30, 'v')
    for (let x = 20; x < 46; x += 7) p.vline(x, 15, 9, 't')
    p.box(5, 12, 11, 8, { out: 'o', sh: 'p', base: 'q', lt: 'r', hi: 'r' })
    // lower bunk
    p.box(4, 50, 44, 4, DWOOD)
    p.rect(5, 41, 42, 9, 'q')
    p.hline(5, 41, 42, 'r')
    p.rect(17, 40, 30, 10, 'x')
    p.hline(17, 40, 30, 'y')
    for (let x = 20; x < 46; x += 7) p.vline(x, 41, 9, 'w')
    p.box(5, 38, 11, 8, { out: 'o', sh: 'p', base: 'q', lt: 'r', hi: 'r' })
    // ladder rungs up the right post and a dangling lantern hook
    for (const y of [30, 36, 42]) p.hline(40, y, 8, 'd')
    p.rect(0, 56, 5, 4, 'b')
    p.rect(47, 56, 5, 4, 'b')
  })
}

/** A striped hammock slung between two hooks. */
function hammock(): Sprite {
  return draw(62, 26, (p) => {
    for (let x = 0; x < 62; x++) {
      const sag = Math.round(Math.sin((x / 61) * Math.PI) * 16)
      const y0 = 3 + sag
      const stripe = Math.floor(x / 4) % 2 === 0
      for (let j = 0; j < 6; j++) {
        const k = j === 0 ? (stripe ? 'v' : 'r') : j >= 5 ? (stripe ? 't' : 'o') : stripe ? 'u' : 'q'
        p.soft(x, y0 + j, k)
      }
    }
    // ropes from the hooks to the ends of the cloth
    p.line(0, 0, 6, 8, 'p')
    p.line(61, 0, 55, 8, 'p')
    p.rect(0, 0, 3, 2, 'f')
    p.rect(59, 0, 3, 2, 'f')
  })
}

function footlocker(): Sprite {
  return draw(26, 16, (p) => {
    p.box(0, 5, 26, 11, DWOOD)
    p.box(1, 1, 24, 6, WOOD)
    p.hline(2, 2, 22, 'd')
    for (const x of [4, 19]) {
      p.rect(x, 1, 2, 15, 'g')
      p.vline(x, 1, 15, 'h')
    }
    p.rect(11, 6, 4, 4, 'y')
    p.rect(12, 8, 2, 2, 'w')
    p.hline(1, 14, 24, 'a')
  })
}

// =============================================================== aquarium lounge

/** A wide oval reef window with a carved frame; the fish are a separate overlay. */
function reefWindow(): Sprite {
  const W = 140
  const H = 58
  return draw(W, H, (p) => {
    const cx = W / 2
    const cy = H / 2
    // carved frame
    p.ellipse(cx, cy, 70, 29, 'a')
    p.ellipse(cx, cy, 69, 28, 'c')
    p.ellipse(cx, cy, 66, 26, 'd')
    p.ellipse(cx, cy, 64, 24, 'b')
    // water: light at the top, deep at the bottom, dithered between
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5 - cx) / 62
        const ny = (y + 0.5 - cy) / 22
        if (nx * nx + ny * ny > 1) continue
        const t = (ny + 1) / 2
        const dither = (x + y) % 2 === 0
        let k = t < 0.25 ? 'G' : t < 0.4 ? (dither ? 'G' : 'F') : t < 0.6 ? 'F' : t < 0.75 ? (dither ? 'F' : 'E') : 'E'
        // sand on the floor of the tank
        if (t > 0.86) k = t > 0.93 ? 'e' : dither ? 'e' : 'd'
        p.soft(x, y, k)
      }
    }
    // rocks, kelp and coral along the sand
    p.disc(26, 41, 5, STEEL)
    p.disc(112, 42, 6, STEEL)
    for (const [x, h] of [[18, 16], [22, 11], [118, 15], [122, 10], [100, 9]] as const) {
      for (let j = 0; j < h; j++) p.soft(x + (Math.floor(j / 3) % 2), 41 - j, j % 3 === 0 ? 'n' : 'A')
    }
    for (const [x, y] of [[48, 40], [78, 41], [64, 40]] as const) {
      p.disc(x, y, 2.5, RED)
      p.line(x, y - 1, x, y - 7, 'u')
      p.line(x, y - 4, x - 3, y - 8, 'u')
      p.line(x, y - 5, x + 3, y - 9, 'u')
    }
    // glass glints
    p.hline(30, 11, 10, 'j')
    p.hline(24, 14, 4, 'j')
    p.vline(18, 22, 5, 'j')
  })
}

/** Transparent overlay over the reef window's water: three fish swim there and back; 8 frames. */
export function reefFish(frame: number): Sprite {
  const W = 126
  const H = 44
  return draw(W, H, (p) => {
    const cx = 63
    const cy = 22
    const fish = (x: number, y: number, right: boolean, body: string, hi: string, tail: string) => {
      const px = (dx: number) => (right ? x + dx : x + 8 - dx)
      const put = (dx: number, dy: number, k: string) => {
        const X = px(dx)
        const nx = (X + 0.5 - cx) / 61
        const ny = (y + dy + 0.5 - cy) / 21
        if (nx * nx + ny * ny <= 1) p.soft(X, y + dy, k)
      }
      for (const [dx, dy] of [[2, 1], [3, 1], [4, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3]]) put(dx, dy, body)
      for (const dx of [2, 3, 4]) put(dx, 3, hi)
      for (const [dx, dy] of [[7, 1], [7, 2], [8, 0], [8, 1], [8, 2], [8, 3], [7, 3]]) put(dx, dy, tail)
      put(2, 2, 'f')
    }
    const leg = frame % 4
    const right = frame < 4
    fish(right ? 14 + leg * 26 : 92 - leg * 26, 9, right, 'x', 'y', 'u')
    fish(right ? 96 - leg * 22 : 22 + leg * 22, 20, !right, 'v', 'r', 't')
    fish(right ? 30 + leg * 18 : 74 - leg * 18, 29, right, 'z', 'A', 'n')
    p.soft(30 + ((frame * 7) % 60), 33 - (frame % 4) * 5, 'j')
    p.soft(70 + ((frame * 5) % 30), 30 - ((frame + 2) % 4) * 5, 'j')
  })
}

export const REEF_ANCHOR = { parent: 'reef_window', x: 7, y: 7 } as const

function sofa(): Sprite {
  return draw(60, 32, (p) => {
    p.box(3, 0, 54, 14, RED) // back
    for (const x of [4, 20, 36]) p.box(x, 2, 17, 11, { out: 's', sh: 't', base: 'u', lt: 'v', hi: 'v' })
    p.box(0, 8, 9, 20, RED) // arms
    p.box(51, 8, 9, 20, RED)
    p.box(8, 15, 44, 11, RED) // seat
    p.box(10, 16, 20, 9, { out: 's', sh: 't', base: 'u', lt: 'v', hi: 'v' })
    p.box(31, 16, 20, 9, { out: 's', sh: 't', base: 'u', lt: 'v', hi: 'v' })
    p.box(12, 8, 8, 8, GOLD) // a butter-yellow cushion
    p.rect(2, 28, 4, 4, 'b')
    p.rect(54, 28, 4, 4, 'b')
  })
}

function bottleShelf(): Sprite {
  return draw(62, 28, (p) => {
    const bottle = (x: number, y: number, body: string, shine: string) => {
      p.rect(x, y + 2, 4, 8, body)
      p.rect(x + 1, y, 2, 3, body)
      p.vline(x + 1, y + 4, 4, shine)
    }
    const colours: Array<[string, string]> = [['z', 'n'], ['u', 'v'], ['x', 'y'], ['E', 'G'], ['t', 'v'], ['l', 'n']]
    for (let i = 0; i < 9; i++) {
      const [b, s] = colours[(i * 5) % colours.length]
      bottle(3 + i * 6, 2, b, s)
    }
    for (let i = 0; i < 8; i++) {
      const [b, s] = colours[(i * 3 + 1) % colours.length]
      bottle(5 + i * 7, 16, b, s)
    }
    p.box(0, 12, 62, 3, WOOD)
    p.box(0, 26, 62, 2, WOOD)
    p.box(0, 0, 2, 28, DWOOD)
    p.box(60, 0, 2, 28, DWOOD)
  })
}

// =============================================================== captain's room

function captainDesk(): Sprite {
  return draw(64, 38, (p) => {
    // the clutter on top: a candle, a rolled chart, an inkwell and a compass
    p.rect(5, 6, 3, 6, 'r')
    p.put(6, 4, 'y')
    p.put(6, 3, 'x')
    p.rect(14, 8, 14, 4, 'q')
    p.hline(14, 8, 14, 'r')
    p.rect(14, 8, 2, 4, 'p')
    p.rect(34, 8, 5, 4, 'f')
    p.line(37, 4, 40, 8, 'j')
    p.disc(52, 9, 3, GOLD)
    p.put(52, 8, 'f')
    // desktop, drawers and legs
    p.box(0, 12, 64, 5, WOOD)
    p.box(2, 17, 60, 17, DWOOD)
    p.vline(32, 18, 15, 'a')
    for (const x of [14, 46]) {
      p.box(x - 8, 20, 16, 11, WOOD)
      p.rect(x - 1, 24, 3, 2, 'y')
    }
    p.rect(2, 34, 5, 4, 'a')
    p.rect(57, 34, 5, 4, 'a')
  })
}

// =============================================================== storage hold and weapons room

function crateStack(): Sprite {
  return draw(42, 42, (p) => {
    const crate = (x: number, y: number, w: number, h: number) => {
      p.box(x, y, w, h, WOOD)
      p.rect(x + 2, y + 2, w - 4, h - 4, 'c')
      p.line(x + 2, y + 2, x + w - 3, y + h - 3, 'b')
      p.line(x + 2, y + h - 3, x + w - 3, y + 2, 'b')
      p.hline(x + 1, y + 1, w - 2, 'd')
    }
    crate(0, 20, 22, 22)
    crate(20, 24, 22, 18)
    crate(6, 0, 24, 20)
    p.rect(8, 6, 2, 2, 'y')
  })
}

function barrelStack(): Sprite {
  return draw(38, 42, (p) => {
    const barrel = (x: number, y: number) => {
      p.vcyl(x, y, 16, 20, WOOD)
      p.hline(x, y + 4, 16, 'g')
      p.hline(x, y + 5, 16, 'h')
      p.hline(x, y + 14, 16, 'g')
      p.hline(x, y + 15, 16, 'h')
      p.rect(x + 1, y, 14, 2, 'd')
      p.hline(x + 1, y + 19, 14, 'a')
    }
    barrel(0, 22)
    barrel(20, 22)
    barrel(10, 2)
  })
}

function weaponRack(): Sprite {
  return draw(62, 54, (p) => {
    // frame
    p.vcyl(0, 2, 4, 52, DWOOD)
    p.vcyl(58, 2, 4, 52, DWOOD)
    p.box(0, 2, 62, 4, DWOOD)
    p.box(0, 30, 62, 3, WOOD)
    p.box(0, 50, 62, 4, DWOOD)
    // spears
    for (const x of [10, 17, 24]) {
      p.vline(x, 10, 42, 'c')
      p.vline(x + 1, 10, 42, 'b')
      p.line(x - 1, 14, x + 1, 5, 'i')
      p.line(x + 2, 14, x + 1, 5, 'h')
      p.rect(x - 1, 14, 4, 2, 'x')
    }
    // axes
    for (const x of [36, 46]) {
      p.vline(x, 12, 40, 'c')
      p.vline(x + 1, 12, 40, 'b')
      p.rect(x - 7, 12, 8, 9, 'i')
      p.rect(x - 8, 14, 2, 5, 'j')
      p.rect(x - 6, 13, 6, 2, 'j')
      p.rect(x, 12, 2, 9, 'g')
      p.rect(x + 2, 14, 5, 5, 'h')
    }
    // a sabre hanging on the right
    p.line(53, 12, 53, 46, 'i')
    p.vline(54, 12, 34, 'g')
    p.rect(51, 40, 5, 2, 'x')
  })
}

export function shipPropSprites(): RoomProp[] {
  const out: RoomProp[] = [
    prop('bunk_bed', bunkBed()),
    prop('hammock', hammock(), false),
    prop('footlocker', footlocker()),
    prop('reef_window', reefWindow(), false),
    prop('sofa', sofa()),
    prop('bottle_shelf', bottleShelf(), false),
    prop('captain_desk', captainDesk()),
    prop('crate_stack', crateStack()),
    prop('barrel_stack', barrelStack()),
    prop('weapon_rack', weaponRack())
  ]
  for (let i = 0; i < 8; i++) out.push({ name: `reef_fish_${i}`, sprite: reefFish(i), solid: false })
  return out
}
