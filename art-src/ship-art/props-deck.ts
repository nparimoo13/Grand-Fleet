import { BLUE, DSTEEL, DWOOD, FUR, GOLD, RED, STEEL, WOOD, draw } from './pix'
import type { Sprite } from './sprite'

/**
 * Props for the open-air decks and the top of the mast: figurehead deck, lawn & aquarium bar, helm, crow's nest gym.
 * All drawn at build time with Pix (palette-pure, top-left light). The outline and cast shadow are added by the build.
 */
export interface RoomProp {
  name: string
  sprite: Sprite
  /** Gets an auto outline and a cast shadow. */
  solid: boolean
  /** Stands on the floor: also gets a `floor_shadow_<w>` ground contact shadow. */
  floor?: boolean
}

const prop = (name: string, sprite: Sprite, floor = true, solid = true): RoomProp => ({ name, sprite, solid, floor })

// =============================================================== figurehead deck

function lion(): Sprite {
  return draw(52, 60, (p) => {
    // bowsprit post and brass collar
    p.vcyl(22, 40, 10, 20, WOOD)
    p.box(19, 38, 16, 4, GOLD)
    // mane: a ring of tufts, then the shaded disc
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      p.disc(30 + Math.cos(a) * 16, 22 + Math.sin(a) * 16, 4.6, GOLD)
    }
    p.disc(30, 22, 15, GOLD)
    for (const [x, y] of [[22, 10], [30, 7], [38, 10], [41, 20], [38, 31], [30, 35], [21, 31]]) p.disc(x, y, 2.2, GOLD)
    // face: light fur disc, protruding snout
    p.disc(26, 24, 10, FUR)
    p.disc(13, 28, 7.5, FUR)
    p.rect(4, 24, 4, 3, 'a') // nose
    p.put(4, 24, 's')
    p.line(7, 32, 14, 33, 'a') // mouth
    p.rect(9, 32, 2, 2, 'r') // fang
    // brow, eye, cheek
    p.line(18, 17, 26, 15, 'w')
    p.rect(21, 19, 4, 3, 'r')
    p.rect(22, 20, 2, 2, 'f')
    p.put(24, 20, 'j')
    p.line(18, 29, 22, 33, 'x')
    // ears
    p.disc(40, 8, 3, GOLD)
    p.put(40, 8, 'v')
  })
}

function ropeCoil(): Sprite {
  return draw(26, 14, (p) => {
    const coil = (y: number, rx: number, ry: number) => {
      p.ellipse(13, y, rx, ry, 'c')
      p.ellipse(13, y - 1, rx - 1, ry - 1, 'd')
      p.ellipse(13, y, rx - 5, Math.max(1, ry - 3), 'b')
    }
    coil(9, 12, 4.5)
    coil(5, 10, 4)
    for (let x = 4; x < 22; x += 3) p.put(x, 2 + (x % 2), 'e')
    for (let x = 3; x < 23; x += 4) p.put(x, 9, 'e')
  })
}

function lampPost(): Sprite {
  return draw(14, 44, (p) => {
    p.vcyl(5, 16, 4, 26, DSTEEL)
    p.box(2, 40, 10, 4, DSTEEL)
    p.box(2, 0, 10, 14, GOLD)
    p.rect(4, 2, 6, 10, 'y')
    p.rect(5, 4, 3, 5, 'r')
    p.hline(4, 12, 6, 'x')
    p.rect(5, 14, 4, 2, 'w')
  })
}

