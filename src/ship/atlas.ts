/** Loads the ship sprite sheets (assets/ship/*.png + Aseprite-style .json) served over grandfleet://. */

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Atlas {
  /** The loaded sheet, or a light-shifted copy of it drawn into a canvas. */
  image: HTMLImageElement | HTMLCanvasElement
  frames: ReadonlyMap<string, FrameRect>
  /** Aseprite frame tags expanded to frame names, e.g. sanji_walk -> [sanji_walk_0, ...]. */
  tags: ReadonlyMap<string, readonly string[]>
  /** Named overlay positions relative to a parent sprite's top-left (props sheet only). */
  anchors: ReadonlyMap<string, { parent: string; x: number; y: number }>
  /** Props that stand on the floor and get a floor shadow (props sheet only). */
  floorProps: ReadonlySet<string>
}

export type AtlasId = 'tiles' | 'props' | 'characters' | 'ui' | 'world'
export type ShipAtlases = Record<AtlasId, Atlas>

interface AtlasJson {
  frames: Record<string, { frame: FrameRect }>
  meta: {
    frameTags?: Array<{ name: string; from: number; to: number }>
    anchors?: Record<string, { parent: string; x: number; y: number }>
    floorProps?: string[]
  }
}

/** `globalThis.__GF_SHIP_BASE` lets scripts/ship-lab.mjs serve the sheets over http instead of the app protocol. */
export const shipAssetUrl = (file: string): string => `${(globalThis as { __GF_SHIP_BASE?: string }).__GF_SHIP_BASE ?? 'grandfleet://ship/'}${file}`

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`could not load ${url}`))
    img.src = url
  })
}

export function parseAtlas(image: HTMLImageElement, json: AtlasJson): Atlas {
  const names = Object.keys(json.frames).map((k) => k.replace(/\.png$/, ''))
  const frames = new Map<string, FrameRect>()
  Object.entries(json.frames).forEach(([k, v]) => frames.set(k.replace(/\.png$/, ''), v.frame))
  const tags = new Map<string, readonly string[]>()
  for (const t of json.meta.frameTags ?? []) tags.set(t.name, names.slice(t.from, t.to + 1))
  const anchors = new Map(Object.entries(json.meta.anchors ?? {}))
  return { image, frames, tags, anchors, floorProps: new Set(json.meta.floorProps ?? []) }
}

export function anchor(atlas: Atlas, name: string): { parent: string; x: number; y: number } {
  const a = atlas.anchors.get(name)
  if (!a) throw new Error(`unknown anchor "${name}"`)
  return a
}

async function loadAtlas(id: AtlasId): Promise<Atlas> {
  const [image, res] = await Promise.all([loadImage(shipAssetUrl(`${id}.png`)), fetch(shipAssetUrl(`${id}.json`))])
  if (!res.ok) throw new Error(`could not load ${id}.json`)
  return parseAtlas(image, (await res.json()) as AtlasJson)
}

let cached: Promise<ShipAtlases> | null = null

export function loadShipAtlases(): Promise<ShipAtlases> {
  cached ??= Promise.all([loadAtlas('tiles'), loadAtlas('props'), loadAtlas('characters'), loadAtlas('ui'), loadAtlas('world')]).then(
    ([tiles, props, characters, ui, world]) => ({ tiles, props, characters, ui, world }),
    (err) => {
      cached = null
      throw err
    }
  )
  return cached
}

export type Ctx = CanvasRenderingContext2D

/** Draw one frame at an integer position. Throws on unknown names so art/code drift is caught immediately. */
export function drawFrame(ctx: Ctx, atlas: Atlas, name: string, x: number, y: number, flipX = false): FrameRect {
  const f = atlas.frames.get(name)
  if (!f) throw new Error(`unknown sprite "${name}"`)
  const px = Math.round(x)
  const py = Math.round(y)
  if (flipX) {
    ctx.save()
    ctx.translate(px + f.w, py)
    ctx.scale(-1, 1)
    ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h)
    ctx.restore()
  } else {
    ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, px, py, f.w, f.h)
  }
  return f
}

/** Tile a frame across a region (clipped to the region). */
export function tileFrame(ctx: Ctx, atlas: Atlas, name: string, x: number, y: number, w: number, h: number): void {
  const f = atlas.frames.get(name)
  if (!f) throw new Error(`unknown sprite "${name}"`)
  for (let ty = y; ty < y + h; ty += f.h) {
    for (let tx = x; tx < x + w; tx += f.w) {
      const dw = Math.min(f.w, x + w - tx)
      const dh = Math.min(f.h, y + h - ty)
      ctx.drawImage(atlas.image, f.x, f.y, dw, dh, tx, ty, dw, dh)
    }
  }
}

