// Standalone ship-scene lab: bundles the real ShipScene with esbuild and serves it (plus assets/ship) over http, so the
// native-resolution scene can be reviewed in any browser without launching Electron.
// Usage: node scripts/ship-lab.mjs [--port=5599]   then open http://localhost:5599/?night=0&zoom=2&room=galley
// Query: night=0|1, zoom=<int>, room=<id> (zoomed in on a room), hover=<id>, crew=1 (all ten crew on duty, idle), work=1.
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number((process.argv.find((a) => a.startsWith('--port=')) ?? '--port=5599').slice(7))

const entry = `
import { loadShipAtlases } from '/src/ship/atlas.ts'
import { ShipScene } from '/src/ship/ship-scene.ts'
import { WORLD_W, WORLD_H, roomDef, roomRect } from '/src/ship/room-defs.ts'

const q = new URLSearchParams(location.search)
const IDS = ['luffy', 'nami', 'robin', 'franky', 'usopp', 'chopper', 'zoro', 'sanji', 'jinbe', 'brook']
const HOME = { luffy: 'figurehead', nami: 'map_room', robin: 'library', franky: 'engine_room', usopp: 'factory', chopper: 'infirmary', zoro: 'crows_nest', sanji: 'galley', jinbe: 'helm', brook: 'lawn' }
const atlases = await loadShipAtlases()
const scene = new ShipScene(atlases)
const canvas = document.getElementById('c')
const zoom = Number(q.get('zoom') ?? 1)
const room = q.get('room')
let view = { x: 0, y: 0, w: WORLD_W, h: WORLD_H }
if (room) {
  const r = roomRect(roomDef(room))
  const w = Math.min(WORLD_W, Math.floor(r.w + 48)), h = Math.min(WORLD_H, Math.floor(r.h + 48))
  view = { x: Math.max(0, Math.min(WORLD_W - w, r.x - 24)), y: Math.max(0, Math.min(WORLD_H - h, r.y - 24)), w, h }
}
const crew = q.get('crew') === '0' ? [] : IDS.map((id) => ({ id, name: id, status: q.get('work') ? 'working' : 'idle', selected: false, roomId: HOME[id] }))
const world = document.createElement('canvas')
world.width = WORLD_W
world.height = WORLD_H
const wctx = world.getContext('2d')
scene.draw(wctx, { night: q.get('night') === '1', timeMs: Number(q.get('t') ?? 4000), hoverRoom: q.get('hover'), crew, still: true })
canvas.width = view.w * zoom
canvas.height = view.h * zoom
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false
ctx.drawImage(world, view.x, view.y, view.w, view.h, 0, 0, canvas.width, canvas.height)
window.__ready = true
`

const bundle = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2022',
  alias: { '@shared': path.join(root, 'shared'), '@': path.join(root, 'src') },
  plugins: [
    {
      name: 'root-abs',
      setup(b) {
        b.onResolve({ filter: /^\/src\// }, (a) => ({ path: path.join(root, a.path) }))
      }
    }
  ],
  logLevel: 'error'
})
const js = bundle.outputFiles[0].text

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222"><canvas id="c" style="image-rendering:pixelated;display:block"></canvas>
<script>globalThis.__GF_SHIP_BASE = '/ship/'</script><script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</script>`

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(html)
    return
  }
  if (url.pathname.startsWith('/ship/')) {
    const file = path.join(root, 'assets', 'ship', path.basename(url.pathname))
    try {
      const data = await readFile(file)
      res.writeHead(200, { 'content-type': file.endsWith('.png') ? 'image/png' : 'application/json', 'cache-control': 'no-store' })
      res.end(data)
    } catch {
      res.writeHead(404).end()
    }
    return
  }
  res.writeHead(404).end()
}).listen(port, () => console.log(`ship lab on http://localhost:${port}/`))