function anchor(): Sprite {
  return draw(34, 38, (p) => {
    p.eRing(17, 4, 3.5, 3.5, 'i', 2)
    p.vcyl(15, 7, 4, 26, STEEL)
    p.hcyl(7, 10, 20, 3, STEEL)
    p.box(5, 9, 3, 5, STEEL)
    p.box(26, 9, 3, 5, STEEL)
    // curved arms: the lower half of a ring
    for (let j = 22; j <= 34; j++) {
      for (let i = 2; i <= 32; i++) {
        const d = Math.hypot(i - 17, j - 22)
        if (d <= 13.2 && d > 10.4) p.soft(i, j, i < 15 ? 'i' : i < 20 ? 'h' : 'g')
      }
    }
    // flukes
    p.rows(1, 20, 6, ['.2 i2 .2', '. i3 h .', 'i2 h2 g2', 'i h3 g2'])
    p.rows(27, 20, 6, ['.2 h2 .2', '. i h2 g .', 'h2 g4', 'h g5'])
  })
}

function cannon(): Sprite {
  return draw(40, 24, (p) => {
    p.box(8, 12, 28, 5, WOOD) // carriage
    p.hcyl(1, 5, 34, 9, DSTEEL)
    p.box(0, 3, 5, 13, DSTEEL) // muzzle ring
    p.rect(0, 7, 2, 5, 'f') // bore
    p.box(31, 4, 5, 11, DSTEEL) // breech
    p.disc(34, 4, 2.2, DSTEEL)
    p.disc(26, 18, 5.5, WOOD)
    p.disc(26, 18, 2, GOLD)
    p.eRing(26, 18, 5, 5, 'a')
    for (let a = 0; a < 4; a++) {
      const r = (a * Math.PI) / 4
      p.line(Math.round(26 - Math.cos(r) * 4), Math.round(18 - Math.sin(r) * 4), Math.round(26 + Math.cos(r) * 4), Math.round(18 + Math.sin(r) * 4), 'b')
    }
  })
}

function cannonballs(): Sprite {
  return draw(16, 12, (p) => {
    for (const [x, y] of [[3, 8], [8, 8], [13, 8], [5, 4], [10, 4], [8, 1]]) p.disc(x, y, 2.6, DSTEEL)
  })
}

// =============================================================== lawn & aquarium bar

function piano(): Sprite {
  return draw(50, 40, (p) => {
    p.box(1, 0, 48, 6, DWOOD) // lid
    p.box(2, 6, 46, 14, DWOOD) // upper case
    p.rect(8, 8, 34, 9, 'q') // music rest with sheet music
    for (let y = 10; y < 17; y += 2) p.hline(11, y, 28, 'o')
    p.box(0, 20, 50, 4, DWOOD) // key bed
    p.rect(3, 20, 44, 5, 'r') // white keys
    for (let x = 6; x < 46; x += 4) p.vline(x, 20, 5, 'q')
    for (const x of [5, 9, 17, 21, 25, 33, 37, 41]) p.rect(x, 20, 2, 3, 'f') // black keys
    p.box(2, 25, 46, 8, DWOOD) // lower case
    p.vcyl(3, 31, 5, 9, DWOOD)
    p.vcyl(42, 31, 5, 9, DWOOD)
    p.hline(12, 35, 26, 'x') // pedal rail
    p.put(22, 36, 'y')
    p.put(27, 36, 'y')
  })
}

function barCounter(): Sprite {
  return draw(64, 38, (p) => {
    // bottles and glasses on top
    const bottle = (x: number, body: string, shine: string) => {
      p.rect(x, 4, 4, 9, body)
      p.rect(x + 1, 1, 2, 4, body)
      p.put(x + 1, 6, shine)
      p.vline(x + 1, 7, 3, shine)
    }
    bottle(4, 'z', 'n')
    bottle(10, 'u', 'v')
    bottle(16, 'x', 'y')
    bottle(22, 'E', 'G')
    for (const x of [38, 46, 54]) {
      p.rows(x, 7, 5, ['j .3 j', 'j .3 j', '. j3 .', '.2 j .2', '. j3 .'])
    }
    p.box(0, 13, 64, 5, WOOD) // counter top slab
    p.box(2, 18, 60, 18, DWOOD) // front
    for (let x = 6; x < 60; x += 9) p.vline(x, 20, 14, 'a') // slat seams
    for (let x = 7; x < 60; x += 9) p.vline(x, 20, 14, 'c')
    p.hline(2, 33, 60, 'x') // brass foot rail
    p.hline(2, 34, 60, 'w')
    p.hline(2, 36, 60, 'a')
  })
}

