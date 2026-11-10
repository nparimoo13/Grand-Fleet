import { describe, expect, it } from 'vitest'
import { blit, emptyGrid, gridSize, gridToRgba, mirrorH } from './raster'

const PAL = { a: [255, 0, 0] as const, b: [0, 255, 0] as const }

describe('raster', () => {
  it('mirrors horizontally', () => {
    expect(mirrorH(['ab', 'ba'])).toEqual(['ba', 'ab'])
  })

  it('blits stamps onto a grid', () => {
    const base = emptyGrid(4, 2)
    blit(base, ['aa', 'bb'], 1, 0)
    expect(base).toEqual([
      [' ', 'a', 'a', ' '],
      [' ', 'b', 'b', ' ']
    ])
  })

  it('compiles palette keys to RGBA', () => {
    const img = gridToRgba(['ab'], PAL)
    expect(gridSize(['ab'])).toEqual({ w: 2, h: 1 })
    expect(img.data[0]).toBe(255)
    expect(img.data[4]).toBe(0)
    expect(img.data[5]).toBe(255)
  })
})
