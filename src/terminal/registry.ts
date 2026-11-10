import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { AgentOutputChunk } from '@shared/ipc'
import { errorMessage, invoke } from '@/lib/api'

/**
 * One long-lived xterm per agent, keyed by agent id. Terminals keep their scrollback
 * while the user switches agents or tabs; the host element is simply moved in and out
 * of the visible pane. On creation a terminal replays the main process's ring buffer;
 * `bufferEnd` (a cumulative character offset) lets it drop live chunks the replay already covered.
 */

interface Entry {
  agentId: string
  term: Terminal
  fit: FitAddon
  host: HTMLDivElement
  ready: boolean
  bufferEnd: number
  queue: AgentOutputChunk[]
  observer: ResizeObserver | null
}

const entries = new Map<string, Entry>()
let fontSize = 13
let unsubscribe: (() => void) | null = null

const THEME = {
  background: '#1a120c',
  foreground: '#e6d5b2',
  cursor: '#e0b84a',
  cursorAccent: '#1a120c',
  selectionBackground: '#5c3d2e',
  black: '#2e1d14',
  red: '#e0645a',
  green: '#8fbf6a',
  yellow: '#e0b84a',
  blue: '#6fa3d6',
  magenta: '#c58bd0',
  cyan: '#6fc3c3',
  white: '#e6d5b2',
  brightBlack: '#7a6a58',
  brightRed: '#f08a80',
  brightGreen: '#a9d68a',
  brightYellow: '#f0d27a',
  brightBlue: '#8fbbe6',
  brightMagenta: '#d8a6e0',
  brightCyan: '#8fd6d6',
  brightWhite: '#fff6dc'
}

const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

function write(agentId: string, data: string): void {
  void invoke('agents:write', { agentId, data }).catch(() => undefined)
}

function create(agentId: string): Entry {
  const host = document.createElement('div')
  host.className = 'terminal-host'
  const term = new Terminal({
    fontFamily: "'IBM Plex Mono', 'Cascadia Mono', Consolas, monospace",
    fontSize,
    lineHeight: 1.15,
    cursorBlink: true,
    scrollback: 10_000,
    theme: THEME,
    allowProposedApi: false,
    // Claude Code's TUI redraws heavily; tell xterm it is talking to ConPTY so reflow behaves.
    ...(isWindows ? { windowsPty: { backend: 'conpty' as const } } : {})
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(host)

  const entry: Entry = { agentId, term, fit, host, ready: false, bufferEnd: 0, queue: [], observer: null }

  term.onData((data) => write(agentId, data))
  term.onResize(({ cols, rows }) => {
    void invoke('agents:resize', { agentId, cols, rows }).catch(() => undefined)
  })
  // Ctrl+C copies when text is selected; otherwise it is the interrupt keystroke Claude Code expects.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type === 'keydown' && e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c' && term.hasSelection()) {
      void navigator.clipboard.writeText(term.getSelection()).catch(() => undefined)
      term.clearSelection()
      return false
    }
    return true
  })

  void replay(entry)
  return entry
}

async function replay(entry: Entry): Promise<void> {
  try {
    const buf = await invoke('agents:terminalBuffer', { agentId: entry.agentId })
    if (buf.data) entry.term.write(buf.data)
    entry.bufferEnd = buf.end
  } catch (err) {
    entry.term.write(`\r\n[Grand Fleet] Could not load history: ${errorMessage(err)}\r\n`)
  }
  entry.ready = true
  for (const chunk of entry.queue.splice(0)) deliver(entry, chunk)
}

function deliver(entry: Entry, chunk: AgentOutputChunk): void {
  if (chunk.end <= entry.bufferEnd) return // already part of the replay
  entry.term.write(chunk.data)
}

/** Subscribe to live output once for the whole app. */
export function startTerminalOutput(): () => void {
  if (unsubscribe) return unsubscribe
  const off = window.grandFleet.on('agent:output', (chunk) => {
    const entry = entries.get(chunk.agentId)
    if (!entry) return // no terminal yet; it will replay from the main buffer when created
    if (!entry.ready) entry.queue.push(chunk)
    else deliver(entry, chunk)
  })
  unsubscribe = () => {
    off()
    unsubscribe = null
  }
  return unsubscribe
}

/** Show an agent's terminal inside `container`. Returns a detach function. */
export function attachTerminal(agentId: string, container: HTMLElement): () => void {
  const entry = entries.get(agentId) ?? create(agentId)
  entries.set(agentId, entry)
  container.appendChild(entry.host)
  entry.term.options.fontSize = fontSize

  const refit = (): void => {
    if (container.clientWidth < 20 || container.clientHeight < 20) return
    try {
      entry.fit.fit()
    } catch {
      // not laid out yet
    }
  }
  entry.observer = new ResizeObserver(refit)
  entry.observer.observe(container)
  requestAnimationFrame(() => {
    refit()
    entry.term.focus()
  })

  return () => {
    entry.observer?.disconnect()
    entry.observer = null
    if (entry.host.parentElement === container) container.removeChild(entry.host)
  }
}

export function focusTerminal(agentId: string): void {
  entries.get(agentId)?.term.focus()
}

export function setTerminalFontSize(size: number): void {
  fontSize = size
  for (const e of entries.values()) {
    e.term.options.fontSize = size
    try {
      e.fit.fit()
    } catch {
      // detached terminals fit when re-attached
    }
  }
}

/** Free a terminal when its agent stands down or the voyage closes. */
export function disposeTerminal(agentId: string): void {
  const e = entries.get(agentId)
  if (!e) return
  e.observer?.disconnect()
  e.term.dispose()
  e.host.remove()
  entries.delete(agentId)
}

export function disposeAllTerminals(): void {
  for (const id of [...entries.keys()]) disposeTerminal(id)
}
