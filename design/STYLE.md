# Grand Fleet — ship art style

Analysis of `design/refs/` and the rules the rebuilt ship art follows.
The old procedural-rectangle scene (`art-src/ship/compose-scene.ts`) is **retired**; nothing new is drawn from it.

## 1. What the references actually do

### One Piece Grand Gourmet (`one-piece-grand-gourmet-isometric-interior.png`, `one-piece-character-sprite-sheet.png`)

| Aspect | Observation |
| --- | --- |
| **Palette** | Candy-saturated but *warm*: raspberry carpet, butter-yellow bedding, mint/cream plaster, teal water, lime grass, honey wood. Few hues per room (2 dominant + 1 accent). Shadows shift toward purple/teal, highlights toward yellow, never toward grey. |
| **Outline** | Every object has a **1px coloured outline** in the darkest shade of its own hue (maroon around red things, deep green around plants, brown around wood). It is never black. Interior details are separated by *shade steps*, not by extra outlines. |
| **Shading** | 3–4 tone ramps per material, light from the **top-left**. A bright 1px highlight runs along every top/left edge, a darker 1px shade along the bottom/right. Flat fills inside, no gradients, almost no dithering. |
| **Cast shadows** | A short, hard-edged darker patch of the floor tone sits right/below each object. It grounds the prop. |
| **Tile size** | The grid is ~16px (a chair/table is about one tile; a pillar about 1×2). The floor is a visible repeating pattern (checker, carpet border), which is what makes the room feel scaled. |
| **Walls / floors / depth** | Walls are cut away at the front so we see the back wall plus one side wall, each with a **trim band** (a dado, crown moulding, a repeating window or panel motif). Floors have a border and a visible slab thickness at the edge. Depth comes from stacking: wall, then furniture on the floor line, then characters in front of it. |
| **Density** | Nothing is empty. Every floor stretch has a table, plant, barrel or fixture. Clusters (barrels + crates + bottles) read as one prop group. |
| **Characters** | Chibi, about **16×24**: head ≈ 50% of height, 2–3 tone body, 1px dark outline, a strong silhouette (hat/hair colour is the identity), tiny hands and feet. A character is about **as tall as a table plus its chair**, about 1.5 tiles, and about half the height of a doorway. Furniture is never smaller than the character's waist. |

### Barotrauma (`barotrauma-submarine-cutaway-*.png`)

| Aspect | Observation |
| --- | --- |
| **Palette** | Desaturated steel blue-grey and teal with *tiny* hot accents: red alarms, amber lamps, green LEDs. Value contrast carries everything (very dark cavities, mid steel, bright rim light). |
| **Outline** | No explicit outline. Separation comes from a dark 1–2px gap between layers. We keep our own 1px outline rule but borrow the dark *gap* between a prop and the wall behind it. |
| **Shading** | 2.5D layering: recessed back wall (darkest), mid-layer machinery, front-layer pipes and railings. Ambient occlusion pools in every corner and under every beam. A local light source brightens a halo of props. |
| **Walls / floors / depth** | The cross-section shows **thick structural members**: girders, bulkheads, grated floor slabs with visible thickness, riveted plates, diagonal braces at corners. Rooms are separated by bulkheads with doorways, and you see into neighbours (darker). |
| **Density** | Every metre of wall carries something: panels, vents, pipes, cabling, ladders. There are **no empty floor stretches**. |
| **Scale** | A crew member is about **1/3 of room height**, so rooms feel like machines rather than boxes. |

### What we take from each

- **From Grand Gourmet:** warm hue-shifted palette, coloured 1px outlines, chibi 16×24 crew, readable props, cheerful trim and patterned floors.
- **From Barotrauma:** thick cutaway structure (girders, deck slabs, braces), dark gaps and ambient occlusion, dense props, bulkheads that show the neighbouring room.

## 2. Hard rules (from the brief)

