import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCrewIndex, loadCrewPack } from './crew-loader'

const assets = path.resolve(__dirname, '../../../assets')

describe('crew loader', () => {
  it('lists the active crew plus locked coming-soon crews from index.json', () => {
    const index = loadCrewIndex(assets)
    expect(index.find((c) => c.available)?.id).toBe('strawhats')
    expect(index.filter((c) => c.comingSoon).map((c) => c.id)).toEqual(['heart', 'whitebeard', 'beast'])
  })

  it('loads and validates the Straw Hat pack', () => {
    const pack = loadCrewPack(assets, 'strawhats')
    expect(pack.ship.name).toBe('The Sunny Deck')
    expect(pack.characters).toHaveLength(10)
    expect(pack.characters.find((c) => c.id === pack.captainId)?.roleBadge).toBe('CAPTAIN')
    const rooms = new Set(pack.ship.rooms.map((r) => r.id))
    expect(pack.characters.every((c) => rooms.has(c.defaultRoomId))).toBe(true)
    expect(pack.shipArt?.sheets.some((s) => s.id === 'scene')).toBe(true)
  })

  it('gives every character a distinct room and ambient behaviours', () => {
    const pack = loadCrewPack(assets, 'strawhats')
    expect(new Set(pack.characters.map((c) => c.defaultRoomId)).size).toBe(10)
    expect(pack.characters.every((c) => c.ambient.length >= 2)).toBe(true)
  })

  it('reports characters that ship a complete drop-in sprite sheet', () => {
    expect(loadCrewPack(assets, 'strawhats').spriteOverrides).toEqual([])
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'gf-assets-'))
    try {
      cpSync(path.join(assets, 'crews'), path.join(tmp, 'crews'), { recursive: true })
      const dir = (id: string) => path.join(tmp, 'crews', 'strawhats', 'characters', id, 'override')
      for (const id of ['luffy', 'zoro']) mkdirSync(dir(id), { recursive: true })
      writeFileSync(path.join(dir('luffy'), 'luffy.png'), '')
      writeFileSync(path.join(dir('luffy'), 'luffy.json'), '{}')
      writeFileSync(path.join(dir('zoro'), 'zoro.png'), '') // json missing: not usable
      expect(loadCrewPack(tmp, 'strawhats').spriteOverrides).toEqual(['luffy'])
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('rejects locked crews and unsafe ids', () => {
    expect(() => loadCrewPack(assets, 'heart')).toThrow(/coming soon/)
    expect(() => loadCrewPack(assets, '../x')).toThrow(/Unsafe/)
    expect(() => loadCrewPack(assets, 'nope')).toThrow(/Unknown crew/)
  })
})
