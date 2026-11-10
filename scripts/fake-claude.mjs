#!/usr/bin/env node
// A stand-in for the `claude` CLI, used only by the smoke test. It speaks the same protocol the
// real one does (HTTP/command hooks and a status-line POST to the URLs in --settings) so the
// whole Grand Fleet pipeline runs deterministically and without spending tokens.
//
// Interactive behaviour (type a line and press Enter):
//   - a line containing "write"  -> asks permission for a Write tool, prints RESULT: allow|deny
//   - anything else              -> prints "echo: <line>"
import { appendFileSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const log = (line) => {
  try {
    appendFileSync(path.join(os.tmpdir(), 'gf-fake-claude.log'), `${new Date().toISOString()} pid=${process.pid} ${line}\n`)
  } catch {
    /* ignore */
  }
}

if (args[0] === '--version') {
  console.log('2.1.318 (Claude Code) [fake]')
  process.exit(0)
}
if (args[0] === 'auth' && args[1] === 'status') {
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'fake', apiProvider: 'fake' }))
  process.exit(0)
}

const arg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const settings = JSON.parse(readFileSync(arg('--settings'), 'utf8'))
const sessionId = arg('--resume') ?? arg('--session-id') ?? 'fake-session'
log(`start args=${JSON.stringify(args.filter((a) => !a.includes('settings.json')))} cwd=${process.cwd()}`)

const hookUrl = settings.hooks.PermissionRequest[0].hooks[0].url
const statusUrl = /"(http:[^"]+)"/.exec(settings.statusLine.command)[1]
if (!/\/hook$/.test(hookUrl) || !/\/status$/.test(statusUrl)) throw new Error('unexpected settings shape')
if (!/^curl(\.exe)? /.test(settings.hooks.SessionStart[0].hooks[0].command)) throw new Error('SessionStart must be a curl command hook')

const base = { session_id: sessionId, cwd: process.cwd() }
const post = async (url, body) => {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const text = await res.text()
    return text ? JSON.parse(text) : {}
  } catch (err) {
    log(`post failed ${err}`)
    return null
  }
}
const hook = (event, extra = {}) => post(hookUrl, { ...base, hook_event_name: event, ...extra })
const status = (pct, cost) =>
  post(statusUrl, {
    ...base,
    model: { id: 'fake-1', display_name: 'Fake 1' },
    context_window: { used_percentage: pct, context_window_size: 200000, total_input_tokens: pct * 2000, total_output_tokens: 10 },
    cost: { total_cost_usd: cost }
  })

const out = (s) => process.stdout.write(s)
out('\x1b[1;33mFAKE CLAUDE ready\x1b[0m (hooks + status line wired)\r\n> ')

await hook('SessionStart', { source: process.argv.includes('--resume') ? 'resume' : 'startup' })
await status(12, 0.0123)

let buffer = ''
let busy = false
const handle = async (line) => {
  busy = true
  log(`line ${JSON.stringify(line)}`)
  await hook('UserPromptSubmit', { prompt: line })
  if (/write/i.test(line)) {
    const input = { file_path: 'notes.txt', content: 'ahoy' }
    out('\r\nAsking to write notes.txt...\r\n')
    await hook('PreToolUse', { tool_name: 'Write', tool_input: input })
    const res = await hook('PermissionRequest', { tool_name: 'Write', tool_input: input })
    const behavior = res?.hookSpecificOutput?.decision?.behavior ?? 'none'
    out(`RESULT: ${behavior}\r\n`)
    if (behavior === 'allow') await hook('PostToolUse', { tool_name: 'Write', tool_input: input })
    else await hook('PostToolUseFailure', { tool_name: 'Write', tool_input: input })
  } else {
    out(`\r\necho: ${line}\r\n`)
  }
  await status(18, 0.0456)
  await hook('Stop', { last_assistant_message: 'All done, captain.' })
  out('> ')
  busy = false
}

if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  for (const ch of chunk.replace(/\x1b\[20[01]~/g, '')) {
    if (ch === '\r' || ch === '\n') {
      const line = buffer.trim()
      buffer = ''
      if (line && !busy) void handle(line)
    } else if (ch === '\x7f') {
      buffer = buffer.slice(0, -1)
    } else if (ch >= ' ') {
      buffer += ch
      out(ch)
    }
  }
})
process.on('SIGTERM', () => process.exit(0))
