import { PNG } from 'pngjs'

/**
 * The app icon: Brook's skull face on a 32x32 pixel grid (afro, hollow eyes, big grin), scaled with
 * nearest-neighbour so every square pixel stays sharp. Pure data in, PNG/ICO bytes out; `pnpm art` writes
 * assets/icon/icon.png (window icon) and assets/icon/icon.ico (installer and shortcuts).
 */

const N = 32

type RGBA = readonly [number, number, number, number]
const hex = (s: string, a = 255): RGBA => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), a]

const C = {
  clear: hex('#000000', 0),
  seaDark: hex('#0e2238'),
  sea: hex('#1d4468'),
  seaLight: hex('#2f6a94'),
  ink: hex('#120d18'),
  afro: hex('#271c33'),
  afroLight: hex('#43345a'),
  afroHi: hex('#5f4c7d'),
  bone: hex('#f6f0dc'),
  boneShade: hex('#d2c9ad'),
  boneDark: hex('#a79d84'),
  socket: hex('#0a070d'),
  glint: hex('#7fd0f0'),
  gold: hex('#f0b82c'),
  goldDark: hex('#b57f14')
}

type Grid = RGBA[]

function blank(): Grid {
  return new Array<RGBA>(N * N).fill(C.clear)
}
const put = (g: Grid, x: number, y: number, c: RGBA): void => {
  if (x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = c
}
const get = (g: Grid, x: number, y: number): RGBA => (x < 0 || y < 0 || x >= N || y >= N ? C.clear : g[y * N + x])
const isClear = (c: RGBA): boolean => c[3] === 0

/** Pixels whose centre is inside the ellipse. */
function fillEllipse(g: Grid, cx: number, cy: number, rx: number, ry: number, c: RGBA | ((x: number, y: number) => RGBA | null)): void {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      const col = typeof c === 'function' ? c(x, y) : c
      if (col) put(g, x, y, col)
    }
  }
}