function barStool(): Sprite {
  return draw(14, 22, (p) => {
    p.ellipse(7, 3, 6, 2.6, 'u')
    p.hline(3, 2, 8, 'v')
    p.rect(2, 5, 10, 1, 't')
    p.vcyl(6, 6, 2, 12, STEEL)
    p.line(6, 17, 2, 21, 'h')
    p.line(7, 17, 11, 21, 'g')
    p.hline(3, 14, 8, 'i')
  })
}

function aquarium(): Sprite {
  return draw(58, 50, (p) => {
    p.box(0, 0, 58, 38, STEEL) // frame
    // water: light at the top, deep at the bottom, dithered between
    p.rect(3, 3, 52, 32, 'F')
    p.rect(3, 3, 52, 7, 'G')
    p.dither(3, 10, 52, 3, 'G')
    p.dither(3, 20, 52, 3, 'E', true)
    p.rect(3, 23, 52, 8, 'E')
    p.dither(3, 20, 52, 3, 'F')
    // sand and rocks
    p.rect(3, 30, 52, 5, 'e')
    p.dither(3, 30, 52, 2, 'd')
    p.disc(14, 29, 3.5, STEEL)
    p.disc(44, 30, 3, STEEL)
    // plants
    for (const [x, h] of [[8, 14], [11, 10], [47, 12], [50, 9]] as const) {
      for (let j = 0; j < h; j++) p.soft(x + (Math.floor(j / 3) % 2), 30 - j, j % 3 === 0 ? 'n' : 'A')
    }
    p.disc(24, 29, 2, RED)
    p.line(24, 28, 24, 24, 'u')
    p.line(24, 26, 22, 24, 'u')
    p.line(24, 26, 26, 23, 'u')
    // glass glints
    p.vline(5, 5, 6, 'j')
    p.put(5, 12, 'j')
    p.hline(8, 4, 3, 'j')
    // lid light and the cabinet below
    p.box(2, 0, 54, 3, STEEL)
    p.box(3, 38, 52, 12, WOOD)
    p.vline(29, 40, 9, 'a')
    p.rect(26, 43, 2, 3, 'y')
    p.rect(31, 43, 2, 3, 'y')
  })
}

/** Transparent overlay (same size as the tank's water): two fish swim there and back; 8 frames. */
function aquaFish(frame: number): Sprite {
  const W = 52
  const H = 32
  return draw(W, H, (p) => {
    const fish = (x: number, y: number, right: boolean, body: string, hi: string, tail: string) => {
      const px = (dx: number) => (right ? x + dx : x + 8 - dx)
      for (const [dx, dy] of [[2, 1], [3, 1], [4, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3]]) p.soft(px(dx), y + dy, body)
      for (const dx of [2, 3, 4]) p.soft(px(dx), y + 3, hi)
      for (const [dx, dy] of [[7, 1], [7, 2], [8, 0], [8, 1], [8, 2], [8, 3], [7, 3]]) p.soft(px(dx), y + dy, tail)
      p.soft(px(2), y + 2, 'f')
    }
    const leg = frame % 4
    const right = frame < 4
    const x1 = right ? 4 + leg * 10 : 34 - leg * 10
    fish(x1, 6, right, 'x', 'y', 'u')
    const x2 = right ? 40 - leg * 9 : 10 + leg * 9
    fish(x2, 17, !right, 'v', 'r', 't')
    p.soft(14 + ((frame * 3) % 20), 25 - (frame % 4) * 4, 'j')
    p.soft(30 + ((frame * 5) % 12), 22 - ((frame + 2) % 4) * 4, 'j')
  })
}

