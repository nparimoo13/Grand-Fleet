import { BLUE, DSTEEL, DWOOD, GOLD, LEAF, RED, STEEL, WOOD, CREAM, draw, type Pix, type Ramp } from './pix'
import type { RoomProp } from './props-deck'
import type { Sprite } from './sprite'

/** Props for the navigator's map room, the library and the infirmary. Drawn at build time with Pix. */

const prop = (name: string, sprite: Sprite, floor = true, solid = true): RoomProp => ({ name, sprite, solid, floor })

/** Deterministic RNG so book spines are the same on every build. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TERRACOTTA: Ramp = { out: 'a', sh: 'b', base: 'c', lt: 'd', hi: 'e' }

// =============================================================== navigator's map room

function chartTable(): Sprite {
  return draw(64, 46, (p) => {
    // desk lamp
    p.box(50, 14, 8, 3, DSTEEL)
    p.line(54, 14, 50, 6, 'h')
    p.line(55, 14, 51, 6, 'g')
    p.rows(44, 1, 10, ['.3 x4 .3', '.2 y x4 w .2', '. y x6 w .', 'x7 w2 w'])
    p.rect(46, 8, 4, 1, 'y') // light spill under the shade
    // table top, seen slightly from above
    p.rows(0, 17, 64, ['. q61 p .', 'q* o', 'q* o'])
    p.hline(6, 19, 20, 'o') // chart lines
    p.hline(30, 20, 22, 'o')
    p.rect(11, 19, 2, 1, 'u') // pins
    p.rect(38, 20, 2, 1, 'u')
    p.disc(46, 20, 2.2, GOLD) // brass compass
    p.box(0, 21, 64, 5, WOOD)
    p.hline(2, 24, 60, 'b')
    p.vcyl(4, 26, 6, 20, WOOD)
    p.vcyl(54, 26, 6, 20, WOOD)
    p.hline(10, 36, 44, 'b')
    p.hline(10, 37, 44, 'a')
  })
}

function globe(): Sprite {
  return draw(30, 42, (p) => {
    p.vcyl(13, 30, 4, 8, DWOOD)
    p.box(7, 38, 16, 4, DWOOD)
    p.disc(15, 15, 11.5, BLUE)
    p.ellipse(12, 11, 4, 3, 'A')
    p.ellipse(19, 18, 3, 4, 'A')
    p.ellipse(9, 20, 2, 2, 'z')
    p.rect(11, 9, 3, 1, 'n')
    p.rect(19, 16, 2, 1, 'n')
    p.put(10, 9, 'j')
    p.put(9, 10, 'j')
    p.eRing(15, 15, 13, 13, 'y', 1)
    p.vline(15, 27, 4, 'y')
    p.put(15, 2, 'r')
  })
}

function berryChest(): Sprite {
  return draw(36, 28, (p) => {
    p.box(1, 0, 34, 9, DWOOD) // open lid, seen from the front
    p.rect(3, 2, 30, 5, 'a')
    p.box(0, 9, 36, 17, WOOD)
    p.hline(1, 12, 34, 'b')
    p.vcyl(3, 9, 4, 17, STEEL)
    p.vcyl(29, 9, 4, 17, STEEL)
    p.rect(15, 14, 6, 6, 'x')
    p.rect(17, 16, 2, 3, 'f')
    // coins piled above the rim
    for (const [x, y, k] of [[5, 6, 'y'], [9, 4, 'x'], [14, 5, 'y'], [19, 3, 'y'], [24, 5, 'x'], [28, 6, 'y'], [12, 7, 'x'], [22, 7, 'y'], [16, 2, 'r']] as const) {
      p.disc(x, y, 2.2, GOLD)
      p.put(x, y, k)
    }
    p.hline(2, 8, 32, 'w')
  })
}

function tangerineTree(): Sprite {
  return draw(42, 62, (p) => {
    p.vcyl(18, 28, 5, 18, WOOD)
    for (const [x, y, r] of [[21, 13, 8], [11, 20, 7], [31, 20, 7], [16, 8, 6], [27, 9, 6], [21, 24, 6.5]] as const) p.disc(x, y, r, LEAF)
    for (const [x, y] of [[14, 14], [24, 10], [29, 18], [10, 22], [20, 20], [32, 24], [17, 26], [22, 5]]) {
      p.disc(x, y, 2.3, GOLD)
      p.put(x - 1, y - 1, 'r')
    }
    p.box(10, 44, 22, 16, TERRACOTTA)
    p.hline(10, 47, 22, 'b')
    p.box(8, 43, 26, 4, TERRACOTTA)
    p.hline(11, 55, 20, 'b')
  })
}

function wallChart(): Sprite {
  return draw(54, 40, (p) => {
    p.box(0, 0, 54, 40, WOOD)
    p.rect(3, 3, 48, 34, 'F')
    p.dither(3, 3, 48, 34, 'G')
    p.dither(3, 3, 48, 8, 'F', true)
    p.ellipse(16, 16, 8, 5, 'A')
    p.ellipse(13, 13, 4, 3, 'z')
    p.ellipse(34, 12, 6, 4, 'A')
    p.ellipse(36, 26, 7, 5, 'e')
    p.ellipse(35, 25, 4, 3, 'A')
    p.ellipse(14, 28, 3, 2, 'd')
    for (let x = 8; x < 44; x += 4) p.put(x, 22 - Math.round(Math.sin(x / 4) * 3), 'u') // dotted route
    p.line(40, 8, 40, 14, 'f')
    p.line(37, 11, 43, 11, 'f')
    p.put(40, 7, 'u')
    p.rect(5, 4, 3, 2, 'y')
  })
}

function scrollRack(): Sprite {
  return draw(32, 40, (p) => {
    p.box(0, 14, 32, 24, WOOD)
    for (const [x, y] of [[8, 20], [16, 20], [24, 20], [8, 30], [16, 30], [24, 30]]) {
      p.disc(x, y, 3.2, DWOOD)
      p.disc(x, y, 2.2, CREAM)
      p.put(x, y, 'o')
    }
    for (const [x, h] of [[6, 12], [15, 8], [23, 10]] as const) {
      p.vcyl(x, 14 - h, 4, h, CREAM)
      p.rect(x, 14 - h, 4, 2, 'u')
    }
    p.hline(1, 34, 30, 'b')
  })
}

function mapChair(): Sprite {
  return draw(26, 36, (p) => {
    p.box(5, 0, 16, 16, RED)
    p.hline(7, 3, 12, 'v')
    p.box(3, 16, 20, 5, RED)
    p.vcyl(11, 21, 4, 9, STEEL)
    p.line(12, 30, 3, 35, 'h')
    p.line(13, 30, 22, 35, 'g')
    p.line(12, 30, 12, 35, 'i')
    p.disc(3, 35, 1.4, DSTEEL)
    p.disc(12, 35, 1.4, DSTEEL)
    p.disc(22, 35, 1.4, DSTEEL)
  })
}

// =============================================================== library

const SPINE_COLORS: Array<{ base: string; lt: string; sh: string }> = [
  { base: 'u', lt: 'v', sh: 't' },
  { base: 'F', lt: 'G', sh: 'E' },
  { base: 'A', lt: 'n', sh: 'z' },
  { base: 'x', lt: 'y', sh: 'w' },
  { base: 'm', lt: 'n', sh: 'l' },
  { base: 't', lt: 'u', sh: 's' },
  { base: 'E', lt: 'F', sh: 'f' },
  { base: 'c', lt: 'd', sh: 'b' },
  { base: 'p', lt: 'q', sh: 'o' },
  { base: 'g', lt: 'h', sh: 'f' }
]

/** A shelf row of individually coloured book spines, some leaning, with the odd trinket. */
function bookRow(p: Pix, x0: number, y: number, w: number, h: number, rnd: () => number): void {
  let x = x0
  while (x < x0 + w) {
    const roll = rnd()
    const bw = 2 + Math.floor(rnd() * 3)
    if (x + bw > x0 + w) break
    if (roll < 0.06 && x + 5 <= x0 + w) {
      // a small brass globe/trinket on its own
      p.disc(x + 2, y + h - 3, 2, GOLD)
      x += 5
      continue
    }
    const bh = h - 2 - Math.floor(rnd() * 3)
    const c = SPINE_COLORS[Math.floor(rnd() * SPINE_COLORS.length)]
    const top = y + h - bh
    const lean = roll > 0.9 ? 1 : 0
    for (let j = 0; j < bh; j++) {
      const off = lean && j < 3 ? 1 : 0
      for (let i = 0; i < bw; i++) p.soft(x + i + off, top + j, i === 0 ? c.lt : i === bw - 1 ? c.sh : c.base)
    }
    if (bw >= 3) {
      p.hline(x, top + 2, bw, 'y')
      p.hline(x, y + h - 3, bw, 'y')
    } else if (rnd() > 0.5) p.hline(x, top + 1, bw, 'r')
    x += bw + (lean ? 1 : 0)
  }
}

