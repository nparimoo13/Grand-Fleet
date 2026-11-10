import { GF32 } from './palette'
import { T, blank, parseRow, type Sprite } from './sprite'

/**
 * Build-time drawing helper for the ship art. It writes palette keys into a sprite grid, with the same
 * top-left light rule as the hand-written grids: highlight on top/left edges, shade on bottom/right.
 * Output is plain GF32 pixel data that the build packs into PNG sheets; nothing here runs in the app.
 *
 * Coordinates are relative to the drawable area. Every canvas keeps a 1px transparent margin around it so the
 * auto-outline pass has room (final sprite size is w+2 by h+2).
 */
export interface Ramp {
  out: string
  sh: string
  base: string
  lt: string
  hi: string
}

export const STEEL: Ramp = { out: 'f', sh: 'g', base: 'h', lt: 'i', hi: 'j' }
export const WOOD: Ramp = { out: 'a', sh: 'b', base: 'c', lt: 'd', hi: 'e' }
export const TEAL: Ramp = { out: 'k', sh: 'l', base: 'm', lt: 'n', hi: 'n' }
export const CREAM: Ramp = { out: 'o', sh: 'o', base: 'p', lt: 'q', hi: 'r' }
export const RED: Ramp = { out: 's', sh: 't', base: 'u', lt: 'v', hi: 'v' }
export const GOLD: Ramp = { out: 'w', sh: 'w', base: 'x', lt: 'y', hi: 'y' }
export const LEAF: Ramp = { out: 'z', sh: 'z', base: 'A', lt: 'n', hi: 'n' }
export const BLUE: Ramp = { out: 'E', sh: 'E', base: 'F', lt: 'G', hi: 'j' }
export const SKIN: Ramp = { out: 'a', sh: 'C', base: 'D', lt: 'D', hi: 'D' }
/** Mahogany: shifted one step darker than WOOD. */
export const DWOOD: Ramp = { out: 'a', sh: 'a', base: 'b', lt: 'c', hi: 'd' }
/** Blued iron: shifted one step darker than STEEL. */
export const DSTEEL: Ramp = { out: 'f', sh: 'f', base: 'g', lt: 'h', hi: 'i' }
/** Lion fur / honey: warmer and lighter than GOLD. */
export const FUR: Ramp = { out: 'w', sh: 'x', base: 'y', lt: 'r', hi: 'r' }

export class Pix {
  readonly w: number
  readonly h: number
  private readonly g: Sprite

  /** `w` x `h` is the drawable area; the sprite gets a 1px margin on every side. */
  constructor(w: number, h: number, private readonly m = 1) {
    this.w = w
    this.h = h
    this.g = blank(w + 2 * m, h + 2 * m)
  }

  put(x: number, y: number, k: string): this {
    if (k === T) return this
    if (!(k in GF32)) throw new Error(`Pix: unknown palette key "${k}"`)
    const px = x + this.m
    const py = y + this.m
    if (px < 0 || py < 0 || px >= this.g.w || py >= this.g.h) throw new Error(`Pix: (${x},${y}) is outside ${this.w}x${this.h}`)
    this.g.px[py][px] = k
    return this
  }

