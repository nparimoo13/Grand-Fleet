import type { AsepriteDocument, AsepriteFrameTag } from '../../shared/types/art'
import type { Grid } from './raster'
import { encodePng, gridSize, gridToRgba, type Palette } from './raster'

export interface FrameInput {
  name: string
  /** Each string is one row; rows are padded to the widest line with spaces. */
  grid: Grid | readonly string[]
  durationMs?: number
}

function normalizeGrid(grid: FrameInput['grid']): Grid {
  const rows =
    typeof grid[0] === 'string'
      ? (grid as readonly string[])
      : (grid as readonly (readonly string[])[]).map((r) => r.join(''))
  const w = Math.max(...rows.map((r) => r.length))
  return rows.map((r) => r.padEnd(w, ' '))
}

export interface SheetPack {
  png: Buffer
  json: AsepriteDocument
  width: number
  height: number
}

/** Pack frames left-to-right on one row (wrap if maxWidth exceeded). */
export function packSheet(frames: FrameInput[], palette: Palette, maxWidth = 4096): SheetPack {
  if (frames.length === 0) throw new Error('packSheet needs at least one frame')
  const normalized = frames.map((f) => normalizeGrid(f.grid))
  const sizes = normalized.map((g) => gridSize(g))
  let x = 0
  let y = 0
  let rowH = 0
  const placements: Array<{ name: string; x: number; y: number; w: number; h: number; duration: number }> = []
  for (let i = 0; i < frames.length; i++) {
    const { w, h } = sizes[i]
    if (x + w > maxWidth && x > 0) {
      y += rowH
      x = 0
      rowH = 0
    }
    placements.push({ name: frames[i].name, x, y, w, h, duration: frames[i].durationMs ?? 100 })
    rowH = Math.max(rowH, h)
    x += w
  }
  const sheetW = Math.max(...placements.map((p) => p.x + p.w))
  const sheetH = Math.max(...placements.map((p) => p.y + p.h))
  const data = new Uint8Array(sheetW * sheetH * 4)
  const docFrames: AsepriteDocument['frames'] = {}
  for (let i = 0; i < frames.length; i++) {
    const p = placements[i]
    const img = gridToRgba(normalized[i], palette)
    for (let py = 0; py < p.h; py++) {
      for (let px = 0; px < p.w; px++) {
        const si = (py * p.w + px) * 4
        const di = ((p.y + py) * sheetW + (p.x + px)) * 4
        data[di] = img.data[si]
        data[di + 1] = img.data[si + 1]
        data[di + 2] = img.data[si + 2]
        data[di + 3] = img.data[si + 3]
      }
    }
    const key = `${p.name}.png`
    docFrames[key] = {
      frame: { x: p.x, y: p.y, w: p.w, h: p.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
      sourceSize: { w: p.w, h: p.h },
      duration: p.duration
    }
  }
  const tags: AsepriteFrameTag[] = []
  return {
    png: encodePng({ width: sheetW, height: sheetH, data }),
    width: sheetW,
    height: sheetH,
    json: {
      frames: docFrames,
      meta: {
        app: 'Grand Fleet art',
        version: '1.0',
        format: 'RGBA8888',
        size: { w: sheetW, h: sheetH },
        scale: '1',
        frameTags: tags.length ? tags : undefined
      }
    }
  }
}

export function packTaggedSheet(
  frames: FrameInput[],
  palette: Palette,
  tags: AsepriteFrameTag[]
): SheetPack {
  const sheet = packSheet(frames, palette)
  sheet.json.meta.frameTags = tags
  return sheet
}