function bookshelf(seed: number, w: number, h: number): Sprite {
  return draw(w, h, (p) => {
    const rnd = rng(seed)
    p.box(0, 0, w, h, DWOOD)
    const rows = Math.floor((h - 4) / 14)
    p.rect(2, 2, w - 4, h - 4, 'a') // dark cavity behind the books
    for (let r = 0; r < rows; r++) {
      const y = 2 + r * 14
      bookRow(p, 3, y, w - 6, 12, rnd)
      p.hline(2, y + 12, w - 4, 'c')
      p.hline(2, y + 13, w - 4, 'b')
    }
    p.hline(0, 0, w, 'd')
    p.vline(0, 0, h, 'd')
    p.box(0, 0, w, 3, WOOD)
  })
}

function readingChair(): Sprite {
  return draw(38, 36, (p) => {
    p.box(5, 0, 28, 22, RED)
    p.disc(8, 4, 3.5, RED)
    p.disc(30, 4, 3.5, RED)
    for (const [x, y] of [[14, 6], [24, 6], [19, 11], [14, 16], [24, 16]]) {
      p.put(x, y, 's')
      p.put(x - 1, y - 1, 'v')
    }
    p.box(0, 14, 9, 16, RED) // arms
    p.box(29, 14, 9, 16, RED)
    p.box(7, 20, 24, 8, RED) // cushion
    p.hline(9, 22, 20, 'v')
    p.hline(9, 27, 20, 'y')
    p.rect(3, 30, 4, 6, 'b')
    p.rect(31, 30, 4, 6, 'b')
    p.hline(3, 35, 4, 'a')
    p.hline(31, 35, 4, 'a')
  })
}

