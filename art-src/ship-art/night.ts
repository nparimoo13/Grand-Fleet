import { GF32 } from './palette'
import { T, type Sprite } from './sprite'

/** Night palette shift: every key steps down its own ramp, so the result is still GF32. */
export const NIGHT: Record<string, string> = {
  b: 'a', c: 'b', d: 'c', e: 'd',
  o: 'a', p: 'o', q: 'p', r: 'q',
  t: 's', u: 't', v: 'u',
  w: 'a', x: 'w', y: 'x',
  g: 'f', h: 'g', i: 'h', j: 'i',
  A: 'z', z: 'z'
}

export function nightify(s: Sprite): Sprite {
  return { w: s.w, h: s.h, px: s.px.map((r) => r.map((k) => (k === T ? T : NIGHT[k] ?? k))) }
}

// keys must stay inside the palette
for (const v of Object.values(NIGHT)) if (!(v in GF32)) throw new Error(`night map: bad key ${v}`)
