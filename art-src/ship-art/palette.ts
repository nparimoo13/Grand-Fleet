import type { Palette } from '../lib/raster'

/**
 * "Grand Fleet 32": the only colours any ship-art pixel may use. See design/STYLE.md.
 * Ramps run darkest/outline -> shadow -> base -> light -> highlight.
 * '.' is transparent in sprite sources and is intentionally not a key.
 */
export const GF32: Palette = {
  // steel
  f: [0x1b, 0x1f, 0x33],
  g: [0x3c, 0x47, 0x66],
  h: [0x6d, 0x83, 0xa3],
  i: [0xa9, 0xbd, 0xd2],
  j: [0xea, 0xf2, 0xf7],
  // wood
  a: [0x35, 0x20, 0x1f],
  b: [0x6a, 0x3a, 0x2b],
  c: [0xa2, 0x66, 0x3a],
  d: [0xd2, 0x9a, 0x58],
  e: [0xf4, 0xcf, 0x8c],
  // teal paint
  k: [0x0e, 0x3a, 0x44],
  l: [0x1b, 0x6a, 0x6e],
  m: [0x3a, 0xa8, 0x8e],
  n: [0x86, 0xdc, 0xae],
  // cream
  o: [0x8f, 0x75, 0x61],
  p: [0xcd, 0xb0, 0x8a],
  q: [0xec, 0xd7, 0xa8],
  r: [0xff, 0xf3, 0xd2],
  // red
  s: [0x4a, 0x14, 0x28],
  t: [0x9a, 0x2c, 0x3e],
  u: [0xd8, 0x4c, 0x42],
  v: [0xfb, 0x8f, 0x66],
  // gold / orange
  w: [0xa9, 0x59, 0x1c],
  x: [0xf0, 0xa0, 0x30],
  y: [0xff, 0xe0, 0x70],
  // green
  z: [0x2b, 0x5c, 0x36],
  A: [0x66, 0xb2, 0x4c],
  // skin
  C: [0xc4, 0x7a, 0x5c],
  D: [0xf3, 0xbc, 0x94],
  // sky / sea blue
  E: [0x27, 0x47, 0x8e],
  F: [0x41, 0x81, 0xc8],
  G: [0x86, 0xc8, 0xee]
}

export const GF32_KEYS = Object.keys(GF32)

/** Outline colour for a pixel of each ramp: the darkest shade of its hue. */
export const OUTLINE_OF: Readonly<Record<string, string>> = {
  f: 'f', g: 'f', h: 'f', i: 'f', j: 'f',
  a: 'a', b: 'a', c: 'a', d: 'a', e: 'a',
  k: 'k', l: 'k', m: 'k', n: 'k',
  o: 'a', p: 'a', q: 'a', r: 'a',
  s: 's', t: 's', u: 's', v: 's',
  w: 'a', x: 'w', y: 'w',
  z: 'z', A: 'z',
  C: 'a', D: 'a',
  E: 'E', F: 'E', G: 'E'
}

/** Keys that already are the darkest shade of their ramp: no second outline is added next to them. */
export const DARKEST_KEYS: ReadonlySet<string> = new Set(['f', 'a', 'k', 's', 'z', 'E'])

/** When a transparent pixel touches several ramps, the earliest of these wins. */
export const OUTLINE_PRIORITY = ['f', 'a', 'k', 's', 'z', 'E', 'w'] as const
