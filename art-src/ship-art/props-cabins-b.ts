import { DSTEEL, DWOOD, GOLD, RED, STEEL, WOOD, draw, type Pix, type Ramp } from './pix'
import type { RoomProp } from './props-deck'
import type { Sprite } from './sprite'

/** Props for the workshop factory and the engine room. Drawn at build time with Pix. */

const prop = (name: string, sprite: Sprite, floor = true, solid = true): RoomProp => ({ name, sprite, solid, floor })

/** A toothed gear centred at (cx, cy); `phase` rotates the teeth (in radians). */
function gear(p: Pix, cx: number, cy: number, r: number, teeth: number, phase: number, ramp: Ramp): void {
  for (let t = 0; t < teeth; t++) {
    const a = phase + (t / teeth) * Math.PI * 2
    p.disc(cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1), 2.1, ramp)
  }
  p.disc(cx, cy, r, ramp)
  p.disc(cx, cy, r * 0.4, { out: 'f', sh: 'f', base: 'f', lt: 'g', hi: 'g' })
}

// =============================================================== workshop factory

function workbench(): Sprite {
  return draw(70, 46, (p) => {
    // vise, wrench, bolts and a soldering lamp on the bench
    p.box(4, 6, 12, 8, DSTEEL)
    p.box(2, 4, 4, 10, STEEL)
    p.vcyl(10, 0, 2, 6, STEEL)
    p.hline(6, 2, 10, 'h')
    p.line(26, 12, 38, 8, 'i')
    p.line(26, 13, 38, 9, 'h')
    p.disc(25, 12, 2.4, STEEL)
    p.disc(39, 8, 2.4, STEEL)
    for (const x of [46, 49, 52]) {
      p.rect(x, 11, 2, 3, 'x')
      p.put(x, 11, 'y')
    }
    p.rows(58, 4, 10, ['.3 u4 .3', '.2 v u4 t .2', '. v u6 t .', 'u8 t2'])
    p.vcyl(62, 10, 2, 4, STEEL)
    p.box(0, 14, 70, 6, WOOD) // top
    p.hline(2, 17, 66, 'b')
    p.box(3, 20, 64, 16, DWOOD) // drawers
    for (const x of [6, 24, 42]) {
      p.box(x, 22, 18, 12, WOOD)
      p.rect(x + 7, 27, 4, 2, 'y')
    }
    p.vcyl(3, 36, 5, 10, DWOOD)
    p.vcyl(62, 36, 5, 10, DWOOD)
  })
}

function toolWall(): Sprite {
  return draw(70, 48, (p) => {
    p.box(0, 0, 70, 48, WOOD)
    p.rect(3, 3, 64, 42, 'b')
    for (let y = 5; y < 44; y += 4) for (let x = 5; x < 66; x += 4) p.put(x, y, 'a')
    // hammer
    p.vline(9, 8, 20, 'd')
    p.vline(10, 8, 20, 'c')
    p.rect(5, 6, 9, 5, 'i')
    p.hline(5, 6, 9, 'j')
    p.hline(5, 10, 9, 'g')
    // wrench
    p.line(22, 30, 28, 10, 'i')
    p.line(23, 30, 29, 10, 'h')
    p.eRing(29, 8, 4, 4, 'i', 2)
    p.eRing(21, 33, 4, 4, 'i', 2)
    // saw
    p.rows(34, 8, 16, ['i14 j2', 'i13 h3', 'h12 g4', '.2 h8 g2 .4'])
    p.rect(34, 6, 4, 6, 'u')
    for (let x = 36; x < 50; x += 2) p.put(x, 15, 'g')
    // pliers
    p.line(56, 10, 60, 24, 'u')
    p.line(60, 10, 56, 24, 'u')
    p.rect(55, 6, 3, 5, 'i')
    p.rect(59, 6, 3, 5, 'h')
    // screwdrivers
    for (const [x, c] of [[38, 'u'], [43, 'x'], [48, 'F']] as const) {
      p.rect(x, 28, 3, 7, c)
      p.vline(x + 1, 35, 7, 'i')
    }
    p.hline(30, 44, 38, 'a')
  })
}