function palm(): Sprite {
  return draw(48, 76, (p) => {
    for (let y = 30; y < 76; y++) {
      const x = 19 + Math.round(Math.sin((76 - y) / 22) * 3)
      const w = 6 + (y > 66 ? 2 : 0)
      for (let i = 0; i < w; i++) p.soft(x + i, y, i === 0 ? 'd' : i < 3 ? 'c' : i === w - 1 ? 'a' : 'b')
      if (y % 5 === 0) p.hline(x, y, w, 'b')
    }
    const frond = (dx: number, dy: number, droop: number) => {
      const x0 = 23
      const y0 = 30
      let prev: [number, number] = [x0, y0]
      for (let t = 1; t <= 14; t++) {
        const u = t / 14
        const px = Math.round(x0 + dx * u)
        const py = Math.round(y0 + dy * u + droop * u * u)
        p.line(prev[0], prev[1], px, py, 'A')
        p.soft(px, py + 1, 'z')
        p.soft(prev[0], prev[1] - 1, 'n')
        if (t % 2 === 0) {
          p.soft(px, py + 2, 'z')
          p.soft(px + (dx > 0 ? -1 : 1), py + 2, 'A')
          p.soft(px, py + 3, 'z')
        }
        prev = [px, py]
      }
    }
    frond(-20, -12, 20)
    frond(20, -12, 20)
    frond(-14, -24, 22)
    frond(14, -24, 22)
    frond(0, -26, 10)
    frond(-24, 0, 16)
    frond(24, 0, 16)
    p.disc(21, 33, 2.6, WOOD)
    p.disc(26, 34, 2.6, WOOD)
    p.disc(23, 30, 2.4, DWOOD)
  })
}

function deckChair(): Sprite {
  return draw(34, 26, (p) => {
    for (let t = 0; t <= 16; t++) {
      const x = 5 + Math.round(t * 0.5)
      const y = 17 - t
      for (let i = 0; i < 6; i++) p.soft(x + i, y, Math.floor(t / 3) % 2 === 0 ? (i === 0 ? 'v' : 'u') : i === 0 ? 'r' : 'q')
    }
    for (let x = 6; x < 29; x++) {
      const c = Math.floor((x - 6) / 3) % 2 === 0
      p.rect(x, 18, 1, 4, c ? 'u' : 'r')
      p.put(x, 21, c ? 't' : 'o')
    }
    p.line(4, 8, 8, 24, 'c')
    p.line(5, 8, 9, 24, 'b')
    p.line(26, 21, 31, 25, 'c')
    p.line(25, 21, 30, 25, 'b')
    p.hline(4, 24, 6, 'b')
  })
}

function planter(): Sprite {
  return draw(30, 22, (p) => {
    p.box(0, 12, 30, 9, WOOD)
    p.hline(1, 15, 28, 'b')
    for (const [x, h, c] of [[4, 8, 'u'], [9, 10, 'y'], [14, 7, 'v'], [19, 10, 'u'], [24, 8, 'y']] as const) {
      p.vline(x, 12 - h, h, 'A')
      p.disc(x, 12 - h - 1, 2.2, { out: 'a', sh: 't', base: c, lt: 'r', hi: 'r' })
      p.put(x - 2, 11, 'z')
      p.put(x + 2, 10, 'A')
    }
    for (let x = 1; x < 29; x += 3) p.put(x, 12, 'z')
  })
}

function parasolTable(): Sprite {
  return draw(44, 60, (p) => {
    p.vcyl(21, 12, 3, 46, STEEL)
    for (let j = 0; j < 14; j++) {
      const half = 3 + Math.round(j * 1.45)
      for (let x = 22 - half; x <= 22 + half; x++) {
        const seg = Math.floor((x - (22 - half)) / 4)
        const lit = seg % 2 === 0
        p.soft(x, j, lit ? (j > 11 ? 't' : 'u') : j > 11 ? 'p' : 'r')
      }
    }
    p.hline(6, 13, 33, 's')
    p.put(22, 0, 'y')
    p.ellipse(22, 40, 15, 3.2, 'q')
    p.hline(9, 39, 26, 'r')
    p.hline(8, 42, 28, 'o')
    p.ellipse(22, 58, 9, 1.8, 'g')
    p.rect(13, 37, 3, 2, 'y') // a lemon on the table
    p.put(13, 37, 'r')
  })
}

