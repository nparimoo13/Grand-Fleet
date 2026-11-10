/**
 * Click and hover targets for the rooms, kept apart from the art. The shapes in room-defs.ts decide how a room
 * *looks* (arched, curved to the hull); these rectangles decide what the pointer *hits*. They are written out by
 * hand, deliberately larger than the art where that helps (the airspace over an open deck, the dome over the
 * captain's room, a few pixels of beam around each room), and a test checks that they cover their room's art and
 * never overlap one another.
 */

import type { Rect, RoomId } from './room-defs'

export const HITBOXES: Readonly<Record<RoomId, readonly Rect[]>> = {
  crows_nest: [{ x: 430, y: 22, w: 180, h: 104 }],
  // the bow deck plus the lion head on the stem
  figurehead: [
    { x: 106, y: 168, w: 112, h: 90 },
    { x: 8, y: 138, w: 98, h: 124 }
  ],
  lawn: [{ x: 218, y: 150, w: 294, h: 108 }],
  helm: [{ x: 592, y: 160, w: 120, h: 98 }],
  // the cabin, its dome roof and the steps up to it
  captains_room: [
    { x: 734, y: 58, w: 200, h: 176 },
    { x: 712, y: 214, w: 22, h: 44 }
  ],
  galley: [{ x: 126, y: 260, w: 242, h: 92 }],
  crew_quarters: [{ x: 368, y: 266, w: 206, h: 86 }],
  library: [{ x: 574, y: 262, w: 156, h: 90 }],
  factory: [{ x: 134, y: 352, w: 194, h: 90 }],
  aquarium_lounge: [{ x: 328, y: 352, w: 260, h: 90 }],
  map_room: [{ x: 588, y: 352, w: 150, h: 90 }],
  infirmary: [{ x: 738, y: 352, w: 194, h: 90 }],
  engine_room: [{ x: 230, y: 442, w: 266, h: 90 }],
  storage: [{ x: 496, y: 442, w: 134, h: 90 }],
  weapons: [{ x: 630, y: 442, w: 176, h: 90 }]
}

const inside = (px: number, py: number, r: Rect): boolean => px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h

/** The room whose hitbox contains a world point, or null. */
export function roomAtPoint(x: number, y: number): RoomId | null {
  for (const [id, rects] of Object.entries(HITBOXES) as Array<[RoomId, readonly Rect[]]>) {
    if (rects.some((r) => inside(x, y, r))) return id
  }
  return null
}

/** The rectangle a hover plaque is anchored to: the first (main) hitbox of the room. */
export const primaryHitbox = (id: RoomId): Rect => HITBOXES[id][0]
