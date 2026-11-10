import { PNG } from 'pngjs'

/** One string per scanline; each character is a palette key. Space is transparent. */
export type Grid = readonly string[]

export interface RgbaImage {
  width: number
  height: number
  /** RGBA, length = width * height * 4 */
  data: Uint8Array
}

export type Palette = Readonly<Record<string, readonly [r: number, g: number, b: number]>>

const TRANSPARENT = new Set([' ', '.', '_'])

export function gridSize(grid: Grid): { w: number; h: number } {
  const h = grid.length
  const w = Math.max(0, ...grid.map((row) => row.length))
  return { w, h }
}

export function mirrorH(grid: Grid): string[] {
  return grid.map((row) => [...row].reverse().join(''))
}

/** Place `stamp` onto `base` at tile offset (ox, oy). Out-of-bounds pixels are skipped. */
export function blit(base: string[][], stamp: Grid, ox: number, oy: number): void {
  for (let y = 0; y < stamp.length; y++) {
    const line = stamp[y]
    for (let x = 0; x < line.length; x++) {
      const ch = line[x]
      if (TRANSPARENT.has(ch)) continue
      const ty = oy + y
      const tx = ox + x
      if (ty < 0 || tx < 0 || ty >= base.length || tx >= base[0].length) continue
      base[ty][tx] = ch
    }
  }
}

export function emptyGrid(w: number, h: number, fill = ' '): string[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill))
}

export function gridToRgba(grid: Grid, palette: Palette): RgbaImage {
  const { w, h } = gridSize(grid)
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const line = grid[y]
    for (let x = 0; x < w; x++) {
      const ch = line[x] ?? ' '
      const i = (y * w + x) * 4
      if (TRANSPARENT.has(ch)) {
        data[i + 3] = 0
        continue
      }
      const rgb = palette[ch]
      if (!rgb) throw new Error(`Unknown palette key "${ch}" at (${x},${y})`)
      data[i] = rgb[0]
      data[i + 1] = rgb[1]
      data[i + 2] = rgb[2]
      data[i + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

export function encodePng(img: RgbaImage): Buffer {
  const png = new PNG({ width: img.width, height: img.height })
  png.data = Buffer.from(img.data)
  return PNG.sync.write(png)
}

/** Horizontal gradient as a pixel grid (one row per scanline). */
export function gradientRows(h: number, stops: readonly (readonly [pos: number, key: string])[]): string[] {
  const row = (t: number): string => {
    let key = stops[0][1]
    for (const [pos, k] of stops) {
      if (t >= pos) key = k
    }
    return key
  }
  return Array.from({ length: h }, (_, y) => {
    const t = h <= 1 ? 0 : y / (h - 1)
    return row(t).repeat(256)
  })
}