1. **Native resolution.** Everything is composed on an offscreen canvas at native size, then scaled up by an **integer** factor with nearest-neighbour (`imageSmoothingEnabled = false`, `image-rendering: pixelated`). No anti-aliasing, no CSS gradients, no vector shapes, no sub-pixel positions. Sky and sea are pixel art too. The galley vignette is **256×144** (16×9 tiles), shown at ×4 = 1024×576.
2. **One palette, 32 colours** (below). Every pixel in every PNG uses it.
3. **Light from top-left.** Each object has a 1px dark outline, a highlight edge and a cast shadow.
4. **16×16 tile grid.** Rooms are cross-sections with a textured back wall, a floor with visible thickness, ceiling beams and a side wall.
5. **6–12 distinct props per room**, themed to the room. No bare floor stretch wider than 3 tiles.
6. **Hull**: planks with seams, a waterline, portholes, railings, figurehead, sails, rigging (built in later phases).
7. **Crew**: 16×24 chibi sprites, 2-frame idle bob, 4-frame walk. Status is a speech-bubble icon above the head.
8. **Room labels** are hidden until hover, drawn as pixel-font plaques on the ceiling girder so they never cover props.

## 3. The 32-colour palette ("Grand Fleet 32")

Each material has 3–5 shades, ordered **darkest/outline → shadow → base → light → highlight**. The darkest shade of a ramp is the outline colour for that hue.

| Ramp | Key | Hex | Role |
| --- | --- | --- | --- |
| **Steel** | `f` | `#1b1f33` | outline for steel + deepest shadow |
| | `g` | `#3c4766` | shadow |
| | `h` | `#6d83a3` | base |
| | `i` | `#a9bdd2` | light |
| | `j` | `#eaf2f7` | highlight / white |
| **Wood** | `a` | `#35201f` | outline for wood, skin, cream |
| | `b` | `#6a3a2b` | shadow |
| | `c` | `#a2663a` | base |
| | `d` | `#d29a58` | light |
| | `e` | `#f4cf8c` | highlight |
| **Teal paint** | `k` | `#0e3a44` | outline + wall shadow |
| | `l` | `#1b6a6e` | shadow / wall base |
| | `m` | `#3aa88e` | base |
| | `n` | `#86dcae` | light |
| **Cream** | `o` | `#8f7561` | shadow / grout |
| | `p` | `#cdb08a` | base |
| | `q` | `#ecd7a8` | light |
| | `r` | `#fff3d2` | highlight |
| **Red** | `s` | `#4a1428` | outline |
| | `t` | `#9a2c3e` | shadow |
| | `u` | `#d84c42` | base |
| | `v` | `#fb8f66` | light |
| **Gold / orange** | `w` | `#a9591c` | shadow + outline for brass |
| | `x` | `#f0a030` | base |
| | `y` | `#ffe070` | highlight |
| **Green** | `z` | `#2b5c36` | shadow + outline |
| | `A` | `#66b24c` | base |
| **Skin** | `C` | `#c47a5c` | shadow |
| | `D` | `#f3bc94` | base |
| **Sky / sea blue** | `E` | `#27478e` | deep + outline |
| | `F` | `#4181c8` | base |
| | `G` | `#86c8ee` | light |

Transparent is `.` in the sprite sources. Sky/sea highlights reuse steel `j`.

### Outline rule (automated)

The art build adds a 1px outline around every prop and character. The outline colour is the *darkest shade of the neighbouring pixel's ramp* (wood → `a`, steel → `f`, teal → `k`, red → `s`, brass → `w`, green → `z`, blue → `E`). Pixels that are already the darkest shade of their ramp do not get a second outline, so hand-drawn dark edges are respected.

### Cast shadow rule (automated)

Every prop gets a companion `<name>__shadow` frame. It is the prop's silhouette shifted **+1px right, +1px down**, hard-edged and solid in the darkest teal (`k`), which matches Grand Gourmet's short hard patch and stays palette-pure. Floor-standing props and characters also get a dithered floor ellipse.

## 4. Grid, depth and scale