// =============================================================== helm

function shipWheel(): Sprite {
  return draw(46, 56, (p) => {
    p.vcyl(19, 30, 8, 26, DWOOD)
    p.box(15, 52, 16, 4, DWOOD)
    for (let a = 0; a < 8; a++) {
      const r = (a * Math.PI) / 4
      const x1 = 23 + Math.cos(r) * 20
      const y1 = 21 + Math.sin(r) * 20
      p.line(23, 21, Math.round(23 + Math.cos(r) * 17), Math.round(21 + Math.sin(r) * 17), 'c')
      p.disc(x1, y1, 2.6, WOOD) // handles
    }
    p.eRing(23, 21, 15, 15, 'c', 3)
    p.eRing(23, 21, 15, 15, 'd', 1)
    p.eRing(23, 21, 12, 12, 'b', 1)
    p.disc(23, 21, 5, GOLD)
    p.put(21, 19, 'r')
  })
}

function binnacle(): Sprite {
  return draw(22, 36, (p) => {
    p.vcyl(6, 19, 10, 17, GOLD)
    p.box(3, 32, 16, 4, GOLD)
    p.disc(11, 11, 10, GOLD)
    p.ellipse(11, 11, 7, 7, 'q')
    p.eRing(11, 11, 7, 7, 'y')
    p.vline(11, 5, 12, 'o')
    p.hline(5, 11, 13, 'o')
    p.line(11, 11, 11, 5, 'u')
    p.line(10, 11, 11, 6, 'u')
    p.line(11, 11, 11, 17, 'f')
    p.put(11, 11, 'f')
    p.put(8, 7, 'r')
    p.put(7, 8, 'j')
  })
}

function bigWindow(): Sprite {
  return draw(52, 42, (p) => {
    p.box(0, 0, 52, 42, WOOD)
    p.rect(4, 4, 44, 30, 'G')
    p.rect(4, 4, 44, 10, 'F')
    p.rect(4, 4, 44, 4, 'E')
    p.dither(4, 8, 44, 3, 'F')
    p.rect(4, 22, 44, 12, 'F')
    p.dither(4, 20, 44, 3, 'G', true)
    p.dither(4, 28, 44, 2, 'E')
    p.hline(10, 23, 8, 'j')
    p.hline(30, 25, 10, 'j')
    p.rect(12, 9, 8, 2, 'j')
    p.rect(14, 8, 5, 1, 'j')
    p.rect(34, 12, 6, 2, 'j')
    p.vcyl(24, 4, 4, 30, WOOD)
    p.hcyl(4, 18, 44, 3, WOOD)
    p.line(7, 6, 11, 14, 'j')
    p.line(8, 6, 12, 14, 'i')
    p.box(0, 34, 52, 8, WOOD)
    p.hline(2, 37, 48, 'b')
  })
}

function telescope(): Sprite {
  return draw(34, 44, (p) => {
    p.line(15, 20, 6, 42, 'c')
    p.line(16, 20, 7, 42, 'b')
    p.line(16, 20, 26, 42, 'c')
    p.line(17, 20, 27, 42, 'b')
    p.line(16, 22, 16, 42, 'c')
    p.hline(10, 34, 13, 'b')
    p.disc(16, 20, 3.4, GOLD)
    // tube pointing up-left, three tones thick
    p.line(15, 18, 3, 6, 'y')
    p.line(16, 18, 4, 6, 'x')
    p.line(17, 18, 5, 6, 'x')
    p.line(18, 18, 6, 6, 'w')
    p.line(15, 19, 22, 24, 'x')
    p.line(16, 18, 24, 22, 'x')
    p.rect(2, 4, 4, 4, 'i')
    p.disc(3, 5, 2, STEEL)
    p.rect(20, 18, 5, 7, 'g')
  })
}