function partsBins(): Sprite {
  return draw(50, 46, (p) => {
    p.vcyl(0, 0, 3, 46, STEEL)
    p.vcyl(47, 0, 3, 46, STEEL)
    const colors: Array<[string, string, string]> = [['u', 'v', 't'], ['x', 'y', 'w'], ['F', 'G', 'E'], ['A', 'n', 'z'], ['m', 'n', 'l'], ['u', 'v', 't']]
    for (let r = 0; r < 3; r++) {
      const y = 2 + r * 14
      p.hcyl(2, y + 12, 46, 2, STEEL)
      for (let c = 0; c < 3; c++) {
        const [b, l, s] = colors[(r * 2 + c) % colors.length]
        const x = 5 + c * 14
        p.box(x, y + 2, 12, 10, { out: s, sh: s, base: b, lt: l, hi: l })
        p.rect(x + 3, y, 6, 2, 'i') // screws and washers spilling out
        p.put(x + 4, y, 'j')
        p.rect(x + 3, y + 5, 6, 3, 'r') // label
      }
    }
  })
}

function anvil(): Sprite {
  return draw(36, 28, (p) => {
    p.box(8, 20, 20, 8, DWOOD) // stump
    p.hline(10, 23, 16, 'a')
    p.box(6, 6, 26, 5, DSTEEL) // face
    p.rows(0, 6, 8, ['.2 g6', '. g7', 'g8'])
    p.hline(6, 6, 26, 'i')
    p.box(10, 11, 18, 4, DSTEEL)
    p.box(7, 15, 24, 5, DSTEEL)
    p.put(30, 5, 'i')
  })
}

function drillPress(): Sprite {
  return draw(32, 62, (p) => {
    p.box(0, 56, 32, 6, DSTEEL)
    p.vcyl(14, 8, 5, 48, STEEL)
    p.box(2, 36, 24, 3, STEEL) // table
    p.box(6, 0, 22, 12, DSTEEL) // head and motor
    p.rect(8, 2, 8, 2, 'i')
    p.rect(12, 12, 4, 6, 'g') // chuck
    p.vline(13, 18, 14, 'j') // bit
    p.line(28, 4, 31, 12, 'i') // feed handle
    p.disc(31, 13, 1.6, RED)
    p.rect(21, 3, 5, 4, 'u')
  })
}

function gearWall(phase: number): Sprite {
  return draw(40, 34, (p) => {
    gear(p, 12, 14, 10, 10, phase, STEEL)
    gear(p, 29, 20, 7.5, 8, -phase * 1.25 + 0.4, DSTEEL)
    p.disc(12, 14, 2, GOLD)
    p.disc(29, 20, 1.5, GOLD)
  })
}

function blueprint(): Sprite {
  return draw(40, 30, (p) => {
    p.rect(0, 0, 40, 30, 'E')
    p.hline(0, 0, 40, 'F')
    p.vline(0, 0, 30, 'F')
    p.hline(0, 29, 40, 'f')
    // a ship drawn in cyan chalk lines
    p.hline(6, 18, 28, 'G')
    p.line(6, 18, 12, 24, 'G')
    p.line(34, 18, 28, 24, 'G')
    p.hline(12, 24, 16, 'G')
    p.vline(20, 5, 13, 'G')
    p.line(20, 5, 28, 14, 'G')
    p.line(20, 7, 12, 15, 'G')
    for (let x = 4; x < 38; x += 4) p.put(x, 27, 'G')
    p.rect(2, 3, 5, 1, 'G')
    p.rect(2, 5, 3, 1, 'G')
    p.disc(2, 1, 1.4, RED)
    p.disc(37, 1, 1.4, RED)
  })
}

