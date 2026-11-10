import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PNG } from 'pngjs'
import { afterAll, describe, expect, it } from 'vitest'
import { writeShipSheets } from './build'
import { GF32 } from './palette'
import { GALLEY_PROP_TYPES } from './props'

const dir = mkdtempSync(path.join(os.tmpdir(), 'gf-ship-art-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

interface Json {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>
  meta: { frameTags?: Array<{ name: string; from: number; to: number }>; anchors?: Record<string, { parent: string }> }
}

writeShipSheets(dir)
const sheet = (id: string) => ({
  png: PNG.sync.read(readFileSync(path.join(dir, `${id}.png`))),
  json: JSON.parse(readFileSync(path.join(dir, `${id}.json`), 'utf8')) as Json
})
const palette = new Set(Object.values(GF32).map(([r, g, b]) => `${r},${g},${b}`))

describe.each(['tiles', 'props', 'characters', 'ui', 'world'])('ship sheet %s', (id) => {
  const { png, json } = sheet(id)

  it('uses only GF32 colours with fully opaque or fully transparent pixels', () => {
    const bad = new Set<string>()
    for (let i = 0; i < png.data.length; i += 4) {
      const a = png.data[i + 3]
      if (a === 0) continue
      if (a !== 255) bad.add(`alpha ${a}`)
      else if (!palette.has(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`)) bad.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`)
    }
    expect([...bad]).toEqual([])
  })

  it('keeps every frame inside the sheet', () => {
    for (const [name, { frame: f }] of Object.entries(json.frames)) {
      expect(f.x >= 0 && f.y >= 0 && f.x + f.w <= png.width && f.y + f.h <= png.height, name).toBe(true)
    }
  })
})

describe('ship sheet contents', () => {
  it('has every galley prop with an outline-ready frame', () => {
    const { json } = sheet('props')
    for (const p of GALLEY_PROP_TYPES) {
      const names = Object.keys(json.frames).map((n) => n.replace(/\.png$/, ''))
      expect(names.some((n) => n === p || n.startsWith(`${p}_`)), p).toBe(true)
    }
  })

  it('keeps the galley within 6-12 distinct prop types', () => {
    expect(GALLEY_PROP_TYPES.length).toBeGreaterThanOrEqual(6)
    expect(GALLEY_PROP_TYPES.length).toBeLessThanOrEqual(12)
  })

  it('records overlay anchors that point at real sprites', () => {
    const { json } = sheet('props')
    const names = new Set(Object.keys(json.frames).map((n) => n.replace(/\.png$/, '')))
    expect(Object.keys(json.meta.anchors ?? {})).toEqual(expect.arrayContaining(['stove_flame', 'stove_steam']))
    for (const a of Object.values(json.meta.anchors ?? {})) expect(names.has(a.parent)).toBe(true)
  })

  it('makes every crew member 24x32 with a 2-frame idle, 4-frame walk and 4-frame work', () => {
    const { json } = sheet('characters')
    for (const [name, { frame: f }] of Object.entries(json.frames)) {
      if (name.includes('__shadow')) continue
      expect([name, f.w, f.h]).toEqual([name, 24, 32])
    }
    const tags = Object.fromEntries((json.meta.frameTags ?? []).map((t) => [t.name, t.to - t.from + 1]))
    for (const id of ['sanji', 'luffy', 'nami', 'robin', 'franky', 'usopp', 'chopper', 'zoro', 'jinbe', 'brook']) {
      expect([id, tags[`${id}_idle`], tags[`${id}_walk`], tags[`${id}_work`]]).toEqual([id, 2, 4, 4])
    }
  })

  it('has status bubbles for every live status and the pixel font', () => {
    const names = new Set(Object.keys(sheet('ui').json.frames).map((n) => n.replace(/\.png$/, '')))
    for (const n of ['bubble_working_0', 'bubble_working_1', 'bubble_waiting', 'bubble_error', 'bubble_idle', 'font_A', 'font_Z', 'font_0', 'plaque_l', 'plaque_m', 'plaque_r']) {
      expect(names.has(n), n).toBe(true)
    }
  })
})

