/**
 * Layout data for the Sunny Deck pixel scene. The ship is a hand-placed, multilevel cutaway (see design/STYLE.md):
 * every room has its own pixel rectangle, corner radii and ceiling height, rooms are staggered across three
 * interior levels under a lawn deck, and the structure between them (beams, hull planks, stairwells) is baked
 * from these same shapes by the art build. World space is 1024x576 native px.
 *
 * Three concerns live in separate files so art and gameplay can change independently:
 *   - this file:        room art (rect, shape, theme, props) and the hull/structure geometry
 *   - hitboxes.ts:      what the pointer can click (never derived from the art shapes)
 *   - connectors.ts:    stairs, ladders and doors, plus the walk graph crew will use to move between rooms
 * Sprite names refer to frames in assets/ship/*.json; the art build test checks that every name here exists.
 */

import type { Pt, Radii } from './geometry'
import type { Flicker, LightKind } from './lighting'

export const WORLD_W = 1024
export const WORLD_H = 576
export const HORIZON_Y = 452
/** Top of the lawn deck's 12px floor strip: the open-deck rooms end 12px lower, at DECK_FLOOR_Y + 12. */
export const DECK_FLOOR_Y = 244
export const MAST_X = 520
/** Where the flag pole starts above the crow's nest roof. */
export const MAST_TOP = 4
/** The hull sprite (hull_day / hull_night) is full world width and is drawn with its top row at this world y. */
export const HULL_Y0 = 90
export const FORE_WAVE_Y = 532
export const SEA_FILL_FROM = 468
export const FORE_FILL_FROM = 556

export type RoomId =
  | 'figurehead'
  | 'lawn'
  | 'helm'
  | 'crows_nest'
  | 'captains_room'
  | 'galley'
  | 'crew_quarters'
  | 'library'
  | 'factory'
  | 'aquarium_lounge'
  | 'map_room'
  | 'infirmary'
  | 'engine_room'
  | 'storage'
  | 'weapons'

export interface Theme {
  /**
   * Wall tiles (planks / wallpaper), null for open-air rooms. Each 16x16 cell picks one by a hash of its
   * position, so repeats are weighted (plain a/b twice as likely as the knotted, stained and patched ones)
   * and no two neighbouring stretches of wall match.
   */
  wall: string[] | null
  dado: string
  rail: string
  base: string
  floor: string
}

const WOOD_TRIM = { rail: 'chair_rail', base: 'baseboard' } as const
const STEEL_TRIM = { rail: 'rail_steel', base: 'base_steel' } as const

/** a/b twice, then the worn variants c (knot + joint), d (stain), e (patched board), f (nails + damp). */
const walls = (t: string): string[] => ['a', 'b', 'a', 'b', 'c', 'd', 'e', 'f'].map((s) => `wall_${t}_${s}`)

export const THEMES = {
  galley: { wall: walls('teal'), dado: 'wainscot', ...WOOD_TRIM, floor: 'floor_checker' },
  map: { wall: walls('map'), dado: 'dado_map', ...WOOD_TRIM, floor: 'floor_wood' },
  lounge: { wall: walls('map'), dado: 'dado_map', ...WOOD_TRIM, floor: 'floor_carpet' },
  library: { wall: walls('library'), dado: 'dado_library', ...WOOD_TRIM, floor: 'floor_carpet' },
  factory: { wall: walls('factory'), dado: 'dado_factory', ...STEEL_TRIM, floor: 'floor_steel' },
  engine: { wall: walls('engine'), dado: 'dado_engine', ...STEEL_TRIM, floor: 'floor_steel' },
  infirmary: { wall: walls('infirmary'), dado: 'dado_infirmary', ...WOOD_TRIM, floor: 'floor_clean' },
  helm: { wall: walls('helm'), dado: 'dado_helm', ...WOOD_TRIM, floor: 'floor_wood' },
  cabin: { wall: walls('helm'), dado: 'dado_helm', ...WOOD_TRIM, floor: 'floor_carpet' },
  hold: { wall: walls('library'), dado: 'dado_library', ...WOOD_TRIM, floor: 'floor_wood' },
  gym: { wall: walls('gym'), dado: 'dado_gym', ...STEEL_TRIM, floor: 'floor_wood' },
  deck: { wall: null, dado: 'wainscot', ...WOOD_TRIM, floor: 'floor_wood' },
  lawn: { wall: null, dado: 'wainscot', ...WOOD_TRIM, floor: 'floor_lawn' }
} satisfies Record<string, Theme>

