import path from 'node:path'
import os from 'node:os'
import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../../../shared/types/policy'
import { evaluatePolicy, tokenize } from './policy'

const worktree = path.join(os.tmpdir(), 'gf-policy', 'wt')
const ctx = { worktree, autoMode: true }
const sh = (command: string) => evaluatePolicy({ kind: 'shell', command }, DEFAULT_POLICY, ctx)

describe('file requests', () => {
  it('auto-approves reading and searching inside the worktree', () => {
    expect(evaluatePolicy({ kind: 'read', path: path.join(worktree, 'a.ts') }, DEFAULT_POLICY, ctx).decision).toBe('auto')
    expect(evaluatePolicy({ kind: 'search', path: 'src' }, DEFAULT_POLICY, ctx).decision).toBe('auto')
  })
  it('auto-approves edits inside the worktree only', () => {
    expect(evaluatePolicy({ kind: 'edit', path: 'src/a.ts' }, DEFAULT_POLICY, ctx).category).toBe('edit_in_worktree')
    const out = evaluatePolicy({ kind: 'edit', path: path.join(worktree, '..', 'other', 'a.ts') }, DEFAULT_POLICY, ctx)
    expect(out.decision).toBe('ask')
    expect(out.category).toBe('outside_worktree')
  })
  it('asks for sibling directories that share a name prefix', () => {
    const sibling = worktree + '-evil'
    expect(evaluatePolicy({ kind: 'read', path: path.join(sibling, 'x') }, DEFAULT_POLICY, ctx).decision).toBe('ask')
  })
  it('always asks before deleting, even inside the worktree', () => {
    const v = evaluatePolicy({ kind: 'delete', path: 'src/a.ts' }, DEFAULT_POLICY, ctx)
    expect(v).toMatchObject({ decision: 'ask', category: 'delete' })
  })
})

describe('shell commands', () => {
  it.each([
    'npm test',
    'npm run lint',
    'pnpm build',
    'pnpm typecheck',
    'pnpm run test -- --reporter dot',
    'git status',
    'git diff HEAD',
    'git log --oneline',
    'git show HEAD',
    'git branch',
    'git branch -a',
    'git add src/a.ts',
    'git add -A',
    'git commit -m "fix: thing"'
  ])('auto-approves %s', (command) => {
    expect(sh(command).decision).toBe('auto')
  })

  it.each([
    ['rm -rf node_modules', 'delete'],
    ['git clean -fd', 'delete'],
    ['npm install left-pad', 'install'],
    ['pnpm add zod', 'install'],
    ['git push origin main', 'git_remote_history'],
    ['git reset --hard HEAD~1', 'git_remote_history'],
    ['git rebase main', 'git_remote_history'],
    ['curl https://example.com', 'network'],
    ['python script.py', 'unlisted_shell'],
    ['node -e "1"', 'unlisted_shell']
  ])('asks for %s (%s)', (command, category) => {
    expect(sh(command)).toMatchObject({ decision: 'ask', category })
  })

  it('asks for git branch forms that modify branches', () => {
    expect(sh('git branch -D feature').decision).toBe('ask')
    expect(sh('git branch newbranch').decision).toBe('ask')
  })

  it('asks for chained, piped, redirected or substituted commands', () => {
    for (const c of ['npm test && rm -rf .', 'npm test | tee out', 'git status > ../x', 'git log $(whoami)', 'npm test; curl x', 'npm test `id`']) {
      expect(sh(c).decision).toBe('ask')
    }
  })

  it('asks when an argument escapes the worktree', () => {
    expect(sh('git add ../other/file').category).toBe('outside_worktree')
    expect(sh('npm run build --prefix ../other').category).toBe('outside_worktree')
    expect(sh('git diff --no-index ~/secret x').decision).toBe('ask')
    expect(sh(`git show ${path.resolve(worktree, '..', 'x')}`).decision).toBe('ask')
  })

  it('asks for git global options that could retarget the command', () => {
    expect(sh('git -C ../other status').decision).toBe('ask')
    expect(sh('git diff --output=file.txt').decision).toBe('ask')
  })

  it('is case-insensitive on command names', () => {
    expect(sh('NPM test').decision).toBe('auto')
  })

  it('asks on unbalanced quotes and empty commands', () => {
    expect(sh('git commit -m "oops').decision).toBe('ask')
    expect(sh('   ').decision).toBe('ask')
  })
})

describe('network and auto mode', () => {
  it('allows allowlisted hosts and asks for the rest', () => {
    expect(evaluatePolicy({ kind: 'network', host: 'API.anthropic.com' }, DEFAULT_POLICY, ctx).decision).toBe('auto')
    expect(evaluatePolicy({ kind: 'network', host: 'evil.example' }, DEFAULT_POLICY, ctx).decision).toBe('ask')
  })
  it('asks about everything when global auto mode is off', () => {
    const off = { worktree, autoMode: false }
    const v = evaluatePolicy({ kind: 'shell', command: 'npm test' }, DEFAULT_POLICY, off)
    expect(v.decision).toBe('ask')
    expect(v.category).toBe('build_test')
  })
  it('respects user edits to category decisions', () => {
    const policy = { ...DEFAULT_POLICY, categories: { ...DEFAULT_POLICY.categories, build_test: 'ask' as const } }
    expect(evaluatePolicy({ kind: 'shell', command: 'npm test' }, policy, ctx).decision).toBe('ask')
  })
})

describe('tokenize', () => {
  it('handles quotes', () => {
    expect(tokenize('git commit -m "a b" \'c d\'')).toEqual(['git', 'commit', '-m', 'a b', 'c d'])
    expect(tokenize('a "" b')).toEqual(['a', '', 'b'])
  })
})
