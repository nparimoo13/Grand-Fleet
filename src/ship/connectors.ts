/**
 * How the spaces of the ship connect: stairs, ladders, doors and open-deck passages.
 *
 * This is the data the art is drawn from (stair and ladder sprites, the doorway and hatch cut-outs baked into the
 * hull) *and* the walk graph crew will use to travel between rooms. Each connector has two landings, one per
 * space, expressed as a world x on that space's floor, so a future walker can path room -> connector -> room.
 * Rooms are the graph's nodes (halls included); `routeBetween` finds the connector chain between any two.
 */

import { SPACES, floorTopY, roomDef, type Opening, type Rect } from './room-defs'

export type ConnectorKind = 'stairs' | 'ladder' | 'door' | 'deck'

export interface Landing {
  /** Space id (a room or the stern hall). */
  space: string
  /** World x where a walker stands to use the connector. The y is the space's floor (`landingY`). */
  x: number
}

export interface Connector {
  id: string
  kind: ConnectorKind
  a: Landing
  b: Landing
  /** Where the stair/ladder sprite is drawn (world px). Stairs climb from the lower-left to the upper-right. */
  art?: Rect & { dir?: 'up-right' | 'up-left' }
  /** Cut through the beams for the passage; painted as a shaft or an arched doorway by the art build. */
  opening?: Opening & { style: 'shaft' | 'door' }
  /** Seconds a walker needs to cross (stairs and ladders are slower than doors). */
  seconds: number
}

/** World y of a walker's feet on a space's floor (matches the crew sprites' standing line). */
export const landingY = (spaceId: string): number => {
  const s = roomDef(spaceId)
  if (!s) throw new Error(`unknown space "${spaceId}"`)
  return floorTopY(s) + 5
}

const door = (id: string, a: string, b: string, x: number, floorSpace: string): Connector => {
  const floor = floorTopY(roomDef(floorSpace) as NonNullable<ReturnType<typeof roomDef>>)
  return {
    id,
    kind: 'door',
    a: { space: a, x: x - 8 },
    b: { space: b, x: x + 8 },
    opening: { id, rect: { x: x - 10, y: floor - 42, w: 20, h: 54 }, radii: [10, 10, 0, 0], style: 'door' },
    seconds: 1
  }
}

const ladder = (id: string, upper: string, lower: string, x: number, opening: Rect): Connector => {
  const top = floorTopY(roomDef(upper) as NonNullable<ReturnType<typeof roomDef>>)
  const bottom = floorTopY(roomDef(lower) as NonNullable<ReturnType<typeof roomDef>>) + 4
  return {
    id,
    kind: 'ladder',
    a: { space: upper, x: x + 8 },
    b: { space: lower, x: x + 8 },
    art: { x, y: top - 8, w: 16, h: bottom - top + 8 },
    opening: { id, rect: opening, style: 'shaft' },
    seconds: 3
  }
}

