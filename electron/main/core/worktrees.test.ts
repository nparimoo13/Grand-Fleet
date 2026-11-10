import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runFile } from './exec'
import {
  addWorktree,
  branchName,
  ensureRepoWithCommit,
  listActiveAgents,
  removeWorktree,
  repoState,
  worktreePath
} from './worktrees'

let base: string
let repo: string

const git = (cwd: string, ...args: string[]) => runFile('git', args, { cwd })

beforeAll(() => {
  // A path with a space, to catch quoting bugs.
  base = mkdtempSync(path.join(os.tmpdir(), 'grand fleet '))
  repo = path.join(base, 'my voyage')
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('worktrees', () => {
  it('initialises a non-git folder with a first commit', async () => {
    const { mkdirSync } = await import('node:fs')
    mkdirSync(repo)
    expect(await repoState(repo)).toBe('none')
    await ensureRepoWithCommit(repo)
    expect(await repoState(repo)).toBe('root')
    const log = await git(repo, 'log', '--oneline')
    expect(log.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('refuses a subfolder of an existing repo', async () => {
    const sub = path.join(repo, 'sub')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(sub)
    expect(await repoState(sub)).toBe('subdir')
    await expect(ensureRepoWithCommit(sub)).rejects.toThrow(/inside another git repository/)
  })

  it('creates a worktree per agent on its own branch, and is idempotent', async () => {
    const wt = await addWorktree(repo, 'luffy')
    expect(wt).toBe(worktreePath(repo, 'luffy'))
    expect(existsSync(path.join(wt, '.git'))).toBe(true)
    const branch = (await git(wt, 'rev-parse', '--abbrev-ref', 'HEAD')).stdout.trim()
    expect(branch).toBe(branchName('luffy'))
    expect(await addWorktree(repo, 'luffy')).toBe(wt)
    await addWorktree(repo, 'nami')
    expect((await listActiveAgents(repo)).sort()).toEqual(['luffy', 'nami'])
  })

  it('keeps .grandfleet out of git status without editing .gitignore', async () => {
    const status = await git(repo, 'status', '--porcelain')
    expect(status.stdout.trim()).toBe('')
    expect(existsSync(path.join(repo, '.gitignore'))).toBe(false)
    const exclude = readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8')
    expect(exclude).toContain('.grandfleet/')
  })

  it('removes a clean worktree but keeps the branch', async () => {
    const res = await removeWorktree(repo, 'nami')
    expect(res.removed).toBe(true)
    expect(existsSync(worktreePath(repo, 'nami'))).toBe(false)
    expect(await listActiveAgents(repo)).toEqual(['luffy'])
    const branches = await git(repo, 'branch', '--list', branchName('nami'))
    expect(branches.stdout).toContain(branchName('nami'))
  })

  it('keeps a dirty worktree and reports why', async () => {
    const wt = worktreePath(repo, 'luffy')
    writeFileSync(path.join(wt, 'scratch.txt'), 'work in progress')
    const res = await removeWorktree(repo, 'luffy')
    expect(res.removed).toBe(false)
    expect(res.reason).toMatch(/uncommitted/)
    expect(existsSync(wt)).toBe(true)
  })

  it('reuses an existing branch when re-activating', async () => {
    const wt = await addWorktree(repo, 'nami')
    expect(existsSync(wt)).toBe(true)
  })

  it('rejects unsafe agent ids', async () => {
    await expect(addWorktree(repo, '../evil')).rejects.toThrow(/Invalid agent id/)
    await expect(addWorktree(repo, 'a b')).rejects.toThrow(/Invalid agent id/)
  })
})