export interface Placement {
  /** Static sprite in props.json. Use `anim` instead for animated props. */
  prop?: string
  /** Animated prop: frame names cycled every `every` ticks (8 ticks/second). */
  anim?: string[]
  every?: number
  /** Left edge, room-local px. */
  x: number
  /** Floor-standing: the prop's feet line (room-local y). Defaults to the floor top. */
  feetY?: number
  /** Wall-hung: top edge, room-local y. */
  y?: number
}

export interface Overlay {
  /** Animated overlay (flame, steam, fish): see `ANCHOR_LIGHTS` for the ones that glow. */
  frames: string[]
  every: number
  /** The placed prop this attaches to, and the anchor (props.json meta.anchors) giving the offset. */
  on: string
  anchor: string
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A room, or a hall (a walkable space with props but no crew station and no click target of its own). */
export interface RoomDef {
  id: string
  label: string
  /** Interior rect in world px. Rooms are individually placed; nothing snaps to a grid. */
  rect: Rect
  /** Corner radii (tl, tr, br, bl): arched ceilings and the curve of the hull. */
  radii?: Radii
  theme: keyof typeof THEMES
  /** Open-air deck: sky behind, a railing in front of it, no ceiling or side walls. */
  open?: boolean
  props: Placement[]
  overlays?: Overlay[]
  /** Lantern x positions (room-local); each also gets the warm dithered glow. */
  lanterns?: number[]
  /** Floor runners (room-local x), drawn under the props. */
  rugs?: number[]
  /** Wear and clutter drawn on the back wall / floor behind the props: stains, scuffs, patches, pipes. */
  decals?: Placement[]
  /** Where this room's crew stand, room-local x of the feet centre, and how far idle crew stroll right. */
  home: number
  stroll: number
  facing: 'left' | 'right'
  /** What the crew member does here while "working": the `<id>_<tag>` animation, played at this spot. */
  activity?: { x: number; tag: string; flip: boolean }
}

export type RoomDefOf<T extends string> = RoomDef & { id: T }

export const ROOMS: readonly RoomDefOf<RoomId>[] = [
  // ------------------------------------------------------------------ top of the mast
  {
    id: 'crows_nest',
    label: "Crow's nest gym",
    rect: { x: 432, y: 36, w: 176, h: 88 },
    radii: [20, 20, 36, 36],
    theme: 'gym',
    props: [
      { prop: 'wall_cushion', x: 10, y: 14 },
      { prop: 'viewport', x: 62, y: 10 },
      { prop: 'sword_rack', x: 128, y: 18 },
      { prop: 'weight_rack', x: 16 },
      { prop: 'barbell_bench', x: 66 },
      { prop: 'chin_up_bar', x: 120 },
      { prop: 'kettlebells', x: 40, feetY: 81 }
    ],
    lanterns: [112],
    home: 100,
    stroll: 30,
    facing: 'left',
    activity: { x: 96, tag: 'work', flip: true }
  },
  // ------------------------------------------------------------------ lawn deck (open air)
  {
    id: 'figurehead',
    label: 'Figurehead deck',
    rect: { x: 108, y: 176, w: 108, h: 80 },
    theme: 'deck',
    open: true,
    props: [
      { prop: 'barrel', x: 4, feetY: 73 },
      { prop: 'rope_coil', x: 24, feetY: 72 },
      { prop: 'anchor', x: 54 },
      { prop: 'lamp_post', x: 92 }
    ],
    home: 62,
    stroll: 20,
    facing: 'left',
    activity: { x: 62, tag: 'work', flip: true }
  },
  {
    id: 'lawn',
    label: 'Lawn deck & aquarium bar',
    rect: { x: 220, y: 176, w: 290, h: 80 },
    theme: 'lawn',
    open: true,
    props: [
      { prop: 'tangerine_tree', x: 4 },
      { prop: 'tangerine_tree', x: 50 },
      { prop: 'aquarium', x: 98 },
      { prop: 'piano', x: 162 },
      { prop: 'bar_counter', x: 220 },
      { prop: 'bar_stool', x: 226, feetY: 73 },
      { prop: 'bar_stool', x: 254, feetY: 73 }
    ],
    overlays: [{ frames: ['aqua_fish_0', 'aqua_fish_1', 'aqua_fish_2', 'aqua_fish_3', 'aqua_fish_4', 'aqua_fish_5', 'aqua_fish_6', 'aqua_fish_7'], every: 2, on: 'aquarium', anchor: 'aquarium_fish' }],
    home: 98,
    stroll: 40,
    facing: 'right',
    activity: { x: 140, tag: 'work', flip: false }
  },
  {
    id: 'helm',
    label: 'Helm',
    rect: { x: 594, y: 176, w: 116, h: 80 },
    theme: 'deck',
    open: true,
    props: [
      { prop: 'ship_wheel', x: 2 },
      { prop: 'compass_binnacle', x: 54 },
      { prop: 'telescope', x: 80 },
      { prop: 'barrel', x: 98, feetY: 73 },
      { prop: 'rope_hank', x: 100, y: 12 }
    ],
    home: 66,
    stroll: 24,
    facing: 'left',
    activity: { x: 58, tag: 'work', flip: true }
  },
  // ------------------------------------------------------------------ stern castle
  {
    id: 'captains_room',
    label: "Captain's room",
    rect: { x: 736, y: 110, w: 196, h: 122 },
    radii: [44, 18, 0, 0],
    theme: 'cabin',
    props: [
      { prop: 'window_big', x: 8, y: 16 },
      { prop: 'wall_chart', x: 70, y: 16 },
      { prop: 'window_big', x: 132, y: 16 },
      { prop: 'captain_desk', x: 14 },
      { prop: 'reading_chair', x: 82, feetY: 116 },
      { prop: 'sword_rack', x: 120, y: 62 },
      { prop: 'globe', x: 158 }
    ],
    lanterns: [96],
    rugs: [14],
    home: 70,
    stroll: 26,
    facing: 'right'
  },
  // ------------------------------------------------------------------ level 1
  {
    id: 'galley',
    label: 'Galley & dining room',
    rect: { x: 128, y: 262, w: 238, h: 88 },
    radii: [24, 12, 6, 10],
    theme: 'galley',
    props: [
      { prop: 'shelf_jars', x: 28, y: 9 },
      { prop: 'porthole', x: 60, y: 14 },
      { prop: 'menu_board', x: 176, y: 14 },
      { prop: 'stove_hood', x: 82 },
      { prop: 'fridge', x: 28 },
      { prop: 'barrel', x: 58 },
      { prop: 'counter', x: 122 },
      { prop: 'pan_rack', x: 124, y: 6 },
      { prop: 'bench', x: 170 },
      { prop: 'table', x: 170, feetY: 76 }
    ],
    overlays: [
      { frames: ['stove_flame_0', 'stove_flame_1'], every: 1, on: 'stove_hood', anchor: 'stove_flame' },
      { frames: ['steam_0', 'steam_1', 'steam_2'], every: 2, on: 'stove_hood', anchor: 'stove_steam' }
    ],
    decals: [
      { prop: 'string_lights', x: 6, y: 9 },
      { prop: 'string_lights', x: 108, y: 9 },
      { prop: 'decal_rust_run', x: 118, y: 10 },
      { prop: 'decal_rust_run', x: 40, y: 10 },
      { prop: 'vent_grate', x: 150, y: 12 },
      { prop: 'decal_floor_scuff', x: 30, y: 71 },
      { prop: 'decal_floor_scuff', x: 150, y: 70 },
      { prop: 'decal_wet_patch', x: 62, y: 72 }
    ],
    lanterns: [199],
    rugs: [8, 72, 136],
    home: 126,
    stroll: 36,
    facing: 'right',
    activity: { x: 120, tag: 'work', flip: true }
  },
  {
    id: 'crew_quarters',
    label: 'Crew quarters',
    rect: { x: 370, y: 268, w: 202, h: 82 },
    radii: [16, 16, 6, 6],
    theme: 'cabin',
    props: [
      { prop: 'porthole', x: 108, y: 8 },
      { prop: 'bunk_bed', x: 28 },
      { prop: 'hammock', x: 92, y: 26 },
      { prop: 'footlocker', x: 160 },
      { prop: 'wall_clock', x: 166, y: 10 }
    ],
    lanterns: [100],
    rugs: [96],
    home: 100,
    stroll: 20,
    facing: 'right'
  },
  {
    id: 'library',
    label: 'Library',
    rect: { x: 576, y: 264, w: 152, h: 86 },
    radii: [18, 12, 6, 6],
    theme: 'library',
    props: [
      { prop: 'bookshelf_a', x: 6, y: 4 },
      { prop: 'bookshelf_b', x: 50, y: 4 },
      { prop: 'bookshelf_c', x: 94, y: 4 },
      { prop: 'reading_chair', x: 30, feetY: 80 },
      { prop: 'coffee_table', x: 68, feetY: 80 },
      { prop: 'floor_lamp', x: 128 }
    ],
    rugs: [20, 80],
    home: 100,
    stroll: 8,
    facing: 'left',
    activity: { x: 114, tag: 'work', flip: true }
  },
  // ------------------------------------------------------------------ level 2
  {
    id: 'factory',
    label: 'Workshop factory',
    rect: { x: 136, y: 354, w: 190, h: 86 },
    radii: [12, 10, 8, 38],
    theme: 'factory',
    props: [
      { prop: 'tool_wall', x: 16, y: 8 },
      { prop: 'blueprint', x: 92, y: 10 },
      { anim: ['gear_wall_0', 'gear_wall_1'], every: 3, x: 128, y: 8 },
      { prop: 'workbench', x: 14 },
      { prop: 'drill_press', x: 90 },
      { prop: 'parts_bins', x: 110 },
      { prop: 'anvil', x: 54, feetY: 79 },
      { prop: 'robot_bust', x: 130, feetY: 79 }
    ],
    lanterns: [88],
    rugs: [12, 66],
    home: 84,
    stroll: 36,
    facing: 'right',
    activity: { x: 50, tag: 'work', flip: false }
  },
  {
    id: 'aquarium_lounge',
    label: 'Aquarium lounge & bar',
    rect: { x: 330, y: 354, w: 256, h: 86 },
    radii: [34, 34, 24, 24],
    theme: 'lounge',
    props: [
      { prop: 'reef_window', x: 94, y: 8 },
      { prop: 'bottle_shelf', x: 26, y: 10 },
      { prop: 'bar_counter', x: 24 },
      { prop: 'bar_stool', x: 30, feetY: 80 },
      { prop: 'bar_stool', x: 62, feetY: 80 },
      { prop: 'coffee_table', x: 104, feetY: 80 },
      { prop: 'sofa', x: 158 }
    ],
    overlays: [{ frames: ['reef_fish_0', 'reef_fish_1', 'reef_fish_2', 'reef_fish_3', 'reef_fish_4', 'reef_fish_5', 'reef_fish_6', 'reef_fish_7'], every: 2, on: 'reef_window', anchor: 'reef_fish' }],
    rugs: [96, 150],
    home: 128,
    stroll: 30,
    facing: 'right'
  },
  {
    id: 'map_room',
    label: "Navigator's map room",
    rect: { x: 590, y: 354, w: 146, h: 86 },
    radii: [12, 12, 8, 8],
    theme: 'map',
    props: [
      { prop: 'wall_chart', x: 48, y: 8 },
      { prop: 'porthole', x: 114, y: 8 },
      { prop: 'tangerine_tree', x: 6 },
      { prop: 'chart_table', x: 44 },
      { prop: 'globe', x: 112 },
      { prop: 'map_chair', x: 22, feetY: 79 }
    ],
    lanterns: [88],
    rugs: [4, 70],
    home: 76,
    stroll: 24,
    facing: 'right',
    activity: { x: 34, tag: 'work', flip: false }
  },
  {
    id: 'infirmary',
    label: 'Infirmary',
    rect: { x: 740, y: 354, w: 190, h: 86 },
    radii: [10, 18, 30, 8],
    theme: 'infirmary',
    props: [
      { prop: 'medicine_cabinet', x: 30, y: 8 },
      { prop: 'medical_cross', x: 78, y: 10 },
      { prop: 'anatomy_chart', x: 106, y: 8 },
      { prop: 'herb_rack', x: 136, y: 10 },
      { prop: 'cot', x: 30 },
      { prop: 'iv_stand', x: 102 },
      { prop: 'clinic_scale', x: 126 },
      { prop: 'mortar_and_pestle', x: 70, feetY: 79 }
    ],
    lanterns: [118],
    home: 120,
    stroll: 28,
    facing: 'left',
    activity: { x: 112, tag: 'work', flip: true }
  },
  // ------------------------------------------------------------------ level 3 (the hold)
  {
    id: 'engine_room',
    label: 'Engine room',
    rect: { x: 232, y: 444, w: 262, h: 86 },
    radii: [10, 10, 10, 46],
    theme: 'engine',
    props: [
      { prop: 'gauge_panel', x: 44, y: 8 },
      { anim: ['wall_fan_0', 'wall_fan_1'], every: 1, x: 114, y: 10 },
      { prop: 'coal_bin', x: 20 },
      { prop: 'cola_keg', x: 90 },
      { prop: 'valve_wheel', x: 124 },
      { prop: 'engine', x: 150 }
    ],
    overlays: [{ frames: ['engine_rods_0', 'engine_rods_1'], every: 1, on: 'engine', anchor: 'engine_rods' }],
    rugs: [40],
    home: 70,
    stroll: 30,
    facing: 'right',
    activity: { x: 114, tag: 'work', flip: false }
  },
  {
    id: 'storage',
    label: 'Storage hold',
    rect: { x: 498, y: 444, w: 130, h: 86 },
    radii: [12, 12, 6, 6],
    theme: 'hold',
    props: [
      { prop: 'rope_hank', x: 28, y: 10 },
      { prop: 'barrel_stack', x: 6 },
      { prop: 'barrel', x: 48 },
      { prop: 'crate_oranges', x: 88 },
      { prop: 'crate_stack', x: 84 },
      { prop: 'barrel', x: 108, feetY: 79 }
    ],
    lanterns: [58],
    home: 100,
    stroll: 10,
    facing: 'left'
  },
  {
    id: 'weapons',
    label: 'Weapons room',
    rect: { x: 632, y: 444, w: 172, h: 86 },
    radii: [12, 12, 42, 6],
    theme: 'factory',
    props: [
      { prop: 'sword_rack', x: 80, y: 12 },
      { prop: 'weapon_rack', x: 6 },
      { prop: 'cannon', x: 74 },
      { prop: 'cannonballs', x: 138 },
      { prop: 'crate_parts', x: 138, feetY: 79 },
      { prop: 'weapon_rack', x: 106, y: 16 }
    ],
    lanterns: [96],
    home: 60,
    stroll: 20,
    facing: 'right'
  }
]

/** Walkable spaces that are not rooms: the stern stairwell hall. Same rendering as rooms, no crew station, no click target. */
export const HALLS: readonly RoomDef[] = [
  {
    id: 'stern_hall',
    label: 'Stern stairwell',
    rect: { x: 732, y: 262, w: 196, h: 88 },
    radii: [10, 10, 6, 6],
    theme: 'cabin',
    props: [
      { prop: 'fern_pot', x: 4, feetY: 78 },
      { prop: 'ship_bell', x: 154, y: 14 },
      { prop: 'wall_flag', x: 8, y: 12 }
    ],
    lanterns: [120],
    home: 100,
    stroll: 0,
    facing: 'right'
  }
]

/** Everything with walls and a floor: the rooms plus the halls. Order is draw order. */
export const SPACES: readonly RoomDef[] = [...ROOMS, ...HALLS]

export const roomDef = (id: string): RoomDef | undefined => SPACES.find((r) => r.id === id)

/** Interior rect in world px. */
export const roomRect = (r: RoomDef): Rect => r.rect

/** Floor line of a room: the world y of the top of its 12px floor strip. */
export const floorTopY = (r: RoomDef): number => r.rect.y + r.rect.h - 12

// ---------------------------------------------------------------- structure (all baked into the hull sprite)

/** A doorway or hatch cut through the beams between two spaces. */
export interface Opening {
  id: string
  rect: Rect
  radii?: Radii
}

/** Beam fills that join the decks to one another (under the lawn, under the castle). */
export const SLABS: readonly Rect[] = [
  { x: 112, y: 256, w: 624, h: 18 },
  { x: 732, y: 230, w: 196, h: 36 }
]

/**
 * The outer hull, bow to stern, as spline control points: the curve the hull planks follow. The top edge is the
 * straight deck line at y 256; the rooms inside are placed (and checked by tests) to clear it by a hull wall.
 */
export const HULL_CURVE: readonly Pt[] = [
  { x: 1010, y: 256 },
  { x: 1014, y: 304 },
  { x: 1004, y: 370 },
  { x: 978, y: 430 },
  { x: 934, y: 482 },
  { x: 874, y: 518 },
  { x: 796, y: 542 },
  { x: 700, y: 552 },
  { x: 560, y: 554 },
  { x: 420, y: 554 },
  { x: 330, y: 551 },
  { x: 256, y: 540 },
  { x: 194, y: 514 },
  { x: 142, y: 474 },
  { x: 102, y: 424 },
  { x: 78, y: 366 },
  { x: 70, y: 316 },
  { x: 76, y: 280 },
  { x: 86, y: 256 }
]

/** The stern poop: a raised after-deck with a curling tip, joined to the captain's room. */
export const STERN_POOP: readonly Pt[] = [
  { x: 920, y: 214 },
  { x: 960, y: 208 },
  { x: 990, y: 190 },
  { x: 1006, y: 158 },
  { x: 1014, y: 170 },
  { x: 1016, y: 258 },
  { x: 920, y: 258 }
]

/** Decorative structure drawn from world-sheet sprites (see art-src/ship-art/ship.ts). */
export const STRUCTURE = {
  /** Crow's nest roof platform + flag pole (sprite top-left; the pole is its centre column, on the mast axis). */
  nestRoof: { x: MAST_X - 103, y: 5 },
  /** Foot of the nest where the mast enters it. */
  nestBase: { x: MAST_X - 49, y: 121 },
  /** The mast from the nest's collar to the deck; `bottom` is the world y of its foot. */
  mast: { x: MAST_X - 7, y: 117, bottom: 250 },
  yard: { x: MAST_X - 97, y: 133 },
  yardW: 192,
  sail: { x: MAST_X - 89, y: 137 },
  sailW: 176,
  sailH: 96,
  rigging: { y: 30, h: 220 },
  /** Striped dome roof over the captain's room. */
  dome: { x: 741, y: 56 },
  chimneys: [
    { x: 936, y: 92 },
    { x: 976, y: 164 }
  ],
  /** The big lion figurehead on the bow. */
  figurehead: { x: 6, y: 138 },
  bowScroll: { x: 84, y: 190 }
} as const

/** Open main deck between the lawn and the helm: props that stand on the deck floor. */
export const OPEN_DECK: readonly Placement[] = [
  { prop: 'rope_coil', x: 494 },
  { prop: 'cannon', x: 548 },
  { prop: 'barrel', x: 578 }
]

/**
 * Portholes, stern windows and cannon ports on the bare hull (bow and stern caps, and under the keel line). world
 * fittings are day/night sprites from the world sheet (<prop>_day / <prop>_night); the rest come from the props sheet.
 * A test checks that none of them overlap a room or the beams around it.
 */
export const HULL_FITTINGS: readonly { prop: string; x: number; y: number; world?: boolean }[] = [
  // bow
  { prop: 'porthole', x: 94, y: 282 },
  { prop: 'porthole', x: 90, y: 372 },
  { prop: 'gunport_closed', x: 92, y: 322, world: true },
  { prop: 'gunport_open', x: 104, y: 410, world: true },
  // stern
  { prop: 'porthole', x: 954, y: 284 },
  { prop: 'porthole', x: 954, y: 326 },
  { prop: 'porthole', x: 954, y: 368 },
  { prop: 'gunport_closed', x: 944, y: 420, world: true },
  { prop: 'gunport_open', x: 866, y: 478, world: true }
]

// ---------------------------------------------------------------- light sources (night lighting pass)

/** A light attached to a sprite: (fx, fy) is where it sits as a fraction of the sprite's width and height. */
export interface PropLight {
  fx: number
  fy: number
  rx: number
  ry: number
  kind: LightKind
  /** Brightness steps at the centre of the pool (1..8). */
  power: number
  flicker: Flicker
}

const L = (fx: number, fy: number, rx: number, ry: number, kind: LightKind, power: number, flicker: Flicker): PropLight => ({
  fx,
  fy,
  rx,
  ry,
  kind,
  power,
  flicker
})

/** String lights are 96px wide with a bulb every 8px, three swags of 32px (see art-src/ship-art/props-wear.ts). */
const STRING_BULBS: readonly PropLight[] = [8, 16, 24, 40, 48, 56, 72, 80, 88].map((x) => L((x + 1) / 96, 0.7, 18, 15, 'warm', 3, 'candle'))

/** Placed props that emit light. Props that hang inside a room are clipped to that room. */
export const PROP_LIGHTS: Readonly<Record<string, readonly PropLight[]>> = {
  aquarium: [L(0.5, 0.5, 64, 46, 'cool', 4, 'pulse')],
  reef_window: [L(0.5, 0.5, 96, 40, 'cool', 4, 'pulse')],
  lamp_post: [L(0.5, 0.1, 50, 44, 'warm', 5, 'candle')],
  floor_lamp: [L(0.5, 0.12, 46, 40, 'warm', 6, 'candle')],
  engine: [L(0.45, 0.7, 54, 36, 'warm', 5, 'fire')],
  gauge_panel: [L(0.5, 0.5, 24, 20, 'cool', 3, 'pulse')],
  robot_bust: [L(0.5, 0.3, 14, 12, 'cool', 3, 'pulse')],
  globe: [L(0.5, 0.45, 20, 18, 'warm', 3, 'candle')],
  compass_binnacle: [L(0.5, 0.2, 18, 16, 'warm', 3, 'candle')],
  porthole: [L(0.5, 0.75, 38, 34, 'cool', 4, 'none')],
  viewport: [L(0.5, 0.6, 32, 28, 'cool', 3, 'none')],
  window_big: [L(0.5, 0.6, 38, 32, 'cool', 3, 'none')],
  table: [L(0.73, 0.1, 44, 30, 'warm', 6, 'candle')],
  captain_desk: [L(0.2, 0.2, 26, 22, 'warm', 4, 'candle')],
  // fairy lights: one small pool per bulb, left to right along the sprite
  string_lights: STRING_BULBS
}

/** Animated overlays that emit light (flames), keyed by anchor name. */
export const ANCHOR_LIGHTS: Readonly<Record<string, PropLight>> = {
  stove_flame: L(0.5, 0.7, 54, 34, 'warm', 6, 'fire')
}

/** Lanterns (room.lanterns) share one light, relative to the lantern sprite. */
export const LANTERN_LIGHT: PropLight = L(0.5, 0.75, 66, 54, 'warm', 7, 'candle')

/** Lit hull fittings glow outward onto the planks and the sea at night. */
export const HULL_GLOWS: Readonly<Record<string, PropLight>> = {
  porthole: L(0.5, 0.5, 20, 18, 'warm', 4, 'candle'),
  window_big: L(0.5, 0.5, 34, 26, 'warm', 5, 'candle'),
  gunport_open: L(0.5, 0.5, 20, 14, 'warm', 3, 'fire')
}