- **Tile**: 16×16. All structure snaps to it.
- **Room (galley)**: 12×5 tiles = 192×80 interior, with a 16px structural deck band above and below.
- **Room anatomy (top → bottom)**
  1. Deck band (16px): plank layer, then a riveted steel **girder** that is the visible ceiling beam, with a dithered ambient-occlusion shadow underneath.
  2. Back wall: teal vertical planks (two alternating variants), a wooden chair rail, then a cream **subway-tile dado** and a baseboard.
  3. **Floor face** (12px): a squashed 8×4 checker, which gives the 2.5D depth that Grand Gourmet gets from isometry. Props stand on the *back* of this strip and crew on the *front*.
  4. Deck band under the room: plank lip, then girder.
- **Side walls**: left is the planked hull wall with sea outside. Right is a bulkhead jamb and lintel with a doorway into the neighbouring room, which is dimmed with a dither overlay.
- **Scale**: crew = 24px (1.5 tiles). Counter ≈ 28px, fridge ≈ 47px, hood top ≈ 64px above the floor. Crew head height (12px) ≈ counter-top height, as in Grand Gourmet.
- **Z order**: sky → sea → wall → props (back to front) → floor shadows → crew → bubbles → hover plaque.

## 5. Asset layout

PNG sheets, built by `pnpm art` from the pixel sources in `art-src/ship-art/`:

| Sheet | Contents |
| --- | --- |
| `assets/ship/tiles.png` | wall, dado, floor, deck band, hull, sky and sea tiles, dither overlays |
| `assets/ship/props.png` | ~100 props for all ten rooms, animated overlays (flames, steam, fish, engine rods, fans, gears, lanterns), `__shadow` and `_night` (window glass) frames, `floor_shadow_<w>` |
| `assets/ship/characters.png` | all ten crew: 2 idle + 4 walk frames each (`<id>_idle_N` / `<id>_walk_N`) |
| `assets/ship/world.png` | sky (day/night), stars, sun, moon, clouds, sea fill, foreground swell, hull planking, masts, yards, sails, flags, rigging, cannon ports |
| `assets/ship/ui.png` | status bubbles, selection arrow, plaque pieces, 3×5 pixel font |

Each sheet has an Aseprite-style `.json` atlas next to it.

## 6. The whole ship

