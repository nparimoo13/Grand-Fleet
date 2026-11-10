import { describe, expect, it } from 'vitest'
import { GF32 } from './palette'
import { castShadow, compose, floorShadow, outline, parseRow, sprite, touchesEdge } from './sprite'

describe('GF32 palette', () => {
  it('has exactly 32 distinct opaque colours', () => {
    const hexes = new Set(Object.values(GF32).map((c) => c.join(',')))
    expect(Object.keys(GF32)).toHaveLength(32)
    expect(hexes.size).toBe(32)
  })
})

describe('parseRow', () => {
  it('expands run lengths and fill', () => {
    expect(parseRow('.2 j i3 h*', 10, 't').join('')).toBe('..jiiihhhh')
  })
  it('rejects wrong widths, unknown keys and double fills', () => {
    expect(() => parseRow('j4', 5, 't')).toThrow(/expected 5/)
    expect(() => parseRow('j6', 5, 't')).toThrow(/expected 5/)
    expect(() => parseRow('Q4', 4, 't')).toThrow(/unknown palette key/)
    expect(() => parseRow('j* i*', 5, 't')).toThrow(/more than one fill/)
    expect(() => parseRow('j-4', 5, 't')).toThrow(/cannot parse/)
  })
})

describe('outline', () => {
  it('outlines with the darkest shade of the neighbouring ramp and leaves dark edges alone', () => {
    const s = sprite('t', 5, ['.*', '. c d .2', '. a c .2', '.*'])
    const o = outline(s)
    expect(o.px[0].join('')).toBe('.aa..')
    expect(o.px[1][0]).toBe('a')
    // the pixel left of the already-dark `a` gets no extra rim
    expect(o.px[2][0]).toBe('.')
  })
  it('uses the steel outline for steel and never touches opaque pixels', () => {
    const s = sprite('t', 4, ['.*', '. j2 .', '.*'])
    const o = outline(s)
    expect(o.px[1].join('')).toBe('fjjf')
    expect(o.px[0].join('')).toBe('.ff.')
  })
})

describe('compose and shadows', () => {
  it('stamps parts and rejects overflow', () => {
    const part = sprite('p', 2, ['j2'])
    const out = compose('c', 4, 2, [[part, 1, 1]])
    expect(out.px[1].join('')).toBe('.jj.')
    expect(() => compose('c', 4, 2, [[part, 3, 0]])).toThrow(/overflows/)
  })
  it('casts a solid 1px shadow to the right and below without covering the sprite', () => {
    const s = sprite('t', 4, ['.*', '. j2 .', '.*'])
    const sh = castShadow(s)
    expect(sh.w).toBe(5)
    expect(sh.h).toBe(4)
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[y][x] !== '.') expect(sh.px[y][x]).toBe('.')
    // the opaque middle row (x=1..2) leaves a continuous shadow to its right and underneath
    expect(sh.px[1][3]).toBe('k')
    expect(sh.px[2].slice(1, 4)).toEqual(['k', 'k', 'k'])
  })
  it('makes a floor shadow ellipse', () => {
    const f = floorShadow(16, 4)
    expect(f.px.flat().some((c) => c === 'k')).toBe(true)
    expect(touchesEdge(f)).toBe(true)
  })
})
