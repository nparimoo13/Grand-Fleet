import type { Pix } from './pix'

/** Straw-hat skull and crossbones, at three sizes: the flag (small), the old foresail (big), the mainsail (huge). */
export type EmblemSize = 'small' | 'big' | 'huge'

const DIMS = {
  small: { bone: 6, rx: 5, jawW: 5, jawH: 3, jawInW: 3, jawInH: 2, e: 2, eyeL: 3, eyeR: 2, nose: 2, hw: 7, hatRy: 2, hatBandDy: 1, hatTopRx: 4, hatTopRy: 3, bandW: 9, teeth: [] as number[], boneThick: 2 },
  big: { bone: 11, rx: 8, jawW: 7, jawH: 4, jawInW: 5, jawInH: 3, e: 3, eyeL: 5, eyeR: 3, nose: 3, hw: 12, hatRy: 3, hatBandDy: 0, hatTopRx: 6, hatTopRy: 4, bandW: 13, teeth: [-2, 0, 2], boneThick: 2 },
  huge: { bone: 20, rx: 14, jawW: 12, jawH: 7, jawInW: 9, jawInH: 5, e: 5, eyeL: 9, eyeR: 5, nose: 5, hw: 22, hatRy: 5, hatBandDy: 0, hatTopRx: 11, hatTopRy: 7, bandW: 23, teeth: [-4, -2, 0, 2, 4], boneThick: 3 }
}

export function jolly(p: Pix, cx: number, cy: number, size: EmblemSize, ink = 'f'): void {
  const d = DIMS[size]
  for (let t = 0; t < d.boneThick; t++) {
    p.line(cx - d.bone + t, cy - d.bone, cx + d.bone + t, cy + d.bone, ink)
    p.line(cx - d.bone + t, cy + d.bone, cx + d.bone + t, cy - d.bone, ink)
  }
  const rx = d.rx
  p.ellipse(cx, cy, rx, rx, ink)
  p.ellipse(cx, cy, rx - 1, rx - 1, 'r')
  p.rect(cx - Math.floor(d.jawW / 2), cy + rx - 1, d.jawW, d.jawH, ink)
  p.rect(cx - Math.floor(d.jawInW / 2), cy + rx - 1, d.jawInW, d.jawInH, 'r')
  p.rect(cx - d.eyeL, cy - 1, d.e, d.e, 'f')
  p.rect(cx + d.eyeR, cy - 1, d.e, d.e, 'f')
  p.put(cx, cy + d.nose, 'f')
  for (const dx of d.teeth) p.put(cx + dx, cy + rx + 1, ink)
  // straw hat with a red band
  p.ellipse(cx, cy - rx + 1, d.hw, d.hatRy, 'x')
  p.hline(cx - d.hw + 2, cy - rx + d.hatBandDy, d.hw * 2 - 3, 'w')
  p.ellipse(cx, cy - rx - 1, d.hatTopRx, d.hatTopRy, 'y')
  p.hline(cx - d.hatTopRx, cy - rx + d.hatBandDy, d.bandW, 'u')
}