function crateParts(): Sprite {
  return draw(34, 30, (p) => {
    p.line(8, 8, 10, 0, 'h')
    p.vcyl(14, 2, 4, 10, STEEL)
    p.box(21, 4, 8, 8, GOLD)
    p.disc(25, 6, 3, GOLD)
    p.box(0, 10, 34, 20, WOOD)
    p.hline(1, 14, 32, 'b')
    p.hline(1, 24, 32, 'b')
    p.vline(10, 11, 18, 'b')
    p.vline(24, 11, 18, 'b')
    p.line(2, 14, 8, 24, 'c')
    p.line(26, 14, 32, 24, 'c')
  })
}

function robotBust(): Sprite {
  return draw(30, 42, (p) => {
    p.box(8, 36, 14, 6, DSTEEL) // stand
    p.vcyl(12, 30, 6, 7, STEEL)
    p.box(3, 8, 24, 22, STEEL) // head
    p.rect(6, 12, 18, 8, 'f')
    p.rect(8, 14, 5, 4, 'x')
    p.rect(17, 14, 5, 4, 'x')
    p.rect(9, 15, 2, 2, 'y')
    p.rect(18, 15, 2, 2, 'y')
    p.hline(8, 24, 14, 'g')
    for (let x = 8; x < 22; x += 3) p.vline(x, 22, 4, 'f')
    p.vline(15, 2, 6, 'i')
    p.disc(15, 2, 2, RED)
    // loose wires from the open side
    p.line(24, 20, 29, 26, 'u')
    p.line(24, 22, 28, 30, 'x')
  })
}

// =============================================================== engine room

function engine(): Sprite {
  return draw(104, 68, (p) => {
    p.box(0, 56, 104, 12, DSTEEL) // bed plate
    p.box(6, 24, 62, 34, STEEL) // crank case
    p.rect(8, 28, 58, 4, 'g')
    for (let x = 10; x < 66; x += 8) p.disc(x, 50, 1.3, DSTEEL)
    // three cylinders with brass heads
    for (const x of [12, 30, 48]) {
      p.vcyl(x, 8, 12, 17, STEEL)
      p.box(x - 2, 4, 16, 6, GOLD)
      p.box(x - 1, 21, 14, 3, DSTEEL)
    }
    // flywheel
    p.disc(84, 38, 19, DSTEEL)
    p.disc(84, 38, 15, STEEL)
    p.disc(84, 38, 12, DSTEEL)
    for (let a = 0; a < 6; a++) {
      const r = (a * Math.PI) / 3 + 0.3
      p.line(84, 38, Math.round(84 + Math.cos(r) * 14), Math.round(38 + Math.sin(r) * 14), 'h')
    }
    p.disc(84, 38, 4.4, GOLD)
    p.eRing(84, 38, 19, 19, 'i', 1)
    p.hcyl(66, 36, 8, 4, DSTEEL) // shaft
    // exhaust pipe and warning stripe
    p.vcyl(94, 6, 6, 14, STEEL)
    for (let x = 0; x < 104; x += 8) {
      p.rect(x, 63, 4, 2, 'x')
    }
  })
}

/** Piston rods rising and falling in the three cylinders (overlay, same origin as the cylinders' tops). */
function engineRods(phase: 0 | 1): Sprite {
  return draw(62, 14, (p) => {
    for (const [i, x] of [12, 30, 48].entries()) {
      const up = (i + phase) % 2 === 0
      const y = up ? 0 : 5
      p.vcyl(x + 4, y, 4, 9, { out: 'g', sh: 'h', base: 'i', lt: 'j', hi: 'j' })
      p.rect(x + 3, y, 6, 2, 'x')
    }
  })
}

function boilerTank(): Sprite {
  return draw(54, 70, (p) => {
    p.vcyl(4, 8, 46, 58, STEEL)
    p.ellipse(27, 8, 23, 4, 'h')
    p.ellipse(27, 7, 21, 3, 'i')
    for (const y of [16, 36, 56]) {
      p.hline(4, y, 46, 'g')
      p.hline(4, y + 1, 46, 'f')
      for (let x = 7; x < 50; x += 5) p.put(x, y - 1, 'j')
    }
    p.box(10, 6, 34, 4, DSTEEL)
    p.vcyl(24, 0, 6, 8, RED)
    p.disc(40, 28, 6, GOLD) // pressure gauge
    p.ellipse(40, 28, 4, 4, 'r')
    p.line(40, 28, 43, 25, 'u')
    p.rect(12, 62, 30, 6, 'a')
    p.rect(14, 64, 6, 2, 'u')
    p.box(0, 66, 54, 4, DSTEEL)
  })
}

