import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HookServer } from './hook-server'

describe('HookServer', () => {
  let server: HookServer

  beforeEach(async () => {
    server = new HookServer()
    await server.start()
  })
  afterEach(async () => {
    await server.stop()
  })

  const post = (url: string, body: unknown = {}, init: RequestInit = {}): Promise<Response> =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...init })

  it('binds loopback on a random port and builds token URLs', () => {
    expect(server.port).toBeGreaterThan(0)
    expect(server.urlFor('zoro', 'hook')).toBe(`http://127.0.0.1:${server.port}/${server.token}/zoro/hook`)
  })

  it('delivers the JSON body to the registered handler and replies 200 empty by default', async () => {
    let got: unknown
    server.register('zoro', (req) => {
      got = { agentId: req.agentId, kind: req.kind, body: req.body }
    })
    const res = await post(server.urlFor('zoro', 'hook'), { hook_event_name: 'Stop' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect(got).toEqual({ agentId: 'zoro', kind: 'hook', body: { hook_event_name: 'Stop' } })
  })

  it('replies with JSON or text when the handler returns them', async () => {
    server.register('a', () => ({ json: { ok: true } }))
    server.register('b', () => ({ text: 'status line' }))
    const a = await post(server.urlFor('a', 'hook'))
    expect(a.headers.get('content-type')).toContain('application/json')
    expect(await a.json()).toEqual({ ok: true })
    expect(await (await post(server.urlFor('b', 'status'))).text()).toBe('status line')
  })

  it('rejects a wrong token with 403 and never calls the handler', async () => {
    let called = false
    server.register('zoro', () => {
      called = true
    })
    const res = await post(`http://127.0.0.1:${server.port}/${'0'.repeat(48)}/zoro/hook`)
    expect(res.status).toBe(403)
    expect(called).toBe(false)
  })

  it('rejects non-POST, unknown agents, unknown kinds and bad JSON', async () => {
    server.register('zoro', () => undefined)
    expect((await fetch(server.urlFor('zoro', 'hook'))).status).toBe(405)
    expect((await post(server.urlFor('ghost', 'hook'))).status).toBe(404)
    expect((await post(`http://127.0.0.1:${server.port}/${server.token}/zoro/other`)).status).toBe(404)
    const bad = await fetch(server.urlFor('zoro', 'hook'), { method: 'POST', body: '{nope' })
    expect(bad.status).toBe(400)
    const arr = await fetch(server.urlFor('zoro', 'hook'), { method: 'POST', body: '[1]' })
    expect(arr.status).toBe(400)
  })

  it('turns a throwing handler into a 500, not a crash', async () => {
    server.register('zoro', () => {
      throw new Error('boom')
    })
    expect((await post(server.urlFor('zoro', 'hook'))).status).toBe(500)
    server.register('zoro', () => undefined)
    expect((await post(server.urlFor('zoro', 'hook'))).status).toBe(200)
  })

  it('holds a request open until the handler resolves', async () => {
    let release!: () => void
    server.register('zoro', () => new Promise<{ json: unknown }>((r) => (release = () => r({ json: { decision: 'allow' } }))))
    const pending = post(server.urlFor('zoro', 'hook'))
    await new Promise((r) => setTimeout(r, 50))
    release()
    expect(await (await pending).json()).toEqual({ decision: 'allow' })
  })

  it('aborts the handler signal when the caller hangs up', async () => {
    let signal!: AbortSignal
    let started!: () => void
    const startedP = new Promise<void>((r) => (started = r))
    server.register('zoro', (req) => {
      signal = req.signal
      started()
      return new Promise(() => undefined)
    })
    const ctl = new AbortController()
    const p = post(server.urlFor('zoro', 'hook'), {}, { signal: ctl.signal }).catch(() => undefined)
    await startedP
    expect(signal.aborted).toBe(false)
    ctl.abort()
    await p
    await new Promise((r) => setTimeout(r, 100))
    expect(signal.aborted).toBe(true)
  })

  it('unregister stops delivery', async () => {
    const off = server.register('zoro', () => undefined)
    off()
    expect((await post(server.urlFor('zoro', 'hook'))).status).toBe(404)
  })

  it('refuses an oversized body', async () => {
    server.register('zoro', () => undefined)
    const res = await fetch(server.urlFor('zoro', 'hook'), { method: 'POST', body: 'x'.repeat(3 * 1024 * 1024) }).catch(() => null)
    expect(res === null || res.status === 413).toBe(true)
  })
})