function coffeeTable(): Sprite {
  return draw(38, 22, (p) => {
    p.box(0, 8, 38, 4, DWOOD)
    p.hline(2, 10, 34, 'a')
    p.vcyl(3, 12, 4, 9, DWOOD)
    p.vcyl(31, 12, 4, 9, DWOOD)
    // a stack of books and a coffee cup with a curl of steam
    p.box(5, 3, 12, 3, BLUE)
    p.box(6, 6, 11, 2, RED)
    p.rect(8, 4, 6, 1, 'y')
    p.box(25, 4, 7, 4, CREAM)
    p.rect(26, 5, 5, 1, 'b')
    p.put(32, 5, 'p')
    p.put(33, 6, 'p')
    p.put(27, 2, 'j')
    p.put(28, 1, 'j')
    p.put(27, 0, 'i')
  })
}

function rollingLadder(): Sprite {
  return draw(20, 70, (p) => {
    p.vcyl(2, 2, 3, 66, WOOD)
    p.vcyl(15, 2, 3, 66, WOOD)
    for (let y = 8; y < 64; y += 8) {
      p.hcyl(2, y, 16, 3, WOOD)
    }
    p.hline(0, 0, 20, 'x') // brass rail clip
    p.hline(0, 1, 20, 'w')
    p.disc(3, 67, 1.8, DSTEEL)
    p.disc(16, 67, 1.8, DSTEEL)
  })
}

