/**
 * Stepped, palette-shifted lighting for the native-resolution ship scene.
 *
 * The scene is composed from palette-pure sprite sheets first. This pass then does what a multiply layer plus
 * additive light sprites would do, but with no smooth gradients and no alpha blending: every pixel gets an
 * ambient LEVEL (0..7, a fixed brightness step with a dark-blue tint) and a GLOW (none / warm 1-3 / cool 1-3).
 * Each source colour maps to a fixed output colour per (level, glow), so a lit scene is the 32-colour palette
 * shifted through a small, deterministic ramp. Light pools are stepped bands with ordered dithering on the
 * band edges, which keeps the pixel-art look at any zoom.
 *
 * Everything here is pure (typed arrays in, typed arrays out) so it can be unit tested without a canvas.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const AMB_LEVELS = 8
/** Brightness multiplier per ambient level. Level 7 is the unlit original. */
export const AMB_FACTOR: readonly number[] = [0.3, 0.4, 0.5, 0.6, 0.72, 0.84, 0.93, 1]
/** Dark-blue ambient tint at level 0, fading to neutral at level 7. */
const TINT_DARK: readonly [number, number, number] = [0.8, 0.92, 1.28]

/** 0 = no glow, 1..3 = warm (orange), 4..6 = cool (moon / aquarium blue). */
export const GLOW_LEVELS = 7
const WARM: readonly [number, number, number] = [255, 150, 56]
const COOL: readonly [number, number, number] = [70, 130, 235]
const WARM_ADD: readonly number[] = [0, 0.12, 0.25, 0.42]
const COOL_ADD: readonly number[] = [0, 0.08, 0.15, 0.24]
/**
 * Colour saturation kept per ambient level. Dim areas lose colour, so the backdrop props recede and anything lit
 * (a lamp's pool, a crew member standing in it) keeps its full colour and pops.
 */
const SAT: readonly number[] = [0.4, 0.5, 0.6, 0.72, 0.85, 0.94, 1, 1]

export const LIGHT_STATES = AMB_LEVELS * GLOW_LEVELS

export type LightKind = 'warm' | 'cool'
export type Flicker = 'none' | 'candle' | 'fire' | 'pulse'

export interface LightSource {
  /** Centre, world px. */
  x: number
  y: number
  rx: number
  ry: number
  kind: LightKind
  /** Brightness steps at the centre (1..8). The ambient level rises by this many steps. */
  power: number
  flicker: Flicker
  /** Decorrelates the flicker of neighbouring lights. */
  seed: number
  /** The light never leaves this rectangle (room lights do not spill through the hull). */
  clip?: Rect
}

export interface AmbientZone {
  rect: Rect
  level: number
  /** Darken the corners and the strip under the ceiling beam. */
  vignette: boolean
  /** Room-local pixel mask (rect-sized, row-major): only pixels where it is 1 belong to the zone. Rounded rooms use it. */
  mask?: { w: number; data: Uint8Array }
}

export interface AmbientSpec {
  /** Level for everything not inside a zone. */
  outside: number
  zones: readonly AmbientZone[]
}

/** 4x4 Bayer matrix, 0..15. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export const bayer = (x: number, y: number): number => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16

/** Deterministic noise in [-1, 1]. */
export function noise(n: number): number {
  let h = Math.imul(n | 0, 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

/** Flicker multipliers for a source at animation tick `tick`: [radius scale, power offset]. */
export function flickerAt(f: Flicker, tick: number, seed: number): [number, number] {
  switch (f) {
    case 'candle': {
      // changes every other tick, so the flame wavers rather than strobes
      const n = noise(Math.floor(tick / 2) * 31 + seed)
      return [1 + 0.05 * n, n > 0.55 ? -0.5 : 0]
    }
    case 'fire': {
      const n = noise(tick * 17 + seed)
      return [1 + 0.1 * n, n * 0.6]
    }
    case 'pulse': {
      const s = Math.sin((tick + seed) / 5)
      return [1 + 0.03 * s, s * 0.35]
    }
    default:
      return [1, 0]
  }
}

/** Static ambient level per pixel for a scene. Vignette strength is expressed in whole brightness steps. */
export function buildAmbient(w: number, h: number, spec: AmbientSpec): Uint8Array {
  const out = new Uint8Array(w * h).fill(spec.outside)
  for (const z of spec.zones) {
    const { x: zx, y: zy, w: zw, h: zh } = z.rect
    for (let y = Math.max(0, zy); y < Math.min(h, zy + zh); y++) {
      for (let x = Math.max(0, zx); x < Math.min(w, zx + zw); x++) {
        if (z.mask && !z.mask.data[(y - zy) * z.mask.w + (x - zx)]) continue
        let level = z.level
        if (z.vignette) {
          const b = bayer(x, y)
          // distance to the nearest side wall, with dither so the falloff is a pixel pattern, not a hard line
          const side = Math.min(x - zx, zx + zw - 1 - x) + (b - 0.5) * 7
          const top = y - zy + (b - 0.5) * 5
          const floor = zy + zh - 1 - y
          let drop = 0
          if (side < 6) drop += 2
          else if (side < 20) drop += 1
          if (top < 7) drop += 2
          else if (top < 17) drop += 1
          if (floor < 3 && side < 24) drop += 1
          level = Math.max(0, level - drop)
        }
        out[y * w + x] = level
      }
    }
  }
  return out
}

/** Reusable scratch buffers for `renderLightIndex`. */
export interface LightBuffers {
  band: Uint8Array
  kind: Uint8Array
}

export const makeLightBuffers = (w: number, h: number): LightBuffers => ({ band: new Uint8Array(w * h), kind: new Uint8Array(w * h) })

/** Writes, per pixel, ambient level * GLOW_LEVELS + glow index into `out` (0 .. LIGHT_STATES-1). */
export function renderLightIndex(
  w: number,
  h: number,
  ambient: Uint8Array,
  sources: readonly LightSource[],
  tick: number,
  buf: LightBuffers,
  out: Uint8Array
): void {
  buf.band.fill(0)
  buf.kind.fill(0)
  for (const s of sources) {
    const [rs, po] = flickerAt(s.flicker, tick, s.seed)
    const rx = s.rx * rs
    const ry = s.ry * rs
    const power = Math.max(0, s.power + po)
    const c = s.clip
    const x0 = Math.max(0, Math.floor(s.x - rx), c ? c.x : 0)
    const x1 = Math.min(w - 1, Math.ceil(s.x + rx), c ? c.x + c.w - 1 : w - 1)
    const y0 = Math.max(0, Math.floor(s.y - ry), c ? c.y : 0)
    const y1 = Math.min(h - 1, Math.ceil(s.y + ry), c ? c.y + c.h - 1 : h - 1)
    const kind = s.kind === 'warm' ? 1 : 2
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - s.y) / ry
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - s.x) / rx
        const d2 = dx * dx + dy * dy
        if (d2 >= 1) continue
        const t = 1 - Math.sqrt(d2)
        const v = t * t * 0.4 + t * 0.6 // soft shoulder, bright core
        const band = Math.floor(v * power + (bayer(x, y) - 0.5) * 0.55 + 0.5)
        const i = y * w + x
        if (band > buf.band[i]) {
          buf.band[i] = band
          buf.kind[i] = kind
        }
      }
    }
  }
  const n = w * h
  for (let i = 0; i < n; i++) {
    const b = buf.band[i]
    if (b === 0) {
      out[i] = ambient[i] * GLOW_LEVELS
      continue
    }
    const level = Math.min(AMB_LEVELS - 1, ambient[i] + b)
    const step = Math.min(3, Math.ceil(b / 2))
    out[i] = level * GLOW_LEVELS + (buf.kind[i] === 1 ? step : 3 + step)
  }
}

