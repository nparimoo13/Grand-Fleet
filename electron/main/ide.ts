import { existsSync } from 'node:fs'
import path from 'node:path'
import type { AppPreferences } from '../../shared/types/app'
import { launchDetached, resolveOnPath } from './core/exec'
import { tokenize } from './core/policy'

function resolveCustom(command: string): { file: string; args: string[] } | null {
  const tokens = tokenize(command.trim())
  if (!tokens || tokens.length === 0) return null
  const [bin, ...args] = tokens
  const file = bin.includes('/') || bin.includes('\\') ? (existsSync(bin) ? path.resolve(bin) : null) : resolveOnPath(bin)
  return file ? { file, args } : null
}

/** Candidate launchers in priority order: preferred, then the built-in fallbacks. */
function candidates(editor: AppPreferences['editor']): Array<{ file: string; args: string[]; name: string }> {
  const order: Array<'cursor' | 'code' | 'custom'> =
    editor.preferred === 'custom'
      ? ['custom', 'cursor', 'code']
      : editor.preferred === 'code'
        ? ['code', 'cursor']
        : ['cursor', 'code']
  const found: Array<{ file: string; args: string[]; name: string }> = []
  for (const name of order) {
    if (name === 'custom') {
      const c = resolveCustom(editor.custom)
      if (c) found.push({ ...c, name: 'custom editor' })
    } else {
      const file = resolveOnPath(name)
      if (file) found.push({ file, args: [], name })
    }
  }
  return found
}

/** Open a folder in the user's editor. `dir` must already be validated by the caller. */
export function openInEditor(dir: string, editor: AppPreferences['editor']): string {
  const [first] = candidates(editor)
  if (!first) {
    throw new Error('No editor found. Install the `cursor` or `code` command, or set a custom editor in Settings.')
  }
  launchDetached(first.file, [...first.args, dir])
  return first.name
}