- **World**: 1024×576 native px. Horizon at y 452; the lawn deck's floor top at y 244. Constants live in `src/ship/room-defs.ts` and are checked against `art-src/ship-art/world.ts` by a test.
- **Organic layout** (the ship is a hand-built cutaway, not a grid of equal rooms; see `src/ship/room-defs.ts`): fifteen rooms, each with its own pixel rect, corner radii (arched ceilings, a belly that follows the hull curve) and ceiling height. Zoro's gym is the crow's nest at the top of the mast; the captain's room is the raised stern castle under the striped dome; the figurehead deck, lawn and helm form the open top deck; below it come three staggered interior levels (galley, crew quarters, library, stern hall / workshop, aquarium lounge, map room, infirmary / engine room, storage hold, weapons room). Floors are deliberately not aligned between neighbours.
- **Three separate concerns**: `room-defs.ts` is the art (shape, theme, props, hull curve, structure positions); `hitboxes.ts` is what the pointer hits (hand-written rectangles, larger than the art where useful, tests check they cover each room and never overlap); `connectors.ts` lists every stair, ladder and door, and drives both the art (the stair/ladder sprites and the doorway cut-outs) and the walk graph (`WALK_GRAPH`, `routeBetween`) crew will use to walk between rooms.
- **Shell**: `src/ship/shell.ts` builds the room masks, the curved beams around each room (thicker above than below, lit on the top-left faces), the cavity between rooms and the hull silhouette from `geometry.ts` (rounded rects, splines, dilation). The art build paints the hull sprite from those masks; at runtime each room interior is cut to the same mask, so the beams and the rooms cannot disagree.
- **Room layout** is data (`ROOMS`): theme (wall/dado/rail/base/floor tiles), props with room-local positions, animated overlays attached through anchors, lanterns, rugs, and where the crew stand. Tests check that every sprite exists, that props stay inside the room, that each room has 4–12 props, that no floor stretch is wider than 48px (props, rugs, ladder slots and stairs count as cover), and that rooms clear the hull planks.
- **Themes**: teal galley, map-room and lounge blue, library wallpaper with carpet, factory/engine steel, infirmary tile, helm and cabin planks, gym steel. Open decks (figurehead, lawn, helm) have a railing over sky instead of a back wall.
- **Hull**: horizontal 8px planks with seams, grain, nail heads and staggered butt joints, two gold wales, copper-red bottom paint, portholes and cannon ports, a keel beam. Night versions step every key one shade down its own ramp, so they stay in GF32.
- **Sails and rigging**: vertical folds (lit left edge, shaded right edge, dithered crease), scalloped hem, reef bands, a stitched patch, the Straw Hat jolly roger on the mainsail; rigging is 1px lines. The sun-lion figurehead and bow scroll stand at the bow.
- **Camera**: always an integer scale with nearest-neighbour sampling. The ship view shows the whole world at the largest integer scale that fits. Clicking a room zooms to the largest integer scale that fits that room plus a margin; Esc or the back button returns. (The 480×270 budget in the brief cannot hold ten 80px-tall rooms with readable props, so the world is larger and the zoom view is the close-up.)
- **Lighting (night)**: `src/ship/lighting.ts`. Not a literal multiply/additive blend (that would leave GF32). Every pixel gets an ambient step (0-7: outside 1, open deck 2, rooms 3, sky 4, plus a stepped vignette at room sides, ceiling and floor corners) and a glow step (warm 1-3 / cool 4-6). A LUT maps each source colour to a fixed output colour per state: darker, bluer and less saturated as ambient drops, warmer and brighter as glow rises. Light pools are elliptical bands with Bayer-dithered edges (no smooth gradients), clipped to their room for in-room lamps, with `candle`/`fire`/`pulse` flicker. Lamps, lanterns, stove, aquarium, screens, string lights and lit portholes are sources (`PROP_LIGHTS`, `ANCHOR_LIGHTS`, `LANTERN_LIGHT`, `HULL_GLOWS` in `room-defs.ts`). Day mode uses ambient 7 everywhere and no lamps.
- **Crew**: all ten are 24x32 (`characters-big.ts` for Sanji, `characters-crew.ts` for the rest; the old 16x24 builder in `characters.ts` is now unused). Each has idle (2), walk (4) and a room-activity `work` tag (4): Sanji cooks, Luffy cheers on the figurehead, Zoro curls a barbell, Nami studies a chart, Robin reads, Franky swings a wrench, Usopp hammers, Chopper grinds medicine, Jinbe steers, Brook plays violin. `activity` in `room-defs.ts` says where. 32x32 busts (`portrait_<id>` in the ui sheet) feed the roster and Captain's Deck. Crew are drawn after the lighting pass from sheets lit three ambient steps above their surroundings, so they are the highest-contrast thing in the room. 1-2px wall shadow plus a floor ellipse.
- **Renderer**: Canvas2D at the 1024x576 native size, scaled by an integer factor with nearest-neighbour sampling. PixiJS was deliberately not adopted: the palette-LUT lighting needs per-pixel CPU access to the composed frame, which a GPU scene graph would only make harder. Ship bob (0-2px, hull, overlays, crew and light index move together; sea, sky and swell stay still), day-only gulls, weather (`clear`/`rain`/`fog`, Settings → Scene; Bayer-dithered fog, 1px rain), wheel zoom in integer steps with drag pan and a Reset view button. Aseprite drop-ins: see ASSETS.md.
- **Wear**: `art-src/ship-art/wear.ts` adds wall-plank variants (knots, joints, stains, patched boards, nails; picked per cell by hash) and decals (grease, rust runs, scuffs, wet patch, vent, junction box, pipe, moss, string lights) that rooms place before props through `decals`.
- **Z order**: sky, clouds, sea, rigging, sail, mast, chimneys, figurehead, deck strip, room interiors (each cut to its room shape), the hull sprite (planks, curved beams, doorways), stairs and ladders, nest and dome, animated overlays, crew, foreground swell, status bubbles, hover plaque.
- **Dev lab**: `node scripts/ship-lab.mjs` serves the real `ShipScene` over http (no Electron): `?night=1&zoom=3&room=<id>&crew=1`.