/** The 32x32 icon as RGBA pixels. */
export function appIconPixels(): Grid {
  const g = blank()

  // ocean-blue rounded tile, lighter at the top, with a dark rim
  const radius = 6
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = Math.max(radius - 0.5 - x, x - (N - 1 - radius + 0.5), 0)
      const dy = Math.max(radius - 0.5 - y, y - (N - 1 - radius + 0.5), 0)
      if (dx * dx + dy * dy > radius * radius) continue
      const band = y < 6 ? C.seaLight : y < 22 ? C.sea : C.seaDark
      put(g, x, y, (x + y) % 2 === 0 && (y === 6 || y === 22) ? (y === 6 ? C.sea : C.seaDark) : band)
    }
  }
  // rim: any tile pixel touching the corner cut or the edge
  const tile = g.map((c) => !isClear(c))
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!tile[y * N + x]) continue
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => x + ox < 0 || y + oy < 0 || x + ox >= N || y + oy >= N || !tile[(y + oy) * N + x + ox])
      if (edge) put(g, x, y, C.ink)
    }
  }

  // the afro: a huge round cloud of black hair with a lit top-left
  fillEllipse(g, 16, 13.5, 13, 12.5, (x, y) => {
    const lx = (x + 0.5 - 16) / 13
    const ly = (y + 0.5 - 13.5) / 12.5
    const lit = -lx * 0.7 - ly * 0.7
    // a few lit curls at the top-left, scattered rather than one hard band
    if (lit > 0.93 && (x + y) % 2 === 0) return C.afroHi
    if (lit > 0.88 && (x + y) % 2 === 0) return C.afroLight
    if (lit > 0.8 && (x * 3 + y * 5) % 5 === 0) return C.afroLight
    return C.afro
  })
  // bumpy hair edge: a few pixels that make it read as hair, not a disc
  for (const [x, y] of [[3, 7], [2, 11], [4, 4], [28, 8], [29, 12], [27, 5], [8, 1], [15, 0], [22, 1]]) put(g, x, y, C.afro)

  // face: a long skull, clipped by a rounded hairline so the afro frames it
  fillEllipse(g, 16, 18.5, 8.6, 10.2, (x, y) => {
    const hairline = 12.5 + ((x + 0.5 - 16) * (x + 0.5 - 16)) * 0.045
    if (y < hairline) return null
    const nx = (x + 0.5 - 16) / 8.6
    if (nx > 0.55) return C.boneShade // right side in shade
    if (nx > 0.82) return C.boneDark
    return C.bone
  })
  // jaw taper: trim the bottom corners so the chin is narrower than the cheekbones
  for (const [x, y] of [[8, 25], [9, 26], [23, 25], [22, 26], [8, 24], [23, 24]]) put(g, x, y, C.afro)

  // eye sockets (hollow, slightly slanted) with a tiny blue glint
  fillEllipse(g, 12.2, 17.4, 2.7, 3.3, C.socket)
  fillEllipse(g, 19.8, 17.4, 2.7, 3.3, C.socket)
  put(g, 11, 16, C.glint)
  put(g, 19, 16, C.glint)
  // nose hole
  put(g, 15, 21, C.socket)
  put(g, 16, 21, C.socket)
  put(g, 15, 22, C.socket)
  put(g, 16, 22, C.socket)

  // the grin: a wide black mouth with a row of teeth
  for (let x = 9; x <= 22; x++) {
    put(g, x, 24, C.socket)
    put(g, x, 28, x >= 11 && x <= 20 ? C.socket : get(g, x, 28))
  }
  for (let y = 25; y <= 27; y++) {
    for (let x = 9; x <= 22; x++) put(g, x, y, C.socket)
  }
  for (let x = 10; x <= 21; x++) {
    const sep = (x - 10) % 2 === 1
    put(g, x, 25, sep ? C.boneDark : C.bone)
    put(g, x, 26, sep ? C.boneDark : C.bone)
  }
  put(g, 9, 24, get(g, 9, 24))

  // dark outline around the hair and face where they touch the tile
  const solid = g.map((c) => !isClear(c))
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const c = get(g, x, y)
      if (c !== C.afro && c !== C.afroLight && c !== C.afroHi) continue
      const touchesTile = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
        const n = get(g, x + ox, y + oy)
        return n === C.sea || n === C.seaLight || n === C.seaDark
      })
      if (touchesTile) put(g, x, y, C.ink)
    }
  }
  void solid

  // chin outline and a gold music note in the corner (Soul King)
  for (let x = 10; x <= 21; x++) if (get(g, x, 29) === C.sea || get(g, x, 29) === C.seaDark) put(g, x, 29, C.ink)
  for (const [x, y] of [[25, 24], [25, 25], [25, 26], [25, 27], [26, 24], [27, 25]]) put(g, x, y, C.gold)
  put(g, 24, 27, C.gold)
  put(g, 24, 28, C.goldDark)
  put(g, 25, 28, C.goldDark)
  return g
}

/** The icon scaled up by an integer factor (nearest neighbour), as RGBA bytes. */
function scaled(size: number): Buffer {
  const g = appIconPixels()
  const f = size / N
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = g[Math.floor(y / f) * N + Math.floor(x / f)]
      const i = (y * size + x) * 4
      buf[i] = c[0]
      buf[i + 1] = c[1]
      buf[i + 2] = c[2]
      buf[i + 3] = c[3]
    }
  }
  return buf
}

/** A PNG of the icon at `size` px (a multiple of 32). */
export function appIconPng(size: number): Buffer {
  const png = new PNG({ width: size, height: size })
  scaled(size).copy(png.data)
  return PNG.sync.write(png)
}

/** A Windows .ico with PNG-compressed 32, 64, 128 and 256px images (all integer multiples of the pixel grid). */
export function appIconIco(): Buffer {
  const sizes = [32, 64, 128, 256]
  const images = sizes.map((s) => appIconPng(s))
  const head = Buffer.alloc(6 + 16 * sizes.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(sizes.length, 4)
  let offset = head.length
  sizes.forEach((s, i) => {
    const o = 6 + i * 16
    head[o] = s >= 256 ? 0 : s
    head[o + 1] = s >= 256 ? 0 : s
    head[o + 2] = 0
    head[o + 3] = 0
    head.writeUInt16LE(1, o + 4)
    head.writeUInt16LE(32, o + 6)
    head.writeUInt32LE(images[i].length, o + 8)
    head.writeUInt32LE(offset, o + 12)
    offset += images[i].length
  })
  return Buffer.concat([head, ...images])
}
