import { describe, expect, it } from 'vitest'
import { overrideFrames, type AseJson } from './overrides'

const frame = (x: number) => ({ frame: { x, y: 0, w: 24, h: 32 } })

describe('overrideFrames', () => {
  it('names frames by tag and shifts them down to where the sheet sits', () => {
    const json: AseJson = {
      frames: { a: frame(0), b: frame(24), c: frame(48), d: frame(72) },
      meta: { frameTags: [{ name: 'idle', from: 0, to: 1 }, { name: 'work', from: 2, to: 3 }] }
    }
    const o = overrideFrames('luffy', json, 100)
    expect(o.tags.get('luffy_idle')).toEqual(['luffy_idle_0', 'luffy_idle_1'])
    expect(o.tags.get('luffy_work')).toEqual(['luffy_work_0', 'luffy_work_1'])
    expect(o.frames.get('luffy_work_1')).toEqual({ x: 72, y: 100, w: 24, h: 32 })
  })

  it('accepts the array export format and ignores untagged and out-of-range frames', () => {
    const json: AseJson = {
      frames: [frame(0), frame(24), frame(48)],
      meta: { frameTags: [{ name: 'walk', from: 1, to: 9 }] }
    }
    const o = overrideFrames('zoro', json, 0)
    expect([...o.frames.keys()]).toEqual(['zoro_walk_0', 'zoro_walk_1'])
    expect([...o.tags.keys()]).toEqual(['zoro_walk'])
  })

  it('yields nothing when the sheet has no tags', () => {
    const o = overrideFrames('nami', { frames: [frame(0)], meta: {} }, 0)
    expect(o.frames.size + o.tags.size).toBe(0)
  })
})
