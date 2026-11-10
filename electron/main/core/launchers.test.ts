import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES } from '../../../shared/types/app'
import { openInEditor } from '../ide'
import { checkAllClis } from './cli-check'
import { resolveOnPath, runFile } from './exec'

const isWin = process.platform === 'win32'
let base: string
let bin: string
const originalPath = process.env.PATH

/** Create a fake executable. `body` is a cmd script on Windows, a sh script elsewhere. */
function fake(name: string, win: string, posix: string): string {
  const file = path.join(bin, isWin ? `${name}.cmd` : name)
  writeFileSync(file, isWin ? win.replace(/\n/g, '\r\n') : `#!/bin/sh\n${posix}\n`)
  if (!isWin) chmodSync(file, 0o755)
  return file
}

beforeAll(() => {
  base = mkdtempSync(path.join(os.tmpdir(), 'gf launch '))
  bin = path.join(base, 'bin dir')
  mkdirSync(bin)
})
afterEach(() => {
  process.env.PATH = originalPath
})
afterAll(() => rmSync(base, { recursive: true, force: true }))

const waitFor = async (file: string): Promise<string> => {
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) {
      await new Promise((r) => setTimeout(r, 50))
      return readFileSync(file, 'utf8').trim()
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`timed out waiting for ${file}`)
}

describe('PATH resolution and process running', () => {
  it('finds executables on PATH (PATHEXT aware) and returns null otherwise', () => {
    fake('gf-tool', '@echo off\necho hi', 'echo hi')
    process.env.PATH = bin
    expect(resolveOnPath('gf-tool')).toMatch(/gf-tool/)
    expect(resolveOnPath('gf-missing')).toBeNull()
  })

  it('runs shims from a directory with spaces and passes arguments through', async () => {
    const file = fake('gf-echo', '@echo off\necho got:%1', 'echo got:$1')
    const res = await runFile(file, ['hello'])
    expect(res.code).toBe(0)
    expect(res.stdout.trim()).toBe('got:hello')
  })

  it.runIf(isWin)('refuses arguments that could inject into cmd.exe', async () => {
    const file = fake('gf-echo2', '@echo off\necho %1', 'echo $1')
    await expect(runFile(file, ['a" & calc & "'])).rejects.toThrow(/unsafe/i)
    await expect(runFile(file, ['%PATH%'])).rejects.toThrow(/unsafe/i)
  })

  it('reports a spawn failure softly when asked', async () => {
    const res = await runFile(path.join(base, 'does-not-exist'), [], { soft: true })
    expect(res.code).toBeNull()
  })
})

describe('CLI checks', () => {
  it('reports missing CLIs with an install command', async () => {
    process.env.PATH = path.join(base, 'empty')
    const results = await checkAllClis()
    expect(results.map((r) => r.found)).toEqual([false, false])
    expect(results[0].installCommand).toContain('npm install -g')
    expect(results[1].loginCommand).toBe('codex login')
  })

  it('detects an installed, logged-in Claude via JSON', async () => {
    fake(
      'claude',
      '@echo off\nif "%1"=="--version" goto v\nif "%1"=="auth" goto a\nexit /b 2\n:v\necho 9.9.9 Claude Code\nexit /b 0\n:a\necho {"loggedIn": true}\nexit /b 0',
      'if [ "$1" = "--version" ]; then echo "9.9.9 Claude Code"; exit 0; fi\nif [ "$1" = "auth" ]; then echo \'{"loggedIn": true}\'; exit 0; fi\nexit 2'
    )
    process.env.PATH = bin
    const claude = (await checkAllClis()).find((r) => r.provider === 'claude-code-cli')!
    expect(claude).toMatchObject({ found: true, loggedIn: true, version: '9.9.9 Claude Code' })
  })

  it('detects a logged-out Claude, even when it exits non-zero', async () => {
    fake(
      'claude',
      '@echo off\nif "%1"=="--version" goto v\nif "%1"=="auth" goto a\nexit /b 2\n:v\necho 9.9.9 Claude Code\nexit /b 0\n:a\necho {"loggedIn": false}\nexit /b 1',
      'if [ "$1" = "--version" ]; then echo "9.9.9 Claude Code"; exit 0; fi\nif [ "$1" = "auth" ]; then echo \'{"loggedIn": false}\'; exit 1; fi\nexit 2'
    )
    process.env.PATH = bin
    const claude = (await checkAllClis()).find((r) => r.provider === 'claude-code-cli')!
    expect(claude).toMatchObject({ found: true, loggedIn: false })
  })
})

describe('IDE launching', () => {
  const editor = (preferred: 'cursor' | 'code' | 'custom', custom = '') => ({ preferred, custom })
  const recorder = (name: string, marker: string) =>
    fake(name, `@echo off\r\necho ${name}:%1> "${marker}"`.replace(/\r\n/g, '\n'), `echo "${name}:$1" > "${marker}"`)

  it('uses Cursor by default and passes a folder containing spaces', async () => {
    const marker = path.join(base, 'cursor.out')
    recorder('cursor', marker)
    recorder('code', path.join(base, 'code.out'))
    process.env.PATH = bin
    const target = path.join(base, 'my project')
    mkdirSync(target, { recursive: true })
    expect(openInEditor(target, DEFAULT_PREFERENCES.editor)).toBe('cursor')
    expect(await waitFor(marker)).toContain(target)
  })

  it('falls back to VS Code when Cursor is not installed', async () => {
    rmSync(path.join(bin, isWin ? 'cursor.cmd' : 'cursor'), { force: true })
    const marker = path.join(base, 'code.out')
    rmSync(marker, { force: true })
    process.env.PATH = bin
    expect(openInEditor(base, editor('cursor'))).toBe('code')
    expect(await waitFor(marker)).toContain(base)
  })

  it('honours a custom command and passes its arguments before the folder', async () => {
    const marker = path.join(base, 'mine.out')
    fake('myed', `@echo off\necho %1 %2> "${marker}"`, `echo "$1 $2" > "${marker}"`)
    process.env.PATH = bin
    expect(openInEditor(base, editor('custom', 'myed --new-window'))).toBe('custom editor')
    const out = await waitFor(marker)
    expect(out.startsWith('--new-window')).toBe(true)
  })

  it('explains what to do when no editor is installed', () => {
    process.env.PATH = path.join(base, 'empty')
    expect(() => openInEditor(base, editor('cursor'))).toThrow(/No editor found/)
  })
})