function pipes(): Sprite {
  return draw(40, 80, (p) => {
    p.vcyl(2, 0, 8, 80, { out: 's', sh: 't', base: 'u', lt: 'v', hi: 'v' })
    p.vcyl(14, 0, 8, 80, STEEL)
    p.vcyl(26, 0, 8, 80, GOLD)
    for (const y of [10, 38, 62]) {
      p.box(0, y, 12, 4, DSTEEL)
      p.box(12, y, 12, 4, DSTEEL)
      p.box(24, y, 12, 4, DSTEEL)
    }
    p.disc(18, 28, 4, RED)
    p.rect(14, 26, 8, 2, 'f')
    p.box(36, 22, 4, 12, DSTEEL)
  })
}

function gaugePanel(): Sprite {
  return draw(64, 44, (p) => {
    p.box(0, 0, 64, 44, DSTEEL)
    p.rect(3, 3, 58, 38, 'f')
    for (const [cx, cy] of [[14, 14], [32, 14], [50, 14]]) {
      p.disc(cx, cy, 8, GOLD)
      p.ellipse(cx, cy, 6, 6, 'r')
      p.line(cx, cy, cx + 3, cy - 4, 'u')
      p.put(cx - 4, cy - 3, 'j')
      for (let a = 200; a <= 340; a += 35) p.put(Math.round(cx + Math.cos((a * Math.PI) / 180) * 5), Math.round(cy + Math.sin((a * Math.PI) / 180) * 5), 'o')
    }
    for (const [x, c] of [[8, 'u'], [14, 'x'], [20, 'A'], [26, 'A']] as const) {
      p.disc(x + 1, 32, 2.4, { out: 'a', sh: 'g', base: c, lt: 'r', hi: 'r' })
    }
    p.box(36, 28, 22, 9, STEEL)
    for (let x = 39; x < 56; x += 5) {
      p.rect(x, 30, 2, 5, 'f')
      p.rect(x, 30, 2, 2, 'u')
    }
  })
}

function valveWheel(): Sprite {
  return draw(26, 28, (p) => {
    p.vcyl(10, 14, 6, 14, STEEL)
    p.box(7, 22, 12, 4, DSTEEL)
    p.eRing(13, 9, 9, 9, 'u', 2)
    p.eRing(13, 9, 9, 9, 'v', 1)
    p.hline(5, 9, 17, 't')
    p.vline(13, 1, 17, 't')
    p.disc(13, 9, 2.6, GOLD)
  })
}

function coalBin(): Sprite {
  return draw(44, 34, (p) => {
    p.box(2, 14, 40, 20, WOOD)
    p.hline(3, 20, 38, 'b')
    p.hline(3, 27, 38, 'b')
    for (const [x, y, r] of [[8, 12, 5], [16, 8, 5.5], [25, 10, 6], [34, 12, 5], [12, 14, 4], [29, 6, 4], [21, 5, 3.4], [37, 15, 3.4]] as const) {
      p.disc(x, y, r, DSTEEL)
      p.put(x - 1, y - 1, 'h')
    }
    p.vline(40, 0, 20, 'c') // shovel
    p.rect(38, 0, 5, 4, 'i')
    p.rect(38, 0, 5, 1, 'j')
  })
}

