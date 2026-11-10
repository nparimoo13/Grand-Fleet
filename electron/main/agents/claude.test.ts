import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeTool, summarizeToolUse } from './claude-tools'
import { buildClaudeSettings, cleanEnv } from './claude-code'
import { OutputMatcher, stripAnsi } from './output-matcher'

const WT = path.resolve('/work/tree')

describe('describeTool', () => {
  it('maps Bash to a shell request', () => {
    const d = describeTool('Bash', { command: 'pnpm test' }, WT)
    expect(d.requests).toEqual([{ kind: 'shell', command: 'pnpm test' }])
    expect(d.summary).toBe('Run: pnpm test')
  })

  it('maps PowerShell to a shell request too', () => {
    expect(describeTool('PowerShell', { command: 'Remove-Item x' }, WT).requests).toEqual([{ kind: 'shell', command: 'Remove-Item x' }])
  })

  it('maps read/search tools and resolves relative paths against the worktree', () => {
    expect(describeTool('Read', { file_path: 'src/a.ts' }, WT).requests).toEqual([{ kind: 'read', path: path.join(WT, 'src', 'a.ts') }])
    expect(describeTool('Grep', { pattern: 'foo' }, WT).requests).toEqual([{ kind: 'search', path: WT }])
    expect(describeTool('Glob', { pattern: '*.ts', path: '../escape' }, WT).requests).toEqual([
      { kind: 'search', path: path.resolve(WT, '../escape') }
    ])
  })

  it('maps edit tools', () => {
    for (const tool of ['Edit', 'MultiEdit', 'Write']) {
      expect(describeTool(tool, { file_path: 'a.txt' }, WT).requests).toEqual([{ kind: 'edit', path: path.join(WT, 'a.txt') }])
    }
    expect(describeTool('NotebookEdit', { notebook_path: 'n.ipynb' }, WT).requests).toEqual([{ kind: 'edit', path: path.join(WT, 'n.ipynb') }])
  })

  it('maps web tools to network requests', () => {
    expect(describeTool('WebFetch', { url: 'https://example.com/x?y=1' }, WT).requests).toEqual([{ kind: 'network', host: 'example.com' }])
    expect(describeTool('WebFetch', { url: 'not a url' }, WT).requests).toBeNull()
    expect(describeTool('WebSearch', { query: 'cats' }, WT).requests).toEqual([{ kind: 'network', host: 'web search' }])
  })

  it('returns null requests for unknown and MCP tools so they always ask', () => {
    expect(describeTool('SomethingNew', {}, WT).requests).toBeNull()
    const mcp = describeTool('mcp__github__create_issue', { title: 't' }, WT)
    expect(mcp.requests).toBeNull()
    expect(mcp.summary).toContain('github / create_issue')
  })

  it('tolerates a missing or malformed input', () => {
    expect(describeTool('Bash', undefined, WT).requests).toBeNull()
    expect(describeTool('Read', 'garbage', WT).requests).toEqual([{ kind: 'read', path: WT }])
  })

  it('truncates long commands in the summary but keeps them whole in the detail', () => {
    const cmd = `echo ${'x'.repeat(500)}`
    const d = describeTool('Bash', { command: cmd }, WT)
    expect(d.summary.length).toBeLessThan(160)
    expect(d.detail).toBe(cmd)
  })

  it('summarizes subagent and todo tools for the activity log', () => {
    expect(summarizeToolUse('Task', { description: 'Audit the build' }, WT)).toBe('Delegating: Audit the build')
    expect(summarizeToolUse('TodoWrite', {}, WT)).toBe('Updating the to-do list')
  })
})

describe('buildClaudeSettings', () => {
  const input = { hookUrl: 'http://127.0.0.1:1/t/a/hook', statusUrl: 'http://127.0.0.1:1/t/a/status', platform: 'win32' as const }

  it('registers an HTTP hook for every event we use, with a long timeout only for permissions', () => {
    const s = buildClaudeSettings(input) as { hooks: Record<string, Array<{ hooks: Array<{ type: string; url: string; timeout: number }> }>> }
    for (const ev of ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'StopFailure', 'Notification', 'SessionEnd']) {
      expect(s.hooks[ev][0].hooks[0]).toMatchObject({ type: 'http', url: input.hookUrl })
      expect(s.hooks[ev][0].hooks[0].timeout).toBeLessThanOrEqual(10)
    }
    expect(s.hooks.PermissionRequest[0].hooks[0]).toMatchObject({ type: 'http', url: input.hookUrl })
    expect(s.hooks.PermissionRequest[0].hooks[0].timeout).toBeGreaterThanOrEqual(600)
  })

  it('delivers SessionStart through a curl command hook, because Claude Code has no HTTP hooks for it', () => {
    const s = buildClaudeSettings(input) as { hooks: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>> }
    const h = s.hooks.SessionStart[0].hooks[0]
    expect(h.type).toBe('command')
    expect(h.command).toContain('--data-binary @-')
    expect(h.command).toContain(`"${input.hookUrl}"`)
  })

  it('uses curl.exe on Windows (avoids the PowerShell alias) and curl elsewhere', () => {
    const win = buildClaudeSettings(input) as { statusLine: { command: string } }
    expect(win.statusLine.command.startsWith('curl.exe ')).toBe(true)
    expect(win.statusLine.command).toContain(`"${input.statusUrl}"`)
    const mac = buildClaudeSettings({ ...input, platform: 'darwin' }) as { statusLine: { command: string } }
    expect(mac.statusLine.command.startsWith('curl ')).toBe(true)
  })
})

describe('cleanEnv', () => {
  it('drops nested-session markers and sets terminal type', () => {
    const env = cleanEnv({ PATH: '/bin', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', ELECTRON_RUN_AS_NODE: '1', CLAUDE_CODE_USE_BEDROCK: '1' })
    expect(env.CLAUDECODE).toBeUndefined()
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined()
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    // user configuration must survive
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBe('1')
    expect(env.PATH).toBe('/bin')
    expect(env.TERM).toBe('xterm-256color')
  })
})

describe('OutputMatcher', () => {
  it('strips ANSI and treats cursor-forward as a space', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red')
    expect(stripAnsi('Do\u001b[1Cyou\u001b[1Ctrust')).toBe('Do you trust')
  })

  it('detects the folder trust dialog, including split chunks and ink cursor moves', () => {
    const m = new OutputMatcher()
    expect(m.feed('Do you trust the fi')).toBeNull()
    expect(m.feed('les in this folder?')).toBe('trust')
    expect(new OutputMatcher().feed('Quick\u001b[1Csafety\u001b[1Ccheck: Is this a project you created or one you trust?')).toBe('trust')
  })

  it('detects onboarding and login screens', () => {
    expect(new OutputMatcher().feed("Let's get started.\r\nChoose the text style")).toBe('onboarding')
    expect(new OutputMatcher().feed('Not logged in · Please run /login')).toBe('login')
  })

  it('stays quiet for ordinary output and does not repeat a detection', () => {
    const m = new OutputMatcher()
    expect(m.feed('Reading files...\r\nrunning tests')).toBeNull()
    expect(m.feed('trust this folder')).toBe('trust')
    expect(m.feed('more output')).toBeNull()
  })
})