export const CONNECTORS: readonly Connector[] = [
  // ---- the open decks
  { id: 'deck_bow', kind: 'deck', a: { space: 'figurehead', x: 200 }, b: { space: 'lawn', x: 230 }, seconds: 1 },
  { id: 'deck_waist', kind: 'deck', a: { space: 'lawn', x: 500 }, b: { space: 'helm', x: 604 }, seconds: 6 },
  // ---- up the mast to the gym, and up to the captain's room
  {
    id: 'mast_ladder',
    kind: 'ladder',
    a: { space: 'crows_nest', x: 537 },
    b: { space: 'lawn', x: 537 },
    art: { x: 530, y: 106, w: 14, h: 144 },
    opening: { id: 'mast_ladder', rect: { x: 526, y: 112, w: 22, h: 14 }, style: 'shaft' },
    seconds: 8
  },
  {
    id: 'captain_steps',
    kind: 'stairs',
    a: { space: 'helm', x: 704 },
    b: { space: 'captains_room', x: 744 },
    art: { x: 712, y: 220, w: 26, h: 26, dir: 'up-right' },
    opening: { id: 'captain_steps', rect: { x: 730, y: 186, w: 18, h: 36 }, radii: [9, 9, 0, 0], style: 'door' },
    seconds: 2
  },
  {
    id: 'grand_stairs',
    kind: 'stairs',
    a: { space: 'stern_hall', x: 780 },
    b: { space: 'captains_room', x: 906 },
    art: { x: 772, y: 222, w: 124, h: 118, dir: 'up-right' },
    opening: { id: 'grand_stairs', rect: { x: 840, y: 222, w: 54, h: 50 }, style: 'shaft' },
    seconds: 6
  },
  // ---- level 1 (deck A): doors along the passage
  door('door_galley_quarters', 'galley', 'crew_quarters', 368, 'galley'),
  door('door_quarters_library', 'crew_quarters', 'library', 574, 'library'),
  door('door_library_hall', 'library', 'stern_hall', 730, 'library'),
  // ---- from the lawn and the bow down into level 1
  ladder('hatch_bow_galley', 'figurehead', 'galley', 136, { x: 132, y: 246, w: 24, h: 26 }),
  ladder('hatch_lawn_quarters', 'lawn', 'crew_quarters', 376, { x: 372, y: 246, w: 24, h: 26 }),
  // ---- level 1 down to level 2
  ladder('ladder_galley_lounge', 'galley', 'aquarium_lounge', 346, { x: 342, y: 340, w: 24, h: 28 }),
  ladder('ladder_quarters_lounge', 'crew_quarters', 'aquarium_lounge', 546, { x: 542, y: 340, w: 24, h: 28 }),
  ladder('ladder_hall_infirmary', 'stern_hall', 'infirmary', 900, { x: 896, y: 340, w: 24, h: 26 }),
  // ---- level 2: doors along the passage
  door('door_workshop_lounge', 'factory', 'aquarium_lounge', 328, 'factory'),
  door('door_lounge_map', 'aquarium_lounge', 'map_room', 588, 'map_room'),
  door('door_map_infirmary', 'map_room', 'infirmary', 738, 'map_room'),
  // ---- level 2 down to the hold
  ladder('ladder_workshop_engine', 'factory', 'engine_room', 304, { x: 300, y: 432, w: 24, h: 22 }),
  ladder('ladder_lounge_storage', 'aquarium_lounge', 'storage', 564, { x: 560, y: 432, w: 24, h: 22 }),
  ladder('ladder_infirmary_weapons', 'infirmary', 'weapons', 748, { x: 744, y: 432, w: 24, h: 22 }),
  // ---- the hold: doors along the passage
  door('door_engine_storage', 'engine_room', 'storage', 496, 'engine_room'),
  door('door_storage_weapons', 'storage', 'weapons', 630, 'storage')
]

// ---------------------------------------------------------------- walk graph

export interface Edge {
  connector: Connector
  from: Landing
  to: Landing
}

const adjacency = (): Map<string, Edge[]> => {
  const g = new Map<string, Edge[]>(SPACES.map((s) => [s.id, []]))
  for (const c of CONNECTORS) {
    g.get(c.a.space)?.push({ connector: c, from: c.a, to: c.b })
    g.get(c.b.space)?.push({ connector: c, from: c.b, to: c.a })
  }
  return g
}

export const WALK_GRAPH: ReadonlyMap<string, readonly Edge[]> = adjacency()

/**
 * Shortest (by walking seconds) chain of connector crossings from one space to another, or null when they are not
 * connected. A crew member walks to `from.x` on the floor, crosses, then continues from `to.x` in the next space.
 */
export function routeBetween(from: string, to: string): Edge[] | null {
  if (from === to) return []
  const best = new Map<string, number>([[from, 0]])
  const prev = new Map<string, Edge>()
  const open = [from]
  while (open.length) {
    open.sort((p, q) => (best.get(p) ?? 0) - (best.get(q) ?? 0))
    const here = open.shift() as string
    if (here === to) break
    for (const e of WALK_GRAPH.get(here) ?? []) {
      const cost = (best.get(here) ?? 0) + e.connector.seconds
      if (cost < (best.get(e.to.space) ?? Infinity)) {
        best.set(e.to.space, cost)
        prev.set(e.to.space, e)
        open.push(e.to.space)
      }
    }
  }
  if (!prev.has(to)) return null
  const out: Edge[] = []
  for (let at = to; at !== from; ) {
    const e = prev.get(at) as Edge
    out.unshift(e)
    at = e.from.space
  }
  return out
}
