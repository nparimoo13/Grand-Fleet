/** Generated art manifest (written by `pnpm art` next to ship assets). */

export interface ArtSheetEntry {
  id: string
  label: string
  /** Path relative to `assets/crews/<crewId>/`. */
  png: string
  /** Aseprite-format frame metadata; omitted for static strips. */
  json?: string
  w: number
  h: number
}

export interface ShipArtManifest {
  version: 1
  /** Matches ship.json tileSize. */
  tileSize: number
  generatedAt: string
  sheets: ArtSheetEntry[]
}

/** Subset of Aseprite JSON we emit and will load in Phase 5. */
export interface AsepriteFrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AsepriteFrameTag {
  name: string
  from: number
  to: number
  direction: 'forward'
}

export interface AsepriteDocument {
  frames: Record<
    string,
    {
      frame: AsepriteFrameRect
      rotated: false
      trimmed: false
      spriteSourceSize: AsepriteFrameRect
      sourceSize: { w: number; h: number }
      duration: number
    }
  >
  meta: {
    app: string
    version: string
    format: 'RGBA8888'
    size: { w: number; h: number }
    scale: '1'
    frameTags?: AsepriteFrameTag[]
  }
}