/** Output colours (packed little-endian RGBA) of one source colour for every (ambient level, glow) state. */
export function buildLut(r: number, g: number, b: number): Uint32Array {
  const lut = new Uint32Array(LIGHT_STATES)
  const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))
  for (let level = 0; level < AMB_LEVELS; level++) {
    const k = level / (AMB_LEVELS - 1)
    const f = AMB_FACTOR[level]
    const tr = TINT_DARK[0] + (1 - TINT_DARK[0]) * k
    const tg = TINT_DARK[1] + (1 - TINT_DARK[1]) * k
    const tb = TINT_DARK[2] + (1 - TINT_DARK[2]) * k
    const s = SAT[level]
    const lum = 0.3 * r + 0.59 * g + 0.11 * b
    const sr = lum + (r - lum) * s
    const sg = lum + (g - lum) * s
    const sb = lum + (b - lum) * s
    for (let glow = 0; glow < GLOW_LEVELS; glow++) {
      let or = sr * f * tr
      let og = sg * f * tg
      let ob = sb * f * tb
      if (glow >= 1 && glow <= 3) {
        const a = WARM_ADD[glow]
        or += WARM[0] * a
        og += WARM[1] * a
        ob += WARM[2] * a
      } else if (glow >= 4) {
        const a = COOL_ADD[glow - 3]
        or += COOL[0] * a
        og += COOL[1] * a
        ob += COOL[2] * a
      }
      lut[level * GLOW_LEVELS + glow] = (255 << 24) | (clamp(ob) << 16) | (clamp(og) << 8) | clamp(or)
    }
  }
  return lut
}

/**
 * Applies the light index to RGBA pixels in place. Transparent pixels are left alone. `luts` caches one table
 * per distinct source colour (the scene only ever contains a few dozen).
 */
export function applyLightIndex(pixels: Uint8ClampedArray, index: Uint8Array, luts: Map<number, Uint32Array>): void {
  const out = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.length >> 2)
  let lastKey = -1
  let lastLut: Uint32Array | null = null
  for (let i = 0; i < out.length; i++) {
    const px = out[i]
    if (px >>> 24 === 0) continue
    const key = px & 0xffffff
    if (key !== lastKey || !lastLut) {
      let lut = luts.get(key)
      if (!lut) {
        lut = buildLut(key & 255, (key >> 8) & 255, (key >> 16) & 255)
        luts.set(key, lut)
      }
      lastKey = key
      lastLut = lut
    }
    out[i] = lastLut[index[i]]
  }
}

/** Per-pixel light state at a point (for lighting the crew sprites to match their surroundings). */
export function stateAt(index: Uint8Array, w: number, h: number, x: number, y: number): { level: number; glow: number } {
  const cx = Math.max(0, Math.min(w - 1, Math.round(x)))
  const cy = Math.max(0, Math.min(h - 1, Math.round(y)))
  const v = index[cy * w + cx]
  return { level: Math.floor(v / GLOW_LEVELS), glow: v % GLOW_LEVELS }
}

/** Ambient-only light state (no glow) for a level, e.g. baking the sky. */
export const stateFor = (level: number, glow = 0): number => level * GLOW_LEVELS + glow