  /** Like `put` but silently clips (for shapes that may poke past the edge). */
  soft(x: number, y: number, k: string): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this
    return this.put(x, y, k)
  }

  get(x: number, y: number): string {
    const px = x + this.m
    const py = y + this.m
    if (px < 0 || py < 0 || px >= this.g.w || py >= this.g.h) return T
    return this.g.px[py][px]
  }

  rect(x: number, y: number, w: number, h: number, k: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, k)
    return this
  }

  hline(x: number, y: number, len: number, k: string): this {
    return this.rect(x, y, len, 1, k)
  }

  vline(x: number, y: number, len: number, k: string): this {
    return this.rect(x, y, 1, len, k)
  }

  /** Bresenham line, 1px wide. */
  line(x0: number, y0: number, x1: number, y1: number, k: string): this {
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    let x = x0
    let y = y0
    for (;;) {
      this.soft(x, y, k)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x += sx
      }
      if (e2 <= dx) {
        err += dx
        y += sy
      }
    }
    return this
  }

  /** Beveled slab: highlight on top/left, shade on bottom/right (light from the top-left). */
  box(x: number, y: number, w: number, h: number, r: Ramp): this {
    this.rect(x, y, w, h, r.base)
    if (w > 2 && h > 2) {
      this.hline(x, y, w, r.lt)
      this.vline(x, y, h, r.lt)
      this.hline(x, y + h - 1, w, r.sh)
      this.vline(x + w - 1, y, h, r.sh)
      this.put(x, y, r.hi)
    } else {
      this.hline(x, y, w, r.lt)
      this.hline(x, y + h - 1, w, r.sh)
    }
    return this
  }

  /** Vertical cylinder (pipes, barrels, posts): rim light, hot spot, base, shade on the right. */
  vcyl(x: number, y: number, w: number, h: number, r: Ramp): this {
    for (let i = 0; i < w; i++) {
      const t = w === 1 ? 0.3 : i / (w - 1)
      const k = t < 0.1 ? r.lt : t < 0.3 ? r.hi : t < 0.45 ? r.lt : t < 0.8 ? r.base : r.sh
      this.vline(x + i, y, h, k)
    }
    return this
  }

  /** Horizontal cylinder (pipes, rails): light along the top, shade underneath. */
  hcyl(x: number, y: number, w: number, h: number, r: Ramp): this {
    for (let j = 0; j < h; j++) {
      const t = h === 1 ? 0.3 : j / (h - 1)
      const k = t < 0.1 ? r.lt : t < 0.3 ? r.hi : t < 0.45 ? r.lt : t < 0.8 ? r.base : r.sh
      this.hline(x, y + j, w, k)
    }
    return this
  }

  /** Shaded sphere / round face. (cx, cy) are the centre in pixel coordinates (may be .5). */
  disc(cx: number, cy: number, rad: number, r: Ramp): this {
    const lo = Math.floor(-rad - 1)
    const hi = Math.ceil(rad + 1)
    for (let j = lo; j <= hi; j++) {
      for (let i = lo; i <= hi; i++) {
        const dx = i - (cx - Math.floor(cx))
        const dy = j - (cy - Math.floor(cy))
        if (dx * dx + dy * dy > rad * rad) continue
        const v = (-dx - dy) / (rad * 1.414)
        const k = v > 0.62 ? r.hi : v > 0.2 ? r.lt : v > -0.35 ? r.base : r.sh
        this.soft(Math.floor(cx) + i, Math.floor(cy) + j, k)
      }
    }
    return this
  }

  /** Filled ellipse with a flat colour. */
  ellipse(cx: number, cy: number, rx: number, ry: number, k: string): this {
    for (let j = Math.floor(-ry); j <= Math.ceil(ry); j++) {
      for (let i = Math.floor(-rx); i <= Math.ceil(rx); i++) {
        if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) this.soft(cx + i, cy + j, k)
      }
    }
    return this
  }

  /** Ring (outline only). */
  ring(cx: number, cy: number, rad: number, k: string, thick = 1): this {
    for (let j = -rad; j <= rad; j++) {
      for (let i = -rad; i <= rad; i++) {
        const d = Math.sqrt(i * i + j * j)
        if (d <= rad + 0.3 && d > rad - thick + 0.3) this.soft(cx + i, cy + j, k)
      }
    }
    return this
  }

  /** Elliptical ring (outline only). */
  eRing(cx: number, cy: number, rx: number, ry: number, k: string, thick = 1): this {
    for (let j = Math.floor(-ry - 1); j <= Math.ceil(ry + 1); j++) {
      for (let i = Math.floor(-rx - 1); i <= Math.ceil(rx + 1); i++) {
        const d = Math.sqrt((i * i) / (rx * rx) + (j * j) / (ry * ry))
        const edge = thick / Math.min(rx, ry)
        if (d <= 1.02 && d > 1 - edge - 0.02) this.soft(cx + i, cy + j, k)
      }
    }
    return this
  }

  /** Arc from angle a0 to a1 (degrees, 0 = right, 90 = down), stroked with the given thickness. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, k: string, thick = 1): this {
    const steps = Math.max(16, Math.ceil(r * 8))
    for (let s = 0; s <= steps; s++) {
      const a = ((a0 + ((a1 - a0) * s) / steps) * Math.PI) / 180
      for (let t = 0; t < thick; t++) {
        this.soft(Math.round(cx + Math.cos(a) * (r - t)), Math.round(cy + Math.sin(a) * (r - t)), k)
      }
    }
    return this
  }

  /** Stamp RLE rows (same format as the hand-written sprites) with the top-left at (x, y). */
  rows(x: number, y: number, w: number, rows: readonly string[]): this {
    rows.forEach((spec, j) => {
      const row = parseRow(spec, w, `rows@${y + j}`)
      row.forEach((k, i) => this.put(x + i, y + j, k))
    })
    return this
  }

  /** Overlay another sprite (opaque pixels only). */
  blit(s: Sprite | Pix, x: number, y: number): this {
    const src = s instanceof Pix ? s.sprite() : s
    const m = s instanceof Pix ? s.m : 0
    for (let j = 0; j < src.h; j++) {
      for (let i = 0; i < src.w; i++) {
        const k = src.px[j][i]
        if (k !== T) this.put(x + i - m, y + j - m, k)
      }
    }
    return this
  }

  /** Replace one key with another inside a rectangle. */
  swap(x: number, y: number, w: number, h: number, from: string, to: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.get(i, j) === from) this.put(i, j, to)
    return this
  }

  /** 50% checker fill inside a rectangle (palette-pure dithering). */
  dither(x: number, y: number, w: number, h: number, k: string, odd = false): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((i + j + (odd ? 1 : 0)) % 2 === 0) this.put(x + i, y + j, k)
    return this
  }

  sprite(): Sprite {
    return { w: this.g.w, h: this.g.h, px: this.g.px.map((r) => [...r]) }
  }
}

/** Convenience: build a sprite from a drawing callback. */
export function draw(w: number, h: number, fn: (p: Pix) => void): Sprite {
  const p = new Pix(w, h)
  fn(p)
  return p.sprite()
}