function floorLamp(): Sprite {
  return draw(18, 58, (p) => {
    p.vcyl(8, 14, 3, 40, GOLD)
    p.ellipse(9, 56, 6, 1.8, 'w')
    p.rect(3, 54, 12, 2, 'x')
    p.rows(2, 0, 14, [
      '.4 x6 .4',
      '.3 y x6 w .3',
      '.2 y x8 w .2',
      '. y x10 w .',
      'y x12 w',
      'w14'
    ])
    p.hline(5, 6, 8, 'r')
    p.hline(4, 14, 10, 'w')
  })
}

function wallClock(): Sprite {
  return draw(22, 22, (p) => {
    p.disc(11, 11, 10, GOLD)
    p.ellipse(11, 11, 7.5, 7.5, 'r')
    for (let a = 0; a < 12; a++) {
      const r = (a * Math.PI) / 6
      p.put(Math.round(11 + Math.cos(r) * 6.4), Math.round(11 + Math.sin(r) * 6.4), 'o')
    }
    p.line(11, 11, 11, 6, 'f')
    p.line(11, 11, 15, 12, 'f')
    p.put(11, 11, 'u')
    p.put(8, 7, 'j')
  })
}

function fernPot(): Sprite {
  return draw(32, 38, (p) => {
    for (const [dx, dy, droop] of [[-12, -14, 10], [12, -14, 10], [-6, -22, 6], [6, -22, 6], [0, -25, 3], [-15, -4, 12], [15, -4, 12]] as const) {
      let prev: [number, number] = [16, 20]
      for (let t = 1; t <= 12; t++) {
        const u = t / 12
        const px = Math.round(16 + dx * u)
        const py = Math.round(20 + dy * u + droop * u * u)
        p.line(prev[0], prev[1], px, py, 'A')
        p.soft(px, py + 1, 'z')
        if (t % 2 === 0) {
          p.soft(px - 1, py + 1, 'A')
          p.soft(px + 1, py + 1, 'A')
          p.soft(px, py - 1, 'n')
        }
        prev = [px, py]
      }
    }
    p.box(7, 24, 18, 12, TERRACOTTA)
    p.box(5, 22, 22, 4, TERRACOTTA)
    p.hline(8, 31, 16, 'b')
  })
}

// =============================================================== infirmary

function medicineCabinet(): Sprite {
  return draw(42, 54, (p) => {
    p.box(0, 0, 42, 54, CREAM)
    p.box(3, 3, 36, 48, WOOD)
    p.rect(5, 5, 32, 44, 'a')
    for (let r = 0; r < 3; r++) {
      const y = 6 + r * 14
      const rnd = rng(40 + r)
      let x = 6
      while (x < 34) {
        const w = 3 + Math.floor(rnd() * 3)
        const h = 7 + Math.floor(rnd() * 4)
        const c = ['G', 'A', 'u', 'y', 'm', 'v'][Math.floor(rnd() * 6)]
        p.rect(x, y + 12 - h, w, h, c)
        p.rect(x, y + 12 - h, w, 2, 'j')
        p.vline(x, y + 12 - h + 2, h - 2, 'r')
        x += w + 1
      }
      p.hline(5, y + 12, 32, 'c')
    }
    p.vline(21, 4, 46, 'i')
    p.vline(22, 4, 46, 'g')
    p.rect(19, 24, 2, 5, 'x')
    p.rect(24, 24, 2, 5, 'x')
    // red cross above the doors
    p.rect(19, 0, 4, 2, 'u')
  })
}

