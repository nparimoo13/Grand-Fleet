import { DARKEST_KEYS, GF32, OUTLINE_OF, OUTLINE_PRIORITY } from './palette'

/**
 * Sprite sources are text grids. Each row is run-length encoded:
 *   `j i19 h g`  ->  one j, nineteen i, one h, one g
 *   `.3 y x4 .*` ->  three transparent, one y, four x, then transparent to fill the row
 * A key with no number is a run of 1. `*` fills whatever width is left (one per row).
 * Spaces are only for readability. '.' is transparent.
 */
export const T = '.'

export interface Sprite {
  w: number
  h: number
  /** px[y][x] is a palette key, or '.' for transparent. */
  px: string[][]
}

const TOKEN = /([A-Za-z.])(\d+|\*)?/g

export function parseRow(spec: string, w: number, where: string): string[] {
  const tokens: Array<{ key: string; n: number | '*' }> = []
  const stripped = spec.replace(/\s+/g, '')
  let consumed = 0
  TOKEN.lastIndex = 0
  for (let m = TOKEN.exec(stripped); m; m = TOKEN.exec(stripped)) {
    consumed += m[0].length
    const key = m[1]
    if (key !== T && !(key in GF32)) throw new Error(`${where}: unknown palette key "${key}" in "${spec}"`)
    tokens.push({ key, n: m[2] === undefined ? 1 : m[2] === '*' ? '*' : Number(m[2]) })
  }
  if (consumed !== stripped.length) throw new Error(`${where}: cannot parse row "${spec}"`)
  const fixed = tokens.reduce((sum, t) => sum + (t.n === '*' ? 0 : t.n), 0)
  const fills = tokens.filter((t) => t.n === '*').length
  if (fills > 1) throw new Error(`${where}: more than one fill in "${spec}"`)
  const fillW = w - fixed
  if (fills === 1 ? fillW < 0 : fillW !== 0) {
    throw new Error(`${where}: row is ${fixed}${fills ? '+fill' : ''} wide, expected ${w}: "${spec}"`)
  }
  const out: string[] = []
  for (const t of tokens) {
    const n = t.n === '*' ? fillW : t.n
    for (let i = 0; i < n; i++) out.push(t.key)
  }
  return out
}

/** Build a sprite from RLE rows. `w` is the exact width every row must have. */
export function sprite(name: string, w: number, rows: readonly string[]): Sprite {
  const px = rows.map((r, y) => parseRow(r, w, `${name} row ${y}`))
  return { w, h: px.length, px }
}

export function blank(w: number, h: number): Sprite {
  return { w, h, px: Array.from({ length: h }, () => Array.from({ length: w }, () => T)) }
}

/** Stamp `part` onto a new w×h sprite at each offset (later layers win). Parts may overhang; that throws. */
export function compose(name: string, w: number, h: number, layers: ReadonlyArray<readonly [Sprite, number, number]>): Sprite {
  const out = blank(w, h)
  for (const [part, ox, oy] of layers) {
    if (ox < 0 || oy < 0 || ox + part.w > w || oy + part.h > h) {
      throw new Error(`${name}: part ${part.w}x${part.h} at (${ox},${oy}) overflows ${w}x${h}`)
    }
    for (let y = 0; y < part.h; y++) {
      for (let x = 0; x < part.w; x++) {
        const c = part.px[y][x]
        if (c !== T) out.px[oy + y][ox + x] = c
      }
    }
  }
  return out
}

export function mirror(s: Sprite): Sprite {
  return { w: s.w, h: s.h, px: s.px.map((r) => [...r].reverse()) }
}

export function clone(s: Sprite): Sprite {
  return { w: s.w, h: s.h, px: s.px.map((r) => [...r]) }
}

/** Repeat identical row specs: `rep(3, 'j i* h')`. */
export function rep(n: number, ...rows: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(...rows)
  return out
}

const N4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1]
]

/**
 * 1px outline around the silhouette, in the darkest shade of the neighbouring ramp.
 * Only fills transparent pixels, so the sprite must leave a 1px transparent margin.
 */
export function outline(s: Sprite): Sprite {
  const out = clone(s)
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.px[y][x] !== T) continue
      const found = new Set<string>()
      let blockedByDark = false
      for (const [dx, dy] of N4) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue
        const c = s.px[ny][nx]
        if (c === T) continue
        if (DARKEST_KEYS.has(c)) blockedByDark = true
        else found.add(OUTLINE_OF[c])
      }
      if (blockedByDark || found.size === 0) continue
      const pick = OUTLINE_PRIORITY.find((k) => found.has(k)) ?? [...found][0]
      out.px[y][x] = pick
    }
  }
  return out
}

/** True when any pixel in the outer 1px ring is opaque (it would be clipped by the outline pass). */
export function touchesEdge(s: Sprite): boolean {
  for (let x = 0; x < s.w; x++) if (s.px[0][x] !== T || s.px[s.h - 1][x] !== T) return true
  for (let y = 0; y < s.h; y++) if (s.px[y][0] !== T || s.px[y][s.w - 1] !== T) return true
  return false
}

/**
 * Cast shadow: the silhouette shifted (+dx, +dy), minus the sprite itself, as a 50% checker dither.
 * Same origin as the sprite, so draw it first at the same position. Light comes from the top-left.
 */
export function castShadow(s: Sprite, dx = 1, dy = 1, key = 'k'): Sprite {
  const w = s.w + dx
  const h = s.h + dy
  const out = blank(w, h)
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.px[y][x] === T) continue
      for (let ox = 0; ox <= dx; ox++) {
        for (let oy = 0; oy <= dy; oy++) {
          if (ox === 0 && oy === 0) continue
          // solid, hard-edged drop shadow; never written over the sprite itself
          const tx = x + ox
          const ty = y + oy
          if (tx >= s.w || ty >= s.h || s.px[ty][tx] === T) out.px[ty][tx] = key
        }
      }
    }
  }
  return out
}

/** Dithered floor ellipse for things standing on the floor. */
export function floorShadow(w: number, h = 4, key = 'k'): Sprite {
  const out = blank(w, h)
  const rx = w / 2
  const ry = h / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - rx) / rx
      const ny = (y + 0.5 - ry) / ry
      if (nx * nx + ny * ny <= 1 && (x + y) % 2 === 0) out.px[y][x] = key
    }
  }
  return out
}

export function toRows(s: Sprite): string[] {
  return s.px.map((r) => r.join(''))
}
