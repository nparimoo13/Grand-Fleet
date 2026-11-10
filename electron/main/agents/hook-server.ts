import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { AddressInfo } from 'node:net'

/**
 * Loopback HTTP endpoint that CLI agents call back into (Claude Code HTTP hooks
 * and its status-line command). Security:
 *  - binds 127.0.0.1 only, random port
 *  - the URL path carries a per-launch secret token; anything else is 403
 *  - POST only, bounded body, JSON only
 */

export type HookKind = 'hook' | 'status'

export interface HookRequest {
  agentId: string
  kind: HookKind
  body: Record<string, unknown>
  /** Aborted if the caller hangs up before we answered (e.g. user answered in the terminal). */
  signal: AbortSignal
}

/** Return nothing for an empty 200 (what Claude Code expects for informational hooks). */
export type HookReply = { json: unknown } | { text: string } | void
export type HookHandler = (req: HookRequest) => HookReply | Promise<HookReply>

const MAX_BODY = 2 * 1024 * 1024

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export class HookServer {
  readonly token = randomBytes(24).toString('hex')
  private server: http.Server | null = null
  private handlers = new Map<string, HookHandler>()
  private _port = 0

  get port(): number {
    return this._port
  }

  async start(): Promise<void> {
    if (this.server) return
    const server = http.createServer((req, res) => void this.handle(req, res))
    server.keepAliveTimeout = 5000
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    this._port = (server.address() as AddressInfo).port
    this.server = server
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null
    if (!server) return
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  register(agentId: string, handler: HookHandler): () => void {
    this.handlers.set(agentId, handler)
    return () => {
      if (this.handlers.get(agentId) === handler) this.handlers.delete(agentId)
    }
  }

  urlFor(agentId: string, kind: HookKind): string {
    return `http://127.0.0.1:${this._port}/${this.token}/${encodeURIComponent(agentId)}/${kind}`
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const reply = (status: number, body = '', type = 'text/plain'): void => {
      if (res.headersSent || res.writableEnded) return
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) })
      res.end(body)
    }

    const parts = (req.url ?? '').split('?')[0].split('/').filter(Boolean)
    if (parts.length !== 3 || !safeEqual(parts[0], this.token)) return reply(403, 'forbidden')
    if (req.method !== 'POST') return reply(405, 'method not allowed')

    let agentId: string
    try {
      agentId = decodeURIComponent(parts[1])
    } catch {
      return reply(400, 'bad agent id')
    }
    const kind = parts[2]
    if (kind !== 'hook' && kind !== 'status') return reply(404, 'not found')
    const handler = this.handlers.get(agentId)
    if (!handler) return reply(404, 'unknown agent')

    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += (chunk as Buffer).length
      if (size > MAX_BODY) {
        reply(413, 'too large')
        req.destroy()
        return
      }
      chunks.push(chunk as Buffer)
    }

    let body: Record<string, unknown>
    try {
      const raw = Buffer.concat(chunks).toString('utf8')
      const parsed: unknown = raw.trim() ? JSON.parse(raw) : {}
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
      body = parsed as Record<string, unknown>
    } catch {
      return reply(400, 'invalid json')
    }

    const abort = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) abort.abort()
    })

    try {
      const out = await handler({ agentId, kind, body, signal: abort.signal })
      if (abort.signal.aborted) return
      if (!out) return reply(200)
      if ('json' in out) return reply(200, JSON.stringify(out.json), 'application/json')
      return reply(200, out.text)
    } catch {
      reply(500, 'handler error')
    }
  }
}