function wallFan(phase: 0 | 1): Sprite {
  return draw(36, 36, (p) => {
    p.disc(18, 18, 17, STEEL)
    p.ellipse(18, 18, 14, 14, 'f')
    for (let b = 0; b < 4; b++) {
      const a = (b * Math.PI) / 2 + (phase ? Math.PI / 4 : 0.1)
      for (let t = 2; t <= 12; t++) {
        const x = Math.round(18 + Math.cos(a) * t)
        const y = Math.round(18 + Math.sin(a) * t)
        p.soft(x, y, 'i')
        p.soft(x + 1, y, 'h')
        p.soft(x, y + 1, 'g')
        p.soft(x + (Math.sin(a) > 0 ? -1 : 1), y, 'h')
      }
    }
    p.disc(18, 18, 3, GOLD)
    p.eRing(18, 18, 14, 14, 'g', 1)
    for (let a = 0; a < 8; a++) {
      const r = (a * Math.PI) / 4
      p.disc(18 + Math.cos(r) * 15.5, 18 + Math.sin(r) * 15.5, 1, { out: 'g', sh: 'g', base: 'j', lt: 'j', hi: 'j' })
    }
  })
}

function colaKeg(): Sprite {
  return draw(30, 38, (p) => {
    p.vcyl(2, 4, 26, 32, RED)
    p.ellipse(15, 4, 12, 3, 'u')
    p.ellipse(15, 3, 10, 2, 'v')
    p.hline(2, 10, 26, 'f')
    p.hline(2, 30, 26, 'f')
    p.rect(2, 11, 26, 18, 'u')
    p.vline(2, 11, 18, 'v')
    p.vline(27, 11, 18, 't')
    // bottle emblem on a cream band
    p.rect(6, 15, 18, 10, 'r')
    p.rect(13, 16, 4, 8, 'b')
    p.rect(14, 16, 2, 2, 'a')
    p.rect(8, 17, 3, 6, 'u')
    p.rect(19, 17, 3, 6, 'u')
    p.disc(26, 36, 1.4, DSTEEL)
  })
}

function steelLadder(): Sprite {
  return draw(20, 80, (p) => {
    p.vcyl(2, 0, 3, 80, STEEL)
    p.vcyl(15, 0, 3, 80, STEEL)
    for (let y = 6; y < 78; y += 8) p.hcyl(2, y, 16, 3, STEEL)
    p.box(0, 0, 20, 3, DSTEEL)
  })
}

function toolbox(): Sprite {
  return draw(30, 20, (p) => {
    p.hcyl(8, 0, 14, 3, DSTEEL)
    p.vline(8, 0, 6, 'g')
    p.vline(21, 0, 6, 'g')
    p.box(0, 5, 30, 14, RED)
    p.hline(1, 9, 28, 's')
    p.rect(12, 8, 6, 4, 'x')
    p.rect(13, 9, 4, 2, 'y')
  })
}

export function cabinPropSpritesB(): RoomProp[] {
  return [
    // factory
    prop('workbench', workbench()),
    prop('tool_wall', toolWall(), false),
    prop('parts_bins', partsBins()),
    prop('anvil', anvil()),
    prop('drill_press', drillPress()),
    { name: 'gear_wall_0', sprite: gearWall(0), solid: true },
    { name: 'gear_wall_1', sprite: gearWall(Math.PI / 10), solid: true },
    prop('blueprint', blueprint(), false),
    prop('crate_parts', crateParts()),
    prop('robot_bust', robotBust()),
    // engine room
    prop('engine', engine()),
    { name: 'engine_rods_0', sprite: engineRods(0), solid: false },
    { name: 'engine_rods_1', sprite: engineRods(1), solid: false },
    prop('boiler_tank', boilerTank()),
    prop('pipes', pipes()),
    prop('gauge_panel', gaugePanel(), false),
    prop('valve_wheel', valveWheel()),
    prop('coal_bin', coalBin()),
    { name: 'wall_fan_0', sprite: wallFan(0), solid: true },
    { name: 'wall_fan_1', sprite: wallFan(1), solid: true },
    prop('cola_keg', colaKeg()),
    prop('steel_ladder', steelLadder(), false),
    prop('toolbox', toolbox())
  ]
}

/** Overlay anchors, relative to their parent sprite's top-left (both carry the same 1px margin). */
export const ENGINE_ANCHORS = {
  engine_rods: { parent: 'engine', x: 0, y: 10 }
} as const
