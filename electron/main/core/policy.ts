import path from 'node:path'
import type {
  AutoPolicy,
  PolicyCategory,
  PolicyContext,
  PolicyVerdict,
  ShellGroup,
  ToolRequest
} from '../../../shared/types/policy'

/**
 * Pure policy evaluation. No I/O. Anything we cannot positively classify as
 * safe falls through to "ask".
 */

/** Shell metacharacters that can chain, redirect or substitute commands. */
const UNSAFE_SHELL_SYNTAX = /[;&|<>`\r\n]|\$\(|\$\{/

/** Groups are checked from most to least risky so a risky match always wins. */
const GROUP_PRIORITY: ShellGroup[] = [
  'git_remote_history',
  'delete',
  'install',
  'network',
  'build_test',
  'git_readonly',
  'git_commit'
]

const GIT_BRANCH_READONLY_FLAGS = new Set([
  '-a',
  '-r',
  '-v',
  '-vv',
  '--list',
  '-l',
  '--all',
  '--remotes',
  '--verbose',
  '--show-current'
])

export function tokenize(command: string): string[] | null {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let hasToken = false
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      hasToken = true
    } else if (/\s/.test(ch)) {
      if (hasToken || current) tokens.push(current)
      current = ''
      hasToken = false
    } else {
      current += ch
      hasToken = true
    }
  }
  if (quote) return null
  if (hasToken || current) tokens.push(current)
  return tokens
}

export function isInside(root: string, target: string): boolean {
  const resolved = path.resolve(root, target)
  const rel = path.relative(path.resolve(root), resolved)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function looksLikePath(token: string): boolean {
  const value = token.includes('=') && token.startsWith('-') ? token.slice(token.indexOf('=') + 1) : token
  if (!value || (value.startsWith('-') && !value.includes('/') && !value.includes('\\'))) return false
  if (value.startsWith('~')) return true
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return true
  if (/^[a-zA-Z]:/.test(value)) return true
  return value.split(/[\\/]/).includes('..')
}

function pathEscapes(worktree: string, token: string): boolean {
  const value = token.includes('=') && token.startsWith('-') ? token.slice(token.indexOf('=') + 1) : token
  if (value.startsWith('~')) return true
  return !isInside(worktree, value)
}

function startsWithPattern(tokens: string[], pattern: string): boolean {
  const parts = pattern.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0 || tokens.length < parts.length) return false
  return parts.every((p, i) => p.toLowerCase() === tokens[i].toLowerCase())
}

function verdict(
  policy: AutoPolicy,
  category: PolicyCategory,
  reason: string
): PolicyVerdict {
  return { decision: policy.categories[category], category, reason }
}

function classifyShell(command: string, policy: AutoPolicy, ctx: PolicyContext): PolicyVerdict {
  if (UNSAFE_SHELL_SYNTAX.test(command)) {
    return verdict(policy, 'unlisted_shell', 'Compound, redirected or substituted command')
  }
  const tokens = tokenize(command)
  if (!tokens || tokens.length === 0) {
    return verdict(policy, 'unlisted_shell', 'Could not parse command')
  }
  if (tokens.slice(1).some((t) => looksLikePath(t) && pathEscapes(ctx.worktree, t))) {
    return verdict(policy, 'outside_worktree', 'Command refers to a path outside the worktree')
  }
  for (const group of GROUP_PRIORITY) {
    const match = policy.commandGroups[group].find((p) => startsWithPattern(tokens, p))
    if (!match) continue
    if (tokens.some((t) => t.toLowerCase().startsWith('--output'))) {
      return verdict(policy, 'unlisted_shell', 'Command writes to an arbitrary file')
    }
    if (match.toLowerCase() === 'git branch') {
      const extra = tokens.slice(2)
      if (extra.some((t) => !GIT_BRANCH_READONLY_FLAGS.has(t))) {
        return verdict(policy, 'unlisted_shell', 'git branch with arguments that may modify branches')
      }
    }
    return verdict(policy, group, `Matches "${match}"`)
  }
  return verdict(policy, 'unlisted_shell', 'Command is not on the allowlist')
}

function classify(req: ToolRequest, policy: AutoPolicy, ctx: PolicyContext): PolicyVerdict {
  switch (req.kind) {
    case 'read':
    case 'search':
    case 'edit':
    case 'delete': {
      if (!isInside(ctx.worktree, req.path)) {
        return verdict(policy, 'outside_worktree', 'Path is outside the agent worktree')
      }
      if (req.kind === 'delete') return verdict(policy, 'delete', 'Deleting files')
      if (req.kind === 'edit') return verdict(policy, 'edit_in_worktree', 'Editing inside own worktree')
      return verdict(policy, 'read_search', 'Reading or searching inside own worktree')
    }
    case 'network': {
      const host = req.host.trim().toLowerCase()
      if (policy.networkAllowlist.some((h) => h.toLowerCase() === host)) {
        return { decision: 'auto', category: 'network', reason: `${host} is on the network allowlist` }
      }
      return verdict(policy, 'network', `${host} is not on the network allowlist`)
    }
    case 'shell':
      return classifyShell(req.command, policy, ctx)
  }
}

export function evaluatePolicy(
  req: ToolRequest,
  policy: AutoPolicy,
  ctx: PolicyContext
): PolicyVerdict {
  const result = classify(req, policy, ctx)
  if (!ctx.autoMode && result.decision === 'auto') {
    return { ...result, decision: 'ask', reason: `${result.reason} (auto mode is off)` }
  }
  return result
}
