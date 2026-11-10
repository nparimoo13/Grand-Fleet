/**
 * The ship's structural shell as pixel masks: where every room is, how thick the beams around it are, which
 * pixels are open cavity between rooms, where the hull's outer planks are, and where the doorways and hatches are
 * cut. Pure (no DOM); the art build paints these masks into the hull sprite and the runtime scene clips each
 * room's interior with the same room masks, so the two can never disagree.
 */

import { CONNECTORS } from './connectors'
import {
  Mask,
  dilate,
  fillPolygon,
  fillRect,
  ringOf,
  roundedRectMask,
  spline,
  union,
  type Ring
} from './geometry'
import { HULL_CURVE, SLABS, SPACES, STERN_POOP, WORLD_H, WORLD_W, type RoomDef } from './room-defs'

/** Gap between a room's frame and the cavity edge: the beams between neighbouring rooms fill this. */
export const CAVITY_PAD = 8
/** How far the castle's hull planks stand off the captain's room. */
export const CASTLE_PAD = 14

const maskCache = new Map<string, Mask>()

/** A space's pixel mask in room-local coordinates (rect-sized): its rounded-rect shape. */
export function roomMask(r: RoomDef): Mask {
  const hit = maskCache.get(r.id)
  if (hit) return hit
  const m = roundedRectMask(r.rect.w, r.rect.h, r.radii)
  maskCache.set(r.id, m)
  return m
}

export interface Shell {
  /** Every pixel inside an enclosed room or hall. */
  inner: Mask
  /** Frame (beam) pixels inside the rooms: depth from the room edge and whether that face catches the light. */
  ring: Ring
  /** Rooms' interiors minus their frames: the pixels the hull sprite leaves transparent. */
  hole: Mask
  /** Rooms + the beams around and between them. */
  cavity: Mask
  /** The whole ship's silhouette: hull planks, cavity, castle, poop. */
  silhouette: Mask
  /** 1 = shaft, 2 = doorway: cut-outs through the beams. */
  opening: Uint8Array
  /** Doorway/hatch rectangles' own shape masks, for the arched tops. */
  openingMask: Mask
}

let cached: Shell | null = null

/** Builds the shell once (a fraction of a second); shared by the art build, the scene and the tests. */
export function buildShell(): Shell {
  if (cached) return cached
  const W = WORLD_W
  const H = WORLD_H
  const inner = new Mask(W, H)
  const ring: Ring = { depth: new Uint8Array(W * H), lit: new Uint8Array(W * H) }
  const captain = new Mask(W, H)
  for (const r of SPACES) {
    if (r.open) continue
    const rm = roomMask(r)
    inner.add(rm, r.rect.x, r.rect.y)
    if (r.id === 'captains_room') captain.add(rm, r.rect.x, r.rect.y)
    const rr = ringOf(rm)
    for (let y = 0; y < rm.h; y++) {
      for (let x = 0; x < rm.w; x++) {
        const d = rr.depth[y * rm.w + x]
        if (!d) continue
        const i = (r.rect.y + y) * W + r.rect.x + x
        ring.depth[i] = d
        ring.lit[i] = rr.lit[y * rm.w + x]
      }
    }
  }

  const openingMask = new Mask(W, H)
  const opening = new Uint8Array(W * H)
  for (const c of CONNECTORS) {
    const o = c.opening
    if (!o) continue
    const m = roundedRectMask(o.rect.w, o.rect.h, o.radii)
    const style = o.style === 'door' ? 2 : 1
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (!m.data[y * m.w + x]) continue
        const wx = o.rect.x + x
        const wy = o.rect.y + y
        if (wx < 0 || wy < 0 || wx >= W || wy >= H) continue
        opening[wy * W + wx] = style
        openingMask.set(wx, wy)
      }
    }
  }

  const slabs = new Mask(W, H)
  for (const s of SLABS) fillRect(slabs, s.x, s.y, s.w, s.h)

  const hole = new Mask(W, H)
  for (let i = 0; i < inner.data.length; i++) if (inner.data[i] && !ring.depth[i]) hole.data[i] = 1

  const seed = union(union(inner, slabs), openingMask)
  const cavity = union(dilate(seed, CAVITY_PAD), slabs)

  const silhouette = new Mask(W, H)
  fillPolygon(silhouette, spline(HULL_CURVE, 10))
  fillPolygon(silhouette, spline(STERN_POOP, 8, true))
  const castle = dilate(captain, CASTLE_PAD)
  for (let i = 0; i < silhouette.data.length; i++) if (castle.data[i] || cavity.data[i]) silhouette.data[i] = 1

  cached = { inner, ring, hole, cavity, silhouette, opening, openingMask }
  return cached
}