function cot(): Sprite {
  return draw(66, 30, (p) => {
    p.vcyl(1, 4, 3, 24, STEEL)
    p.vcyl(62, 8, 3, 20, STEEL)
    for (let x = 6; x < 60; x += 6) p.put(x, 27, 'g')
    p.box(0, 14, 66, 10, STEEL) // frame
    p.box(3, 8, 60, 9, CREAM) // mattress
    p.rect(3, 8, 60, 3, 'r')
    p.box(23, 6, 40, 11, BLUE) // blanket
    p.hline(24, 8, 38, 'G')
    p.hline(23, 12, 40, 'F')
    p.vline(23, 6, 11, 'j')
    p.box(4, 3, 16, 7, CREAM) // pillow
    p.hline(6, 4, 12, 'r')
    p.rect(0, 26, 3, 3, 'f')
    p.rect(62, 26, 3, 3, 'f')
  })
}

function mortarPestle(): Sprite {
  return draw(34, 34, (p) => {
    p.box(0, 18, 34, 3, WOOD)
    p.vcyl(3, 21, 4, 12, WOOD)
    p.vcyl(27, 21, 4, 12, WOOD)
    p.line(24, 3, 15, 13, 'q')
    p.line(25, 3, 16, 13, 'p')
    p.disc(25, 3, 2.4, CREAM)
    p.rows(7, 10, 20, ['. i17 h .', 'i2 j i15 h g', 'i j2 i15 h g', 'g i17 g .', '.2 g16 .2'])
    p.disc(11, 9, 1.8, LEAF)
    p.disc(14, 10, 1.4, LEAF)
    p.rect(5, 14, 4, 4, 'G')
    p.rect(5, 13, 4, 1, 'j')
  })
}

function ivStand(): Sprite {
  return draw(20, 54, (p) => {
    p.vcyl(9, 4, 2, 44, STEEL)
    p.line(10, 48, 2, 53, 'h')
    p.line(10, 48, 18, 53, 'g')
    p.line(10, 48, 10, 53, 'i')
    p.hcyl(3, 2, 14, 2, STEEL)
    p.box(11, 5, 6, 12, BLUE)
    p.hline(12, 7, 4, 'j')
    p.vline(14, 17, 3, 'i')
    p.line(14, 20, 11, 30, 'j')
    p.line(11, 30, 10, 38, 'j')
    p.put(5, 3, 'y')
  })
}

function anatomyChart(): Sprite {
  return draw(34, 44, (p) => {
    p.box(0, 0, 34, 44, WOOD)
    p.rect(3, 3, 28, 38, 'q')
    p.ellipse(17, 10, 3.4, 4, 'r')
    p.eRing(17, 10, 3.4, 4, 'o')
    p.vline(17, 14, 14, 'o')
    for (let y = 16; y < 26; y += 3) p.hline(12, y, 11, 'o')
    p.rect(13, 28, 9, 3, 'o')
    p.line(12, 17, 8, 30, 'o')
    p.line(22, 17, 26, 30, 'o')
    p.line(15, 31, 13, 39, 'o')
    p.line(20, 31, 22, 39, 'o')
    p.rect(16, 18, 3, 3, 'u')
    p.put(16, 18, 'v')
  })
}

function clinicScale(): Sprite {
  return draw(24, 40, (p) => {
    p.box(2, 36, 20, 4, STEEL)
    p.vcyl(10, 8, 4, 28, STEEL)
    p.rect(14, 4, 3, 30, 'r')
    for (let y = 6; y < 34; y += 3) p.hline(14, y, y % 6 === 0 ? 3 : 2, 'f')
    p.rect(13, 20, 6, 3, 'u')
    p.box(4, 2, 12, 4, STEEL)
    p.hline(2, 33, 12, 'i')
  })
}

