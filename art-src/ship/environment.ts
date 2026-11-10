import { encodePng, gradientRows, gridToRgba, type Grid } from '../lib/raster'
import { packSheet, type FrameInput } from '../lib/aseprite'
import { SUNNY_DECK_PALETTE } from '../palettes/sunny-deck'

function stripRows(rows: string[]): Buffer {
  return encodePng(gridToRgba(rows, SUNNY_DECK_PALETTE))
}

export function buildSkyDay(): Buffer {
  const rows = gradientRows(96, [
    [0, 'C'],
    [0.45, 'c'],
    [0.85, 'B'],
    [1, 'b']
  ])
  return stripRows(rows)
}

export function buildSkyNight(): Buffer {
  const rows = gradientRows(96, [
    [0, 'n'],
    [0.5, 'N'],
    [0.85, 'b'],
    [1, 'o']
  ])
  return stripRows(rows)
}

/** Tileable ocean layers for parallax (Phase 5). */
export function buildOceanSheets(): { far: Buffer; mid: Buffer; near: Buffer } {
  const wave = (ch: string, alt: string): Grid => [
    `${ch.repeat(64)}${alt.repeat(64)}`,
    `${alt.repeat(32)}${ch.repeat(64)}${alt.repeat(32)}`,
    `${ch.repeat(64)}${alt.repeat(64)}`,
    `${alt.repeat(64)}${ch.repeat(64)}`
  ]
  return {
    far: stripRows(wave('b', 'B')),
    mid: stripRows(wave('B', 'c')),
    near: stripRows(wave('c', 'C'))
  }
}

export function buildFlagWaveFrames(): { png: Buffer; json: object; w: number; h: number } {
  const frames: FrameInput[] = []
  const base = [
    'FFFFFFFFFFFFFFFF',
    'FFffffffffFFFFfF',
    'FFFFFFFFFFFFFFFF',
    'FFffffffffFFFFfF',
    'FFFFFFFFFFFFFFFF',
    'FFffffffffFFFFfF',
    'FFFFFFFFFFFFFFFF',
    'FFffffffffFFFFfF'
  ]
  for (let i = 0; i < 4; i++) {
    const row = base.map((line, y) => {
      const shift = (i + y) % 3
      return line.slice(shift) + line.slice(0, shift)
    })
    frames.push({ name: `flag_${i}`, grid: row, durationMs: 120 })
  }
  const sheet = packSheet(frames, SUNNY_DECK_PALETTE)
  return { png: sheet.png, json: sheet.json, w: sheet.width, h: sheet.height }
}
