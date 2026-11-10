import path from 'node:path'
import type { ToolRequest } from '../../../shared/types/policy'

export interface ToolDescription {
  tool: string
  summary: string
  detail: string
  /** null = unrecognized tool: the policy can't judge it, so it always asks. */
  requests: ToolRequest[] | null
}

/** Tools that show an interactive dialog; the human must answer these in the terminal. */
export const INTERACTIVE_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function truncate(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function resolvePath(cwd: string, p: string | null): string {
  return p ? path.resolve(cwd, p) : cwd
}

/** Normalize a Claude Code tool call for the policy engine and for display. */
export function describeTool(tool: string, input: unknown, cwd: string): ToolDescription {
  const i = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>

  switch (tool) {
    case 'Bash':
    case 'PowerShell': {
      const command = str(i.command) ?? ''
      return {
        tool,
        summary: `Run: ${truncate(command, 140)}`,
        detail: command,
        requests: command ? [{ kind: 'shell', command }] : null
      }
    }
    case 'Read':
    case 'NotebookRead': {
      const p = resolvePath(cwd, str(i.file_path) ?? str(i.notebook_path))
      return { tool, summary: `Read ${p}`, detail: p, requests: [{ kind: 'read', path: p }] }
    }
    case 'LS': {
      const p = resolvePath(cwd, str(i.path))
      return { tool, summary: `List ${p}`, detail: p, requests: [{ kind: 'read', path: p }] }
    }
    case 'Glob':
    case 'Grep': {
      const p = resolvePath(cwd, str(i.path))
      const what = str(i.pattern) ?? ''
      return {
        tool,
        summary: `${tool === 'Glob' ? 'Find files' : 'Search'} "${truncate(what, 60)}" in ${p}`,
        detail: `${what}\n${p}`,
        requests: [{ kind: 'search', path: p }]
      }
    }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit': {
      const p = resolvePath(cwd, str(i.file_path) ?? str(i.notebook_path))
      return {
        tool,
        summary: `${tool === 'Write' ? 'Write' : 'Edit'} ${p}`,
        detail: p,
        requests: [{ kind: 'edit', path: p }]
      }
    }
    case 'WebFetch': {
      const url = str(i.url) ?? ''
      let host: string | null = null
      try {
        host = new URL(url).hostname
      } catch {
        host = null
      }
      return {
        tool,
        summary: `Fetch ${truncate(url, 120)}`,
        detail: url,
        requests: host ? [{ kind: 'network', host }] : null
      }
    }
    case 'WebSearch': {
      const q = str(i.query) ?? ''
      return {
        tool,
        summary: `Search the web: ${truncate(q, 100)}`,
        detail: q,
        requests: [{ kind: 'network', host: 'web search' }]
      }
    }
    default: {
      const detail = safeJson(i)
      const label = tool.startsWith('mcp__') ? `MCP tool ${tool.slice(5).replace('__', ' / ')}` : tool
      return { tool, summary: `Use ${label}`, detail, requests: null }
    }
  }
}

/** Short description for activity display (PreToolUse). */
export function summarizeToolUse(tool: string, input: unknown, cwd: string): string {
  const i = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  if (tool === 'Task' || tool === 'Agent') {
    return `Delegating: ${truncate(str(i.description) ?? str(i.prompt) ?? 'a subtask', 100)}`
  }
  if (tool === 'TodoWrite') return 'Updating the to-do list'
  return describeTool(tool, input, cwd).summary
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, 4000)
  } catch {
    return ''
  }
}
