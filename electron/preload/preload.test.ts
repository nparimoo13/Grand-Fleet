import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS, IPC_EVENT_CHANNELS } from '../../shared/ipc'

const src = readFileSync(path.join(__dirname, 'index.ts'), 'utf8')

function setContents(marker: string): string[] {
  const start = src.indexOf(marker)
  const block = src.slice(start, src.indexOf('])', start))
  return [...block.matchAll(/'([a-zA-Z]+:[a-zA-Z]+)'/g)].map((m) => m[1]).sort()
}

describe('preload channel allowlists', () => {
  it('invoke list matches IPC_CHANNELS exactly', () => {
    expect(setContents('const ALLOWED: ReadonlySet')).toEqual([...IPC_CHANNELS].sort())
  })

  it('event list matches IPC_EVENT_CHANNELS exactly', () => {
    expect(setContents('const ALLOWED_EVENTS')).toEqual([...IPC_EVENT_CHANNELS].sort())
  })
})