function shipBell(): Sprite {
  return draw(20, 26, (p) => {
    p.box(0, 0, 20, 3, WOOD)
    p.vline(2, 3, 3, 'c')
    p.vline(17, 3, 3, 'c')
    p.hline(3, 6, 14, 'w')
    p.disc(10, 11, 6.4, GOLD)
    // flared mouth: each row a little wider, lit on the left and shaded on the right
    for (let j = 0; j < 6; j++) {
      const half = 6 + Math.floor(j / 2)
      p.hline(10 - half, 14 + j, half * 2, 'x')
      p.put(10 - half, 14 + j, 'y')
      p.put(10 + half - 1, 14 + j, 'w')
    }
    p.hline(3, 20, 14, 'w')
    p.disc(10, 22, 2, DSTEEL)
  })
}

function ropeHank(): Sprite {
  return draw(18, 28, (p) => {
    p.rect(8, 0, 3, 3, 'c')
    p.put(8, 0, 'd')
    for (let i = 0; i < 4; i++) {
      p.eRing(9, 12 + i, 5 - Math.floor(i / 2), 8, i % 2 ? 'c' : 'd', 1)
    }
    p.arc(9, 3, 4, 200, 340, 'd', 1)
    p.rect(6, 22, 6, 2, 'b')
    p.hline(6, 21, 6, 'e')
  })
}

function wallFlag(): Sprite {
  return draw(28, 32, (p) => {
    p.vcyl(0, 0, 3, 32, DWOOD)
    p.disc(1, 1, 2.4, GOLD)
    for (let x = 3; x < 27; x++) {
      const wave = Math.round(Math.sin(x / 3) * 1.2)
      for (let y = 3; y < 22; y++) p.soft(x, y + wave, 'f')
    }
    // skull and crossbones with a straw hat
    p.ellipse(15, 12, 4, 4, 'j')
    p.rect(12, 11, 2, 2, 'f')
    p.rect(16, 11, 2, 2, 'f')
    p.rect(13, 15, 5, 2, 'j')
    p.vline(14, 15, 2, 'f')
    p.vline(16, 15, 2, 'f')
    p.line(7, 15, 24, 20, 'i')
    p.line(7, 20, 24, 15, 'i')
    p.ellipse(15, 7, 7, 1.3, 'y')
    p.rect(11, 3, 9, 4, 'y')
    p.hline(11, 6, 9, 'u')
    p.hline(11, 3, 9, 'r')
  })
}

// =============================================================== crow's nest gym

function weightRack(): Sprite {
  return draw(52, 44, (p) => {
    p.vcyl(0, 2, 4, 42, DSTEEL)
    p.vcyl(48, 2, 4, 42, DSTEEL)
    p.hcyl(2, 8, 48, 3, STEEL)
    p.hcyl(2, 22, 48, 3, STEEL)
    p.hcyl(2, 36, 48, 3, STEEL)
    p.box(0, 42, 52, 2, DSTEEL)
    const plate = (x: number, y: number, r: number) => {
      p.disc(x, y, r, DSTEEL)
      p.disc(x, y, 1.4, STEEL)
    }
    plate(11, 4, 4)
    plate(17, 4, 4)
    plate(36, 4, 4)
    plate(41, 4, 4)
    plate(10, 17, 5.5)
    plate(19, 17, 5.5)
    plate(34, 17, 4.5)
    plate(42, 17, 4.5)
    plate(10, 31, 4)
    plate(16, 31, 4)
    plate(23, 31, 4)
    p.box(32, 27, 8, 8, DSTEEL)
    p.box(41, 27, 6, 8, DSTEEL)
  })
}

