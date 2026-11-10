/**
 * Pixel-exact geometry for the organic ship layout. Pure functions over byte masks (no DOM), shared by the art
 * build (hull, beams, stairwells baked into assets/ship/world.png) and the runtime scene (room clipping), so both
 * always agree on where every pixel of every room is. Nothing here is anti-aliased: a pixel is in or out of a
 * shape according to whether its centre is.
 */

export interface Pt {
  x: number
  y: number
}

/** Corner radii in px: top-left, top-right, bottom-right, bottom-left. */
export type Radii = readonly [number, number, number, number]

export class Mask {
  readonly data: Uint8Array
  constructor(
    readonly w: number,
    readonly h: number
  ) {
    this.data = new Uint8Array(w * h)
  }

  at(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[y * this.w + x]
  }

  set(x: number, y: number, v = 1): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = v
  }

  count(): number {
    let n = 0
    for (let i = 0; i < this.data.length; i++) if (this.data[i]) n++
    return n
  }

  /** OR another mask into this one with its top-left at (ox, oy). */
  add(src: Mask, ox: number, oy: number): void {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.data[y * src.w + x]) this.set(ox + x, oy + y)
  }
}

/** Rectangle with independently rounded corners. A pixel is inside when its centre is inside the arc. */
export function roundedRectMask(w: number, h: number, r: Radii = [0, 0, 0, 0]): Mask {
  const m = new Mask(w, h)
  const [tl, tr, br, bl] = r.map((v) => Math.min(v, w / 2, h / 2))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      let inside = true
      const corner = (rad: number, ax: number, ay: number): void => {
        if (rad <= 0) return
        const dx = cx - ax
        const dy = cy - ay
        if (dx * dx + dy * dy > rad * rad) inside = false
      }
      if (cx < tl && cy < tl) corner(tl, tl, tl)
      else if (cx > w - tr && cy < tr) corner(tr, w - tr, tr)
      else if (cx > w - br && cy > h - br) corner(br, w - br, h - br)
      else if (cx < bl && cy > h - bl) corner(bl, bl, h - bl)
      if (inside) m.data[y * w + x] = 1
    }
  }
  return m
}

/** Catmull-Rom spline through `pts` (open or closed), sampled `steps` times per segment. */
export function spline(pts: readonly Pt[], steps = 12, closed = false): Pt[] {
  const n = pts.length
  const at = (i: number): Pt => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  const out: Pt[] = []
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  if (!closed) out.push(pts[n - 1])
  return out
}

/** Even-odd polygon fill sampled at pixel centres, ORed into `m`. */
export function fillPolygon(m: Mask, poly: readonly Pt[]): void {
  const n = poly.length
  let minY = Infinity
  let maxY = -Infinity
  for (const p of poly) {
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(m.h - 1, Math.ceil(maxY)); y++) {
    const cy = y + 0.5
    const xs: number[] = []
    for (let i = 0; i < n; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % n]
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(m.w - 1, Math.ceil(xs[k + 1] - 0.5) - 1); x++) m.data[y * m.w + x] = 1
    }
  }
}

export function fillRect(m: Mask, x: number, y: number, w: number, h: number): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m.set(i, j)
}

const discSpans = (r: number): number[] => {
  const out: number[] = []
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) out.push(Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy))))
  return out
}

/** Euclidean dilation by `r` px. Only boundary pixels are stamped, so cost scales with perimeter, not area. */
export function dilate(src: Mask, r: number): Mask {
  const out = new Mask(src.w, src.h)
  out.data.set(src.data)
  const spans = discSpans(r)
  const R = Math.ceil(r)
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (!src.data[y * src.w + x]) continue
      if (src.at(x - 1, y) && src.at(x + 1, y) && src.at(x, y - 1) && src.at(x, y + 1)) continue
      for (let dy = -R; dy <= R; dy++) {
        const hw = spans[dy + R]
        const yy = y + dy
        if (yy < 0 || yy >= src.h) continue
        for (let dx = -hw; dx <= hw; dx++) out.set(x + dx, yy)
      }
    }
  }
  return out
}

export function union(a: Mask, b: Mask): Mask {
  const out = new Mask(a.w, a.h)
  for (let i = 0; i < a.data.length; i++) out.data[i] = a.data[i] | b.data[i]
  return out
}

export interface Ring {
  /** 0 = not part of the ring; otherwise 1 (outermost pixel) .. n (innermost) counted from the nearest outside pixel. */
  depth: Uint8Array
  /** 1 where the nearest outside pixel lies up/left (the face catches the light), else 0. */
  lit: Uint8Array
}

/**
 * The structural frame inside a mask: thickest under the ceiling (`top`), `side` along the walls, fading to nothing
 * along the floor so the room's own floor strip stays clear. Follows curved corners, which is what makes a room
 * read as an arched, braced space rather than a box.
 */
export function ringOf(m: Mask, top = 6, side = 4): Ring {
  const depth = new Uint8Array(m.w * m.h)
  const best = new Float32Array(m.w * m.h).fill(Infinity)
  const lit = new Uint8Array(m.w * m.h)
  const R = Math.ceil(top) + 1
  const thick = (uy: number): number => (uy < 0 ? side + (top - side) * -uy : Math.max(0, side * (1 - uy * 1.7)))
  for (let y = -1; y <= m.h; y++) {
    for (let x = -1; x <= m.w; x++) {
      if (m.at(x, y)) continue
      // an outside pixel that touches the mask: a seed
      if (!(m.at(x - 1, y) || m.at(x + 1, y) || m.at(x, y - 1) || m.at(x, y + 1))) continue
      for (let qy = y - R; qy <= y + R; qy++) {
        for (let qx = x - R; qx <= x + R; qx++) {
          if (!m.at(qx, qy)) continue
          const dx = x - qx
          const dy = y - qy
          const d = Math.hypot(dx, dy)
          if (d > thick(dy / d)) continue
          const i = qy * m.w + qx
          if (d < best[i]) {
            best[i] = d
            lit[i] = dx + dy < 0 ? 1 : 0
          }
        }
      }
    }
  }
  for (let i = 0; i < depth.length; i++) if (best[i] !== Infinity) depth[i] = Math.max(1, Math.round(best[i]))
  return { depth, lit }
}

/** True when every set pixel of `inner` lies inside `outer`, eroded by `margin` px (so a room clears the hull wall). */
export function containedWithMargin(inner: Mask, outer: Mask, margin: number): boolean {
  const spans = discSpans(margin)
  const R = Math.ceil(margin)
  for (let y = 0; y < inner.h; y++) {
    for (let x = 0; x < inner.w; x++) {
      if (!inner.data[y * inner.w + x]) continue
      for (let dy = -R; dy <= R; dy++) {
        const hw = spans[dy + R]
        for (let dx = -hw; dx <= hw; dx++) if (!outer.at(x + dx, y + dy)) return false
      }
    }
  }
  return true
}
