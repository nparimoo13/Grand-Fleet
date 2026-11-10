import type { Palette } from '../lib/raster'

/**
 * Rich, expanded palette for The Sunny Deck, its Barotrauma-style cutaway
 * interior, and One Piece Grand Gourmet culinary/pirate detailing.
 * Keys are single characters used in art-src grids and stamps.
 */
export const SUNNY_DECK_PALETTE: Palette = {
  // Base / Transparency
  '.': [0, 0, 0], // transparent (alpha stripped in raster)
  ' ': [0, 0, 0], // transparent space
  K: [18, 14, 18], // crisp black ink outline / deepest shadow
  '!': [255, 255, 255], // pure specular white highlight

  // Original keys (preserved for backwards compatibility)
  o: [43, 28, 18], // outline / rigging shadow
  w: [122, 78, 46], // hull wood dark
  W: [168, 118, 72], // hull wood mid
  Y: [210, 168, 110], // hull wood light
  r: [176, 48, 38], // accent red (trim)
  R: [220, 72, 58],
  g: [58, 110, 62], // lawn / plant
  G: [92, 150, 86],
  b: [36, 78, 118], // water deep
  B: [58, 118, 158], // water mid
  c: [118, 188, 210], // water foam / sky
  C: [186, 228, 242], // sky light
  s: [148, 156, 168], // steel
  S: [198, 206, 218],
  l: [240, 196, 72], // lantern / brass
  L: [255, 228, 140],
  n: [28, 32, 48], // night sky deep
  N: [48, 58, 88],
  p: [196, 164, 132], // parchment / sail
  P: [232, 220, 196],
  m: [88, 62, 44], // mast
  M: [120, 86, 58],
  f: [248, 248, 252], // flag emblem light
  F: [228, 68, 58], // flag emblem
  d: [72, 52, 38], // deck shadow
  D: [98, 72, 52], // deck planks
  i: [210, 210, 218], // window glint
  h: [140, 100, 68], // hair / rope

  // Deep Wood Tones (Hull, Planks, Carved Timbers)
  '0': [32, 20, 14], // pitch dark timber shadow
  '1': [58, 36, 24], // deep aged oak
  '2': [88, 54, 34], // warm mahogany
  '3': [134, 86, 54], // rich teak
  '4': [182, 126, 80], // golden cedar
  '5': [224, 174, 120], // warm blonde highlight

  // Industrial / Barotrauma Heavy Metal Ramps (Bulkheads, Pipes, Rivets, Machinery)
  '6': [22, 26, 34], // black cast iron
  '7': [44, 52, 66], // gunmetal structural beam
  '8': [76, 88, 108], // industrial steel
  '9': [128, 142, 166], // bright steel / rivet cap
  '-': [16, 20, 28], // deepest industrial cavity shadow

  // Brass, Bronze & Gold (Ornaments, Helm Wheel, Compasses, Lanterns)
  $: [152, 104, 28], // dark antique bronze
  '%': [208, 156, 42], // polished brass
  '^': [248, 206, 68], // gleaming gold
  l2: [255, 238, 144], // hot golden highlight

  // Copper & Steam Pipes
  '[': [132, 58, 38], // oxidized copper dark
  ']': [188, 96, 62], // polished copper pipe
  '|': [228, 142, 102], // copper pipe highlight

  // Barotrauma Gauges & Hazard Markings
  '=': [244, 188, 24], // hazard caution yellow
  '+': [228, 44, 44], // alarm / emergency valve red
  q: [48, 208, 96], // power green indicator

  // One Piece Grand Gourmet Culinary Tones
  '@': [142, 26, 28], // raw meat / deep wine
  '#': [194, 48, 52], // roast meat / red fabric
  '{': [178, 94, 42], // baked bread crust / savory roast
  '}': [236, 158, 72], // cheese / golden pastry
  H: [248, 118, 32], // bright tangerine orange
  j: [255, 178, 64], // juicy citrus / egg yolk
  T: [112, 38, 48], // vintage wine bottle glass
  t: [158, 58, 70],

  // Aquarium & Sea Creatures
  '*': [14, 42, 74], // deep aquarium abyss
  '(': [28, 92, 138], // aquarium clear water
  ')': [56, 156, 198], // illuminated aquarium cyan
  Q: [102, 222, 244], // bioluminescent / caustic glint

  // Medical Clinic & Science
  ';': [210, 228, 238], // sterile clinic linen
  ':': [148, 68, 178], // apothecary purple tincture
  E: [76, 174, 158], // clinical teal potion
  '?': [242, 236, 218], // parchment scroll / ivory

  // Lawn & Botanical Greenery
  k: [32, 72, 42], // lawn turf shadow
  K2: [52, 114, 62], // lush grass
  y: [86, 172, 78], // bright grass blade
  Y2: [136, 212, 108] // sunlit clover
}
