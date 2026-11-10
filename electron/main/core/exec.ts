import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import path from 'node:path'

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export interface RunOptions {
  cwd?: string
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
  /** When true, never rejects on spawn failure; returns code null instead. */
  soft?: boolean
}

const isWin = process.platform === 'win32'

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Find an executable on PATH, honouring PATHEXT on Windows. */
export function resolveOnPath(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const pathVar = env.PATH ?? env.Path ?? ''
  const dirs = pathVar.split(path.delimiter).filter(Boolean)
  const exts = isWin
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
        .split(';')
        .filter(Boolean)
        .map((e) => e.toLowerCase())
    : ['']
  const hasExt = isWin && exts.includes(path.extname(name).toLowerCase())
  for (const dir of dirs) {
    if (hasExt || !isWin) {
      const candidate = path.join(dir, name)
      if (isFile(candidate)) return candidate
    }
    if (isWin && !hasExt) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext)
        if (isFile(candidate)) return candidate
      }
    }
  }
  return null
}

function needsCmdShell(file: string): boolean {
  return isWin && /\.(cmd|bat)$/i.test(file)
}

const UNSAFE_CMD_ARG = /["%\r\n]/
const NEEDS_CMD_QUOTES = /[\s&|<>^()]/

export interface Launch {
  command: string
  args: string[]
  verbatim: boolean
}

/**
 * Build the spawn arguments. Windows .cmd/.bat shims must go through cmd.exe;
 * we refuse characters cmd would interpret inside quotes (`"`, `%`, newlines)
 * and quote only the arguments that need it, so simple batch files see plain values.
 */
export function buildLaunch(file: string, args: string[]): Launch {
  if (!needsCmdShell(file)) return { command: file, args, verbatim: false }
  for (const a of [file, ...args]) {
    if (UNSAFE_CMD_ARG.test(a)) throw new Error(`Refusing to pass unsafe characters to a .cmd launcher: ${a}`)
  }
  const quote = (a: string): string => (a === '' || NEEDS_CMD_QUOTES.test(a) ? `"${a}"` : a)
  return {
    command: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', `"${[file, ...args].map(quote).join(' ')}"`],
    verbatim: true
  }
}

/**
 * Run a file with an argument vector (never a shell string from user input).
 * Windows .cmd/.bat shims are launched through cmd.exe with strict quoting.
 */
export function runFile(file: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let launch: Launch
    try {
      launch = buildLaunch(file, args)
    } catch (err) {
      reject(err)
      return
    }
    const { command, args: finalArgs, verbatim } = launch
    let child
    try {
      child = spawn(command, finalArgs, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        windowsHide: true,
        windowsVerbatimArguments: verbatim,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (err) {
      if (opts.soft) resolve({ code: null, stdout: '', stderr: String(err), timedOut: false })
      else reject(err)
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          child.kill()
        }, opts.timeoutMs)
      : null
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')))
    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      if (opts.soft) resolve({ code: null, stdout, stderr: String(err), timedOut })
      else reject(err)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

/** Spawn without waiting, fully detached (used to launch an editor). */
export function launchDetached(file: string, args: string[]): void {
  const { command, args: finalArgs, verbatim } = buildLaunch(file, args)
  const child = spawn(command, finalArgs, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    windowsVerbatimArguments: verbatim
  })
  child.on('error', () => undefined)
  child.unref()
}