function herbRack(): Sprite {
  return draw(50, 38, (p) => {
    p.hcyl(1, 0, 48, 3, WOOD)
    p.vline(8, 3, 1, 'o')
    for (const [x, len, c, f] of [[6, 20, 'A', 'y'], [14, 24, 'z', 'v'], [22, 18, 'A', 'u'], [30, 26, 'z', 'y'], [38, 20, 'A', 'r'], [45, 22, 'z', 'v']] as const) {
      p.vline(x, 3, 3, 'o')
      for (let j = 0; j < len; j++) {
        const w = j < 3 ? 1 : j < len - 6 ? 3 : 2
        p.hline(x - Math.floor(w / 2), 6 + j, w, j % 3 === 0 ? 'A' : c)
      }
      p.disc(x, 6 + len, 1.8, { out: 'a', sh: 't', base: f, lt: 'r', hi: 'r' })
      p.rect(x - 1, 8, 3, 1, 'o')
    }
  })
}

function foldingScreen(): Sprite {
  return draw(52, 58, (p) => {
    for (let i = 0; i < 3; i++) {
      const x = i * 16
      const y = i === 1 ? 2 : 0
      p.box(x, y, 18, 56 - y, WOOD)
      p.rect(x + 2, y + 3, 14, 50 - y, 'q')
      p.rect(x + 2, y + 3, 14, 3, 'm')
      for (let r = 0; r < 4; r++) {
        const cy = y + 12 + r * 10
        p.put(x + 9, cy - 2, 'm')
        p.rect(x + 7, cy - 1, 5, 3, 'm')
        p.put(x + 9, cy + 2, 'm')
        p.put(x + 9, cy, 'n')
      }
      p.hline(x + 2, y + 52, 14, 'p')
    }
    p.rect(0, 56, 52, 2, 'a')
  })
}

function stool(): Sprite {
  return draw(18, 20, (p) => {
    p.ellipse(9, 3, 7.5, 2.8, 'j')
    p.hline(3, 2, 12, 'r')
    p.rect(2, 5, 14, 1, 'h')
    p.vcyl(8, 6, 2, 11, STEEL)
    p.line(8, 16, 3, 19, 'h')
    p.line(9, 16, 14, 19, 'g')
  })
}

function medicalCross(): Sprite {
  return draw(22, 22, (p) => {
    p.box(0, 0, 22, 22, CREAM)
    p.box(2, 2, 18, 18, RED)
    p.rect(8, 4, 6, 14, 'r')
    p.rect(4, 8, 14, 6, 'r')
    p.hline(8, 4, 6, 'j')
    p.vline(8, 4, 14, 'j')
  })
}

export function cabinPropSpritesA(): RoomProp[] {
  return [
    // map room
    prop('chart_table', chartTable()),
    prop('globe', globe()),
    prop('berry_chest', berryChest()),
    prop('tangerine_tree', tangerineTree()),
    prop('wall_chart', wallChart(), false),
    prop('scroll_rack', scrollRack()),
    prop('map_chair', mapChair()),
    // library
    prop('bookshelf_a', bookshelf(11, 40, 70), false),
    prop('bookshelf_b', bookshelf(23, 40, 70), false),
    prop('bookshelf_c', bookshelf(37, 40, 70), false),
    prop('reading_chair', readingChair()),
    prop('coffee_table', coffeeTable()),
    prop('rolling_ladder', rollingLadder()),
    prop('floor_lamp', floorLamp()),
    prop('wall_clock', wallClock(), false),
    prop('fern_pot', fernPot()),
    // infirmary
    prop('medicine_cabinet', medicineCabinet(), false),
    prop('cot', cot()),
    prop('mortar_and_pestle', mortarPestle()),
    prop('iv_stand', ivStand()),
    prop('anatomy_chart', anatomyChart(), false),
    prop('clinic_scale', clinicScale()),
    prop('herb_rack', herbRack(), false),
    prop('folding_screen', foldingScreen()),
    prop('clinic_stool', stool()),
    prop('medical_cross', medicalCross(), false)
  ]
}
