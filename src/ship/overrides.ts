import { crewAssetUrl } from '@/lib/crew-asset'
import type { Atlas, FrameRect, ShipAtlases } from './atlas'

/**
 * Drop-in character art. A crew folder may hold `characters/<id>/override/<id>.png` + `<id>.json` (an Aseprite
 * sprite-sheet export with frame tags). Each tag in that file replaces the generated animation of the same name
 * (`idle`, `walk`, `work`, ...); tags it does not have keep the generated frames. See ASSETS.md.
 */

interface AseFrame {
  filename?: string
  frame: FrameRect
}

export interface AseJson {
  frames: Record<string, AseFrame> | AseFrame[]
  meta: { frameTags?: Array<{ name: string; from: number; to: number }> }
}

export interface OverrideFrames {
  frames: Map<string, FrameRect>
  /** Tag name as the scene looks it up (`<id>_<tag>`) -> frame names. */
  tags: Map<string, string[]>
}

/**
 * Frames and tags for one override sheet. Frames in a tag are named `<id>_<tag>_<n>`; `yOffset` is where the
 * sheet sits in the merged image. Frames outside every tag are ignored.
 */
export function overrideFrames(id: string, json: AseJson, yOffset: number): OverrideFrames {
  const list = Array.isArray(json.frames) ? json.frames : Object.values(json.frames)
  const frames = new Map<string, FrameRect>()
  const tags = new Map<string, string[]>()
  for (const t of json.meta.frameTags ?? []) {
    const names: string[] = []
    for (let i = t.from; i <= t.to && i < list.length; i++) {
      const f = list[i].frame
      const name = `${id}_${t.name}_${i - t.from}`
      frames.set(name, { x: f.x, y: f.y + yOffset, w: f.w, h: f.h })
      names.push(name)
    }
    if (names.length) tags.set(`${id}_${t.name}`, names)
  }
  return { frames, tags }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`could not load ${url}`))
    img.src = url
  })
}

interface Loaded {
  id: string
  image: HTMLImageElement
  json: AseJson
}

/**
 * Returns the atlases with the override sheets merged into the characters sheet. A sheet that fails to load is
 * skipped with a warning, so a bad drop-in never takes the ship scene down.
 */
export async function applySpriteOverrides(atlases: ShipAtlases, crewId: string, ids: readonly string[]): Promise<ShipAtlases> {
  const loaded: Loaded[] = []
  await Promise.all(
    ids.map(async (id) => {
      const base = `characters/${id}/override/${id}`
      try {
        const [image, res] = await Promise.all([loadImage(crewAssetUrl(crewId, `${base}.png`)), fetch(crewAssetUrl(crewId, `${base}.json`))])
        if (!res.ok) throw new Error(`${base}.json: ${res.status}`)
        loaded.push({ id, image, json: (await res.json()) as AseJson })
      } catch (e) {
        console.warn(`Sprite override for ${id} skipped:`, e instanceof Error ? e.message : e)
      }
    })
  )
  if (loaded.length === 0) return atlases

  const src = atlases.characters
  const width = Math.max(src.image.width, ...loaded.map((l) => l.image.width))
  const height = src.image.height + loaded.reduce((n, l) => n + l.image.height, 0)
  const sheet = document.createElement('canvas')
  sheet.width = width
  sheet.height = height
  const g = sheet.getContext('2d')
  if (!g) return atlases
  g.imageSmoothingEnabled = false
  g.drawImage(src.image, 0, 0)

  const frames = new Map(src.frames)
  const tags = new Map(src.tags)
  let y = src.image.height
  for (const l of loaded) {
    g.drawImage(l.image, 0, y)
    const o = overrideFrames(l.id, l.json, y)
    for (const [name] of o.tags) tags.delete(name)
    for (const [name, r] of o.frames) frames.set(name, r)
    for (const [name, list] of o.tags) tags.set(name, list)
    y += l.image.height
  }
  const characters: Atlas = { ...src, image: sheet, frames, tags }
  return { ...atlases, characters }
}