function viewport(): Sprite {
  return draw(48, 48, (p) => {
    p.disc(24, 24, 23, STEEL)
    p.ellipse(24, 24, 18, 18, 'G')
    for (let y = 6; y < 42; y++) {
      for (let x = 6; x < 42; x++) {
        if (Math.hypot(x - 24, y - 24) > 18) continue
        const k = y < 14 ? 'E' : y < 17 ? ((x + y) % 2 === 0 ? 'E' : 'F') : y < 26 ? 'F' : y < 29 ? ((x + y) % 2 === 0 ? 'F' : 'G') : y < 33 ? 'G' : 'F'
        p.put(x, y, k)
      }
    }
    p.hline(14, 28, 6, 'j')
    p.hline(30, 31, 8, 'j')
    p.rect(14, 12, 6, 2, 'j')
    p.rect(16, 11, 3, 1, 'j')
    p.vcyl(22, 6, 4, 36, STEEL)
    p.hcyl(6, 22, 36, 4, STEEL)
    p.eRing(24, 24, 18, 18, 'g', 2)
    p.line(10, 12, 14, 20, 'j')
    for (let a = 0; a < 12; a++) {
      const r = (a * Math.PI) / 6
      p.disc(24 + Math.cos(r) * 20.5, 24 + Math.sin(r) * 20.5, 1.3, { out: 'g', sh: 'g', base: 'i', lt: 'j', hi: 'j' })
    }
  })
}

function wallCushion(): Sprite {
  return draw(32, 48, (p) => {
    p.box(0, 0, 32, 48, RED)
    p.hline(2, 2, 28, 'y')
    p.hline(2, 45, 28, 'w')
    p.vline(2, 2, 44, 'y')
    p.vline(29, 2, 44, 'w')
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 6 + col * 10 + (row % 2) * 5
        const y = 7 + row * 8
        if (x > 27) continue
        p.put(x, y, 's')
        p.put(x + 1, y, 't')
        p.put(x - 1, y - 1, 'v')
        p.put(x, y + 1, 't')
      }
    }
  })
}

function punchingBag(): Sprite {
  return draw(20, 58, (p) => {
    p.vline(9, 0, 8, 'i')
    for (let y = 1; y < 8; y += 2) p.put(10, y, 'h')
    p.box(5, 7, 10, 3, STEEL)
    p.vcyl(3, 10, 14, 46, RED)
    p.hline(3, 15, 14, 'y')
    p.hline(3, 48, 14, 'y')
    p.hline(3, 16, 14, 'w')
    p.hline(3, 49, 14, 'w')
    p.ellipse(10, 55, 7, 1.6, 't')
    p.vline(6, 18, 28, 'v')
  })
}

function barbellBench(): Sprite {
  return draw(52, 30, (p) => {
    p.hcyl(0, 6, 52, 2, STEEL)
    for (const x of [2, 46]) {
      p.box(x, 0, 4, 14, DSTEEL)
      p.box(x + (x < 20 ? 4 : -3), 2, 3, 10, DSTEEL)
    }
    p.vcyl(14, 8, 3, 8, STEEL)
    p.vcyl(35, 8, 3, 8, STEEL)
    p.box(8, 16, 38, 6, RED)
    p.hline(10, 18, 34, 'v')
    p.vcyl(11, 22, 3, 8, STEEL)
    p.vcyl(40, 22, 3, 8, STEEL)
    p.hline(8, 29, 8, 'f')
    p.hline(36, 29, 8, 'f')
  })
}

function kettlebells(): Sprite {
  return draw(38, 18, (p) => {
    for (const [x, r] of [[7, 5.5], [20, 6.5], [32, 4.5]] as const) {
      p.disc(x, 12, r, DSTEEL)
      p.arc(x, 5, 4, 180, 360, 'g', 2)
      p.put(x - 2, 11, 'i')
    }
  })
}

function chinUpBar(): Sprite {
  return draw(44, 60, (p) => {
    p.vcyl(1, 2, 4, 56, DSTEEL)
    p.vcyl(39, 2, 4, 56, DSTEEL)
    p.hcyl(2, 2, 40, 4, STEEL)
    p.box(0, 56, 10, 4, DSTEEL)
    p.box(34, 56, 10, 4, DSTEEL)
    p.rect(14, 1, 5, 6, 'u')
    p.rect(26, 1, 5, 6, 'u')
    p.put(14, 1, 'v')
    p.put(26, 1, 'v')
  })
}

