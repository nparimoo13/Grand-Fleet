import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { runFile } from './exec'

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr = ''
  ) {
    super(message)
    this.name = 'GitError'
  }
}

const AGENT_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/i

export function assertAgentId(agentId: string): void {
  if (!AGENT_ID.test(agentId)) throw new GitError(`Invalid agent id: ${agentId}`)
}

async function git(cwd: string, args: string[]): Promise<string> {
  const res = await runFile('git', args, { cwd, timeoutMs: 60_000, soft: true })
  if (res.code !== 0) {
    throw new GitError(`git ${args.slice(0, 2).join(' ')} failed: ${res.stderr.trim() || res.stdout.trim() || 'unknown error'}`, res.stderr)
  }
  return res.stdout
}

async function gitOk(cwd: string, args: string[]): Promise<boolean> {
  const res = await runFile('git', args, { cwd, timeoutMs: 30_000, soft: true })
  return res.code === 0
}

function sameFsPath(a: string, b: string): boolean {
  const na = path.resolve(a)
  const nb = path.resolve(b)
  return process.platform === 'win32' || process.platform === 'darwin'
    ? na.toLowerCase() === nb.toLowerCase()
    : na === nb
}

export type RepoState = 'root' | 'subdir' | 'none'

/** Is `dir` itself the root of a git repo, inside one, or not in one at all? */
export async function repoState(dir: string): Promise<RepoState> {
  const res = await runFile('git', ['rev-parse', '--show-toplevel'], { cwd: dir, soft: true, timeoutMs: 15_000 })
  if (res.code !== 0) return 'none'
  return sameFsPath(res.stdout.trim(), dir) ? 'root' : 'subdir'
}

export async function hasCommits(repo: string): Promise<boolean> {
  return gitOk(repo, ['rev-parse', '--verify', '--quiet', 'HEAD'])
}

/** Initialise a repo (if needed) and make sure it has at least one commit. */
export async function ensureRepoWithCommit(dir: string): Promise<void> {
  const state = await repoState(dir)
  if (state === 'subdir') {
    throw new GitError('This folder is inside another git repository. Choose the repository root instead.')
  }
  if (state === 'none') {
    if (!(await gitOk(dir, ['init', '-b', 'main']))) await git(dir, ['init'])
  }
  if (!(await hasCommits(dir))) {
    await git(dir, [
      '-c', 'user.name=Grand Fleet',
      '-c', 'user.email=grandfleet@localhost',
      'commit', '--allow-empty', '-m', 'Start voyage'
    ])
  }
}

/** Keep `.grandfleet/` out of `git status` without touching the user's .gitignore. */
export async function excludeGrandFleetDir(repo: string): Promise<void> {
  const rel = (await git(repo, ['rev-parse', '--git-path', 'info/exclude'])).trim()
  const file = path.resolve(repo, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (!existing.split(/\r?\n/).some((l) => l.trim() === '.grandfleet/')) {
    appendFileSync(file, `${existing && !existing.endsWith('\n') ? '\n' : ''}.grandfleet/\n`)
  }
}

export function worktreeRoot(repo: string): string {
  return path.join(repo, '.grandfleet', 'worktrees')
}

export function worktreePath(repo: string, agentId: string): string {
  assertAgentId(agentId)
  return path.join(worktreeRoot(repo), agentId)
}

export function branchName(agentId: string): string {
  assertAgentId(agentId)
  return `grandfleet/${agentId}`
}

export async function listWorktreePaths(repo: string): Promise<string[]> {
  const out = await git(repo, ['worktree', 'list', '--porcelain'])
  return out
    .split(/\r?\n/)
    .filter((l) => l.startsWith('worktree '))
    .map((l) => path.resolve(l.slice('worktree '.length)))
}

/** Agent ids that currently have a worktree under `.grandfleet/worktrees`. */
export async function listActiveAgents(repo: string): Promise<string[]> {
  const root = worktreeRoot(repo)
  if (!existsSync(root)) return []
  const registered = await listWorktreePaths(repo)
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && AGENT_ID.test(d.name))
    .filter((d) => registered.some((r) => sameFsPath(r, path.join(root, d.name))))
    .map((d) => d.name)
}

/** Create (or reuse) the agent's worktree on its own branch. Idempotent. */
export async function addWorktree(repo: string, agentId: string): Promise<string> {
  const wt = worktreePath(repo, agentId)
  const branch = branchName(agentId)
  await ensureRepoWithCommit(repo)
  await excludeGrandFleetDir(repo)
  const registered = await listWorktreePaths(repo)
  if (registered.some((r) => sameFsPath(r, wt)) && existsSync(wt)) return wt
  await git(repo, ['worktree', 'prune'])
  if (existsSync(wt) && readdirSync(wt).length > 0) {
    throw new GitError(`${wt} exists but is not a registered worktree. Remove or rename it and try again.`)
  }
  mkdirSync(worktreeRoot(repo), { recursive: true })
  const branchExists = await gitOk(repo, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])
  await git(repo, branchExists ? ['worktree', 'add', wt, branch] : ['worktree', 'add', '-b', branch, wt])
  return wt
}

export interface RemoveResult {
  removed: boolean
  reason: string | null
}

/** Remove the worktree only when it has no uncommitted changes. The branch is kept. */
export async function removeWorktree(repo: string, agentId: string): Promise<RemoveResult> {
  const wt = worktreePath(repo, agentId)
  const registered = await listWorktreePaths(repo)
  if (!registered.some((r) => sameFsPath(r, wt))) return { removed: true, reason: null }
  if (existsSync(wt)) {
    const status = await git(wt, ['status', '--porcelain'])
    if (status.trim().length > 0) {
      return { removed: false, reason: 'Worktree has uncommitted changes and was kept.' }
    }
  }
  await git(repo, ['worktree', 'remove', wt])
  return { removed: true, reason: null }
}
