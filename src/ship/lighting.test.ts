import { describe, expect, it } from 'vitest'
import {
  AMB_LEVELS,
  GLOW_LEVELS,
  LIGHT_STATES,
  applyLightIndex,
  buildAmbient,
  buildLut,
  flickerAt,
  makeLightBuffers,
  noise,
  renderLightIndex,
  stateAt,
  type LightSource
} from './lighting'

const W = 96
const H = 64
const lamp = (over: Partial<LightSource> = {}): LightSource => ({ x: 48, y: 32, rx: 30, ry: 24, kind: 'warm', power: 6, flicker: 'none', seed: 1, ...over })

function render(sources: LightSource[], ambLevel = 2, tick = 0): Uint8Array {
  const amb = new Uint8Array(W * H).fill(ambLevel)
  const out = new Uint8Array(W * H)
  renderLightIndex(W, H, amb, sources, tick, makeLightBuffers(W, H), out)
  return out
}

describe('lighting LUT', () => {
  it('leaves a colour untouched at full ambient and no glow', () => {
    const lut = buildLut(200, 120, 40)
    const px = lut[(AMB_LEVELS - 1) * GLOW_LEVELS]
    expect([px & 255, (px >> 8) & 255, (px >> 16) & 255, px >>> 24]).toEqual([200, 120, 40, 255])
  })

  it('darkens monotonically with the ambient level and tints the dark end blue', () => {
    const lum = (px: number): number => (px & 255) + ((px >> 8) & 255) + ((px >> 16) & 255)
    const lut = buildLut(180, 180, 180)
    for (let l = 1; l < AMB_LEVELS; l++) expect(lum(lut[l * GLOW_LEVELS])).toBeGreaterThan(lum(lut[(l - 1) * GLOW_LEVELS]))
    const dark = lut[0]
    expect(((dark >> 16) & 255) > (dark & 255)).toBe(true) // blue above red
  })

  it('warm glow pushes red over blue and cool glow the other way', () => {
    const lut = buildLut(100, 100, 100)
    const base = lut[3 * GLOW_LEVELS]
    const warm = lut[3 * GLOW_LEVELS + 3]
    const cool = lut[3 * GLOW_LEVELS + 6]
    expect(warm & 255).toBeGreaterThan(base & 255)
    expect((warm >> 16) & 255).toBeLessThan((cool >> 16) & 255)
    expect(cool & 255).toBeLessThan(warm & 255)
  })
})

describe('light pools', () => {
  it('is brightest at the centre and falls off in whole steps', () => {
    const idx = render([lamp()])
    const level = (x: number, y: number): number => stateAt(idx, W, H, x, y).level
    expect(level(48, 32)).toBeGreaterThan(level(48 + 18, 32))
    expect(level(48 + 18, 32)).toBeGreaterThan(level(48 + 29, 32) - 1)
    expect(level(2, 2)).toBe(2) // outside the radius: untouched ambient
    for (const v of idx) expect(v).toBeLessThan(LIGHT_STATES)
  })

  it('uses only discrete states (no gradient): a handful of bands for one lamp', () => {
    const idx = render([lamp()])
    expect(new Set(idx).size).toBeLessThanOrEqual(LIGHT_STATES)
    const levels = new Set(Array.from(idx, (v) => Math.floor(v / GLOW_LEVELS)))
    expect(levels.size).toBeLessThanOrEqual(AMB_LEVELS)
  })

  it('never spills outside its clip rectangle', () => {
    const clip = { x: 20, y: 10, w: 40, h: 30 }
    const idx = render([lamp({ clip })])
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inside = x >= clip.x && y >= clip.y && x < clip.x + clip.w && y < clip.y + clip.h
        if (!inside) expect(idx[y * W + x]).toBe(2 * GLOW_LEVELS)
      }
    }
  })

  it('picks the cool kind where a cool light is brighter than a warm one', () => {
    const idx = render([lamp({ x: 20, power: 3 }), lamp({ x: 28, kind: 'cool', power: 7 })])
    const { glow } = stateAt(idx, W, H, 30, 32)
    expect(glow).toBeGreaterThanOrEqual(4)
  })
})

describe('ambient zones and flicker', () => {
  it('darkens room corners and the strip under the ceiling relative to the room centre', () => {
    const amb = buildAmbient(W, H, { outside: 1, zones: [{ rect: { x: 8, y: 8, w: 80, h: 48 }, level: 4, vignette: true }] })
    expect(amb[0]).toBe(1)
    const centre = amb[32 * W + 48]
    expect(centre).toBe(4)
    expect(amb[9 * W + 10]).toBeLessThan(centre) // top-left corner
    expect(amb[54 * W + 86]).toBeLessThan(centre) // bottom-right corner
    expect(amb[9 * W + 48]).toBeLessThan(centre) // under the beam
  })

  it('keeps a zone out of the pixels its mask leaves empty (rounded rooms)', () => {
    const w = 80
    const h = 48
    const data = new Uint8Array(w * h).fill(1)
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) data[y * w + x] = 0 // cut-off top-left corner
    const amb = buildAmbient(W, H, { outside: 1, zones: [{ rect: { x: 8, y: 8, w, h }, level: 4, vignette: false, mask: { w, data } }] })
    expect(amb[9 * W + 9]).toBe(1)
    expect(amb[32 * W + 48]).toBe(4)
  })

  it('flickers deterministically, subtly, and only for flickering kinds', () => {
    expect(flickerAt('none', 5, 3)).toEqual([1, 0])
    expect(flickerAt('candle', 12, 7)).toEqual(flickerAt('candle', 12, 7))
    for (let t = 0; t < 200; t++) {
      const [r, p] = flickerAt('candle', t, 9)
      expect(Math.abs(r - 1)).toBeLessThanOrEqual(0.05)
      expect(Math.abs(p)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(noise(t))).toBeLessThanOrEqual(1)
    }
    const seen = new Set<number>()
    for (let t = 0; t < 40; t++) seen.add(flickerAt('fire', t, 2)[0])
    expect(seen.size).toBeGreaterThan(5)
  })
})

describe('applyLightIndex', () => {
  it('recolours opaque pixels through the table and skips transparent ones', () => {
    const px = new Uint8ClampedArray([200, 120, 40, 255, 9, 9, 9, 0])
    const index = new Uint8Array([0, 0])
    applyLightIndex(px, index, new Map())
    const lut = buildLut(200, 120, 40)
    expect(Array.from(px.slice(0, 4))).toEqual([lut[0] & 255, (lut[0] >> 8) & 255, (lut[0] >> 16) & 255, 255])
    expect(Array.from(px.slice(4))).toEqual([9, 9, 9, 0])
  })
})