function swordRack(): Sprite {
  return draw(34, 40, (p) => {
    p.vcyl(0, 2, 4, 36, WOOD)
    p.vcyl(30, 2, 4, 36, WOOD)
    for (const [y, grip, wrap] of [[8, 'j', 'i'], [19, 'f', 'g'], [30, 'u', 't']] as const) {
      p.hcyl(1, y, 32, 2, { out: 'g', sh: 'h', base: 'i', lt: 'j', hi: 'j' })
      p.disc(7, y + 1, 3, GOLD)
      p.rect(0, y - 1, 6, 4, grip)
      for (let x = 1; x < 6; x += 2) p.vline(x, y - 1, 4, wrap)
      p.put(0, y, 'e')
    }
    p.box(0, 0, 34, 3, WOOD)
    p.box(0, 37, 34, 3, WOOD)
  })
}

function waterCooler(): Sprite {
  return draw(18, 38, (p) => {
    p.disc(9, 7, 6.4, BLUE)
    p.rect(4, 13, 10, 3, 'F')
    p.box(2, 15, 14, 19, STEEL)
    p.rect(8, 21, 2, 2, 'u')
    p.rect(8, 25, 2, 2, 'G')
    p.hline(6, 30, 6, 'g')
    p.box(1, 34, 16, 4, DSTEEL)
    p.put(5, 6, 'j')
  })
}

function sparringMat(): Sprite {
  return draw(64, 10, (p) => {
    p.box(0, 0, 64, 8, { out: 'z', sh: 'z', base: 'A', lt: 'n', hi: 'n' })
    p.hline(2, 1, 60, 'n')
    p.eRing(32, 4, 13, 2, 'j', 1)
    p.hline(2, 7, 60, 'z')
    p.vline(31, 1, 6, 'j')
    p.rect(0, 8, 64, 2, 'k')
  })
}

export function deckPropSprites(): RoomProp[] {
  const frames: RoomProp[] = [
    // figurehead deck
    prop('lion_figurehead', lion(), false),
    prop('rope_coil', ropeCoil()),
    prop('lamp_post', lampPost()),
    prop('anchor', anchor()),
    prop('cannon', cannon()),
    prop('cannonballs', cannonballs()),
    // lawn & aquarium bar
    prop('piano', piano()),
    prop('bar_counter', barCounter()),
    prop('bar_stool', barStool()),
    prop('aquarium', aquarium()),
    prop('palm_tree', palm()),
    prop('deck_chair', deckChair()),
    prop('flower_planter', planter()),
    prop('parasol_table', parasolTable()),
    // helm
    prop('ship_wheel', shipWheel()),
    prop('compass_binnacle', binnacle()),
    prop('window_big', bigWindow(), false),
    prop('telescope', telescope()),
    prop('ship_bell', shipBell(), false),
    prop('rope_hank', ropeHank(), false),
    prop('wall_flag', wallFlag(), false),
    // crow's nest gym
    prop('weight_rack', weightRack()),
    prop('viewport', viewport(), false),
    prop('wall_cushion', wallCushion(), false),
    prop('punching_bag', punchingBag(), false),
    prop('barbell_bench', barbellBench()),
    prop('kettlebells', kettlebells()),
    prop('chin_up_bar', chinUpBar()),
    prop('sword_rack', swordRack(), false),
    prop('water_cooler', waterCooler()),
    prop('sparring_mat', sparringMat())
  ]
  for (let i = 0; i < 8; i++) frames.push({ name: `aqua_fish_${i}`, sprite: aquaFish(i), solid: false })
  return frames
}

/** Where the aquarium fish overlay sits inside the tank sprite. */
export const AQUARIUM_ANCHOR = { parent: 'aquarium', x: 3, y: 3 } as const