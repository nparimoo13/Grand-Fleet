import type { ShipDef } from '../../shared/types/crew'
import { PixelCanvas, type Color } from '../lib/canvas'
import { encodePng } from '../lib/raster'

// =============================================================================
// COLOR PALETTE (Barotrauma Industrial Steel & Grand Gourmet Charm)
// =============================================================================
const C_INK = [14, 12, 18, 255] as const
const C_STEEL_DARK = [24, 30, 40, 255] as const
const C_STEEL_MID = [50, 62, 80, 255] as const
const C_STEEL_LIGHT = [92, 108, 132, 255] as const
const C_STEEL_HI = [164, 182, 210, 255] as const
const C_RIVET = [204, 220, 244, 255] as const

// Wood tones (Aged Oak, Teak, Rich Mahogany)
const C_WOOD_SHADOW = [36, 22, 14, 255] as const
const C_WOOD_DARK = [64, 40, 26, 255] as const
const C_WOOD_MID = [114, 72, 46, 255] as const
const C_WOOD_LIGHT = [168, 114, 72, 255] as const
const C_WOOD_HI = [218, 164, 116, 255] as const
const C_DECK_PLANK = [156, 114, 78, 255] as const
const C_DECK_SEAM = [84, 58, 38, 255] as const

// Armored Copper Sheathing
const C_COPPER_DARK = [84, 36, 24, 255] as const
const C_COPPER_MID = [138, 62, 40, 255] as const
const C_COPPER_LIGHT = [190, 96, 64, 255] as const
const C_COPPER_HI = [236, 144, 108, 255] as const

// Nautical Brass & Gold
const C_BRONZE_DARK = [94, 64, 20, 255] as const
const C_BRASS_MID = [182, 132, 34, 255] as const
const C_BRASS_LIGHT = [226, 180, 52, 255] as const
const C_GOLD_HI = [255, 226, 98, 255] as const

// Conduits & Hazard Markings
const C_PIPE_RED_MID = [186, 44, 44, 255] as const
const C_PIPE_RED_HI = [240, 112, 112, 255] as const
const C_PIPE_BLUE_MID = [42, 114, 178, 255] as const
const C_PIPE_BLUE_HI = [102, 178, 238, 255] as const
const C_HAZARD_YELLOW = [248, 204, 28, 255] as const
const C_HAZARD_BLACK = [22, 22, 24, 255] as const

// Glow colors for radial lighting
const GLOW_AMBER: readonly [number, number, number] = [255, 186, 68]
const GLOW_CYAN: readonly [number, number, number] = [54, 222, 255]
const GLOW_AQUA: readonly [number, number, number] = [42, 172, 224]
const GLOW_GREEN: readonly [number, number, number] = [84, 228, 120]
const GLOW_CLINIC: readonly [number, number, number] = [214, 238, 255]

// =============================================================================
// NAUTICAL HULL CONTOURS
// =============================================================================
function getHullOuterBounds(y: number, w: number): [number, number] {
  const hullTopY = 144
  const hullKeelY = 458

  if (y < hullTopY || y > hullKeelY) {
    return [0, 0]
  }

  const t = (y - hullTopY) / (hullKeelY - hullTopY)

  let bowX: number
  if (t < 0.2) {
    bowX = 18 + (t / 0.2) * 6
  } else if (t < 0.6) {
    const swellT = (t - 0.2) / 0.4
    bowX = 24 + Math.sin(swellT * Math.PI) * 12
  } else {
    const keelT = (t - 0.6) / 0.4
    bowX = Math.round(36 + (1 - Math.cos(keelT * Math.PI * 0.5)) * 78)
  }

  let sternX: number
  if (t < 0.35) {
    const aftT = t / 0.35
    sternX = Math.round(864 + Math.sin(aftT * Math.PI) * 14)
  } else if (t < 0.7) {
    const tuckT = (t - 0.35) / 0.35
    sternX = Math.round(874 - tuckT * 34)
  } else {
    const propT = (t - 0.7) / 0.3
    sternX = Math.round(840 - propT * 60)
  }

  return [bowX, sternX]
}

// =============================================================================
// 1. SKY, CLOUDS, OCEAN, & SEARCHLIGHT
// =============================================================================
function drawEnvironment(canvas: PixelCanvas, w: number, h: number, waterY: number): void {
  for (let y = 0; y < waterY; y++) {
    const t = y / waterY
    const r = Math.round(96 + t * 94)
    const g = Math.round(168 + t * 54)
    const b = Math.round(226 + t * 22)
    canvas.drawHLine(0, w - 1, y, [r, g, b, 255])
  }

  const clouds = [
    { y: 16, h: 22, x0: 20, x1: 340, a: 90 },
    { y: 30, h: 26, x0: 440, x1: 850, a: 85 },
    { y: 64, h: 18, x0: 90, x1: 490, a: 60 },
    { y: 86, h: 16, x0: 540, x1: 880, a: 50 }
  ]
  for (const c of clouds) {
    for (let cy = c.y; cy < c.y + c.h; cy++) {
      const prog = (cy - c.y) / c.h
      const alpha = Math.round(Math.sin(prog * Math.PI) * c.a)
      canvas.drawHLine(c.x0, c.x1, cy, [255, 255, 255, alpha])
    }
  }

  const islandY = waterY - 14
  for (let ix = 0; ix < 130; ix++) {
    const ih = Math.round(Math.sin((ix / 130) * Math.PI) * 16)
    canvas.drawVLine(ix, islandY - ih, islandY, [52, 114, 100, 190])
  }
  for (let ix = w - 160; ix < w; ix++) {
    const ih = Math.round(Math.sin(((ix - (w - 160)) / 160) * Math.PI) * 20)
    canvas.drawVLine(ix, islandY - ih, islandY, [56, 120, 106, 180])
  }

  for (let y = waterY; y < h; y++) {
    const t = (y - waterY) / (h - waterY)
    const r = Math.round(24 - t * 14)
    const g = Math.round(66 - t * 38)
    const b = Math.round(116 - t * 56)
    canvas.drawHLine(0, w - 1, y, [r, g, b, 255])
  }

  for (let x = 0; x < w; x++) {
    const wave = Math.sin(x * 0.07) * 3 + Math.sin(x * 0.02) * 2
    const wy = Math.floor(waterY + wave)
    canvas.setPixel(x, wy, 180, 234, 248, 255)
    canvas.setPixel(x, wy + 1, 114, 186, 222, 235)
    canvas.setPixel(x, wy + 2, 60, 126, 172, 195)
    if ((x + wy) % 28 === 0) {
      canvas.blendPixel(x, wy + 8, 80, 200, 240, 90)
      canvas.blendPixel(x + 1, wy + 8, 80, 200, 240, 90)
    }
  }

  canvas.drawSpotlightCone(36, waterY + 20, 0, waterY + 80, 160, 0.45, [140, 230, 255], 75)
}

// =============================================================================
// 2. MASTS, YARDS, RIGGING, & PIRATE ENSIGN
// =============================================================================
function drawMastsAndRigging(canvas: PixelCanvas, w: number): void {
  const masts = [
    { x: 424, y0: 16, y1: 416, w: 14, name: 'Main Mast' },
    { x: 672, y0: 56, y1: 416, w: 10, name: 'Mizzen Mast' }
  ]

  for (const mast of masts) {
    for (let mx = 0; mx < mast.w; mx++) {
      const shade =
        mx === 0 ? C_INK : mx < 3 ? C_WOOD_DARK : mx < mast.w - 3 ? C_WOOD_MID : C_WOOD_HI
      canvas.drawVLine(mast.x + mx, mast.y0, mast.y1, shade)
    }
    for (let my = mast.y0 + 16; my < mast.y1; my += 32) {
      canvas.drawBeveledBox(mast.x - 1, my, mast.w + 2, 4, C_STEEL_MID, C_STEEL_HI, C_STEEL_DARK)
    }
    for (let my = mast.y0 + 36; my < 220; my += 10) {
      canvas.drawHLine(mast.x - 14, mast.x, my, [134, 96, 64, 210])
      canvas.drawHLine(mast.x + mast.w, mast.x + mast.w + 14, my, [134, 96, 64, 210])
    }
    const yards = [mast.y0 + 32, mast.y0 + 90]
    for (const yy of yards) {
      if (yy > 200) continue
      const yw = mast.w === 14 ? 130 : 86
      canvas.drawBeveledBox(mast.x - yw / 2, yy, yw, 6, C_WOOD_DARK, C_WOOD_HI, C_INK)
      canvas.drawBeveledBox(
        mast.x - yw / 2 + 6,
        yy + 6,
        yw - 12,
        13,
        [236, 224, 202, 255],
        [255, 250, 240, 255],
        [168, 144, 118, 255]
      )
      for (let rx = mast.x - yw / 2 + 16; rx < mast.x + yw / 2 - 10; rx += 16) {
        canvas.drawVLine(rx, yy + 4, yy + 20, [112, 80, 54, 255])
      }
    }
  }

  // Flying Pirate Flag atop main mast
  const flagX = 438
  const flagY = 12
  const flagW = 34
  const flagH = 22
  canvas.drawBeveledBox(flagX, flagY, flagW, flagH, [28, 24, 28, 255], [68, 58, 68, 255], C_INK)
  canvas.fillRect(flagX + 10, flagY + 4, 14, 14, C_BRASS_LIGHT)
  canvas.fillRect(flagX + 13, flagY + 7, 8, 8, [228, 48, 42, 255])
  canvas.setPixel(flagX + 16, flagY + 10, 255, 240, 160, 255)

  for (let s = 0; s < 5; s++) {
    const rx0 = 424 - 110 + s * 18
    const rx1 = 424 + 14 + 110 - s * 18
    canvas.drawLine(424 + 7, 60, rx0, 224, [58, 42, 32, 190])
    canvas.drawLine(424 + 7, 60, rx1, 224, [58, 42, 32, 190])
  }

  canvas.drawLine(20, 146, 144, 178, C_WOOD_DARK)
  canvas.drawLine(20, 147, 144, 179, C_WOOD_MID)
  canvas.drawLine(20, 148, 144, 180, C_WOOD_HI)
  canvas.drawLine(20, 149, 144, 181, C_INK)
}

// =============================================================================
// 3. CURVED HULL SILHOUETTE & MULTI-LAYER ARMOR
// =============================================================================
function drawHullAndArmor(canvas: PixelCanvas, w: number, h: number, waterY: number): void {
  const hullTopY = 224
  const hullKeelY = 458

  for (let y = hullTopY; y <= hullKeelY; y++) {
    const [bowX, sternX] = getHullOuterBounds(y, w)
    if (bowX >= sternX) continue

    const isSubmerged = y >= waterY - 8
    const isSeam = y % 8 === 0

    if (isSubmerged) {
      const col = isSeam ? C_COPPER_DARK : y % 16 < 8 ? C_COPPER_MID : C_COPPER_LIGHT
      canvas.fillRect(bowX, y, sternX - bowX + 1, 1, col)
    } else {
      const col = isSeam ? C_WOOD_DARK : y % 16 < 8 ? C_WOOD_MID : C_WOOD_LIGHT
      canvas.fillRect(bowX, y, sternX - bowX + 1, 1, col)
    }

    // Heavy Barotrauma-style multi-layer outer armored rim
    canvas.fillRect(bowX - 4, y, 4, 1, C_INK)
    canvas.fillRect(bowX, y, 3, 1, C_STEEL_DARK)
    canvas.fillRect(bowX + 3, y, 3, 1, C_STEEL_LIGHT)

    canvas.fillRect(sternX - 5, y, 3, 1, C_STEEL_LIGHT)
    canvas.fillRect(sternX - 2, y, 3, 1, C_STEEL_DARK)
    canvas.fillRect(sternX + 1, y, 4, 1, C_INK)

    if (y % 14 === 0) {
      canvas.setPixel(bowX + 1, y, C_RIVET[0], C_RIVET[1], C_RIVET[2], 255)
      canvas.setPixel(sternX - 1, y, C_RIVET[0], C_RIVET[1], C_RIVET[2], 255)
    }
  }

  // Heavy Bottom Keel with iron ballast shoe
  canvas.drawBeveledBox(108, hullKeelY - 8, 668, 16, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
  canvas.drawBeveledBox(108, hullKeelY + 8, 668, 6, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
  for (let kx = 118; kx < 770; kx += 20) {
    canvas.drawBeveledBox(kx, hullKeelY + 2, 4, 4, C_STEEL_MID, C_STEEL_HI, C_STEEL_DARK)
  }

  // Stern Rudder & Propeller Hub
  const rudderX = w - 44
  canvas.drawBeveledBox(rudderX, waterY + 6, 26, 68, C_WOOD_DARK, C_STEEL_LIGHT, C_INK)
  canvas.drawBeveledBox(rudderX - 12, waterY + 40, 12, 12, C_BRASS_MID, C_BRASS_LIGHT, C_BRONZE_DARK)
  canvas.drawBeveledBox(rudderX - 22, waterY + 42, 10, 8, C_BRASS_LIGHT, C_GOLD_HI, C_BRONZE_DARK)
  canvas.drawLine(rudderX - 22, waterY + 28, rudderX - 18, waterY + 64, C_BRASS_LIGHT)

  // Round Brass Portholes along lower hull
  const portholes = [
    { x: 120, y: 280 },
    { x: 390, y: 280 },
    { x: 650, y: 280 },
    { x: 740, y: 280 },
    { x: 770, y: 280 }
  ]
  for (const p of portholes) {
    canvas.drawBeveledBox(p.x - 6, p.y - 6, 12, 12, C_BRASS_MID, C_BRASS_LIGHT, C_INK)
    canvas.fillRect(p.x - 4, p.y - 4, 8, 8, [130, 206, 240, 255])
    canvas.setPixel(p.x - 2, p.y - 2, 255, 255, 255, 255)
  }
}

// =============================================================================
// 4. BAROTRAUMA HEAVY STEEL BULKHEADS, UTILITY CONDUITS, & LADDERS
// =============================================================================
function drawBulkheadsAndDecks(canvas: PixelCanvas, ship: ShipDef): void {
  const { tileSize } = ship
  const deckLevels = [224, 320, 416]

  // Horizontal heavy I-beam deck partitions
  for (const dy of deckLevels) {
    canvas.drawBeveledBox(144, dy - 6, 704, 6, C_STEEL_DARK, C_STEEL_HI, C_INK)
    for (let rx = 150; rx < 848; rx += 16) {
      canvas.setPixel(rx, dy - 4, C_RIVET[0], C_RIVET[1], C_RIVET[2], 255)
    }
    canvas.fillRect(144, dy, 704, 4, C_DECK_PLANK)
    canvas.drawHLine(144, 848, dy + 3, C_DECK_SEAM)
  }

  // Deck 0 Floor Beam
  canvas.drawBeveledBox(16, 220, 840, 6, C_STEEL_DARK, C_STEEL_HI, C_INK)
  canvas.fillRect(16, 224, 840, 4, C_DECK_PLANK)
  canvas.drawHLine(16, 856, 227, C_DECK_SEAM)

  // Utility piping runs along ceilings
  canvas.drawPipeH(144, 800, 230, 3, C_PIPE_RED_MID, C_PIPE_RED_HI, C_INK, 44)
  canvas.drawPipeH(144, 800, 326, 3, C_COPPER_MID, C_COPPER_HI, C_INK, 52)
  canvas.drawPipeH(144, 544, 330, 2, C_PIPE_BLUE_MID, C_PIPE_BLUE_HI, C_INK, 64)

  // Room bulkheads with corner gussets and airlocks
  for (const room of ship.rooms.filter((r) => !r.pixelOnly)) {
    if (room.deck === 0 && room.id !== 'crows_nest') continue

    const rx = room.rect.x * tileSize
    const ry = room.rect.y * tileSize
    const rw = room.rect.w * tileSize
    const rh = room.rect.h * tileSize

    canvas.drawBeveledBox(rx, ry, 6, rh, C_STEEL_DARK, C_STEEL_HI, C_INK)
    canvas.drawBeveledBox(rx + rw - 6, ry, 6, rh, C_STEEL_DARK, C_STEEL_HI, C_INK)

    const gusset = 10
    for (let i = 0; i < gusset; i++) {
      canvas.drawHLine(rx + 6, rx + 6 + (gusset - i), ry + i, C_STEEL_DARK)
      canvas.drawHLine(rx + rw - 6 - (gusset - i), rx + rw - 6, ry + i, C_STEEL_DARK)
      canvas.drawHLine(rx + 6, rx + 6 + (gusset - i), ry + rh - 1 - i, C_STEEL_DARK)
      canvas.drawHLine(rx + rw - 6 - (gusset - i), rx + rw - 6, ry + rh - 1 - i, C_STEEL_DARK)
    }

    for (let vy = ry + 12; vy < ry + rh - 12; vy += 14) {
      canvas.setPixel(rx + 2, vy, C_RIVET[0], C_RIVET[1], C_RIVET[2], 255)
      canvas.setPixel(rx + rw - 4, vy, C_RIVET[0], C_RIVET[1], C_RIVET[2], 255)
    }

    // Watertight bulkhead door at right boundary
    const doorY = ry + rh - 38
    canvas.drawBeveledBox(rx + rw - 6, doorY, 6, 32, C_STEEL_MID, C_STEEL_HI, C_INK)
    canvas.fillRect(rx + rw - 5, doorY + 12, 4, 8, C_BRASS_MID)
    canvas.setPixel(rx + rw - 3, doorY + 2, 48, 220, 72, 255)
  }

  // Vertical ladder shafts
  const ladderShafts = [
    { x: 340, y0: 160, y1: 320 },
    { x: 308, y0: 240, y1: 416 },
    { x: 620, y0: 160, y1: 320 },
    { x: 552, y0: 240, y1: 416 },
    { x: 420, y0: 28, y1: 160 }
  ]
  for (const shaft of ladderShafts) {
    const lx = shaft.x
    canvas.drawVLine(lx, shaft.y0, shaft.y1, C_STEEL_DARK)
    canvas.drawVLine(lx + 1, shaft.y0, shaft.y1, C_STEEL_HI)
    canvas.drawVLine(lx + 16, shaft.y0, shaft.y1, C_STEEL_HI)
    canvas.drawVLine(lx + 17, shaft.y0, shaft.y1, C_STEEL_DARK)

    for (let ly = shaft.y0 + 4; ly < shaft.y1; ly += 8) {
      canvas.drawHLine(lx + 1, lx + 16, ly, C_STEEL_HI)
      canvas.drawHLine(lx + 1, lx + 16, ly + 1, C_STEEL_DARK)
    }

    canvas.drawBeveledBox(lx - 4, shaft.y0 - 2, 26, 4, C_STEEL_LIGHT, C_STEEL_HI, C_INK)
    canvas.drawBeveledBox(lx + 8, shaft.y0 - 6, 6, 4, C_BRASS_MID, C_BRASS_LIGHT, C_BRONZE_DARK)
  }
}

// =============================================================================
// 5. ONE PIECE GRAND GOURMET ROOM INTERIORS & WEATHER DECKS
// =============================================================================
function drawAllRoomsAndDecks(canvas: PixelCanvas, ship: ShipDef): void {
  const { tileSize } = ship

  // 1. Weather Deck between Lawn and Helm (x: 368..704, y: 144..224)
  const weatherX = 368
  const weatherW = 336
  const weatherFloorY = 220

  // Grand Gourmet Scalloped Canvas Awning
  const awningX = weatherX + 24
  const awningW = 120
  const awningY = 148
  for (let ax = awningX; ax < awningX + awningW; ax += 12) {
    const col = (ax - awningX) % 24 < 12 ? [240, 238, 230, 255] : [214, 52, 48, 255]
    canvas.fillRect(ax, awningY, 12, 16, col as [number, number, number, number])
    canvas.strokeRect(ax, awningY, 12, 16, C_INK)
  }

  // Outdoor Café Dining Table with White Tablecloth
  const cafeX = weatherX + 46
  const cafeY = weatherFloorY - 24
  canvas.drawBeveledBox(cafeX, cafeY, 36, 6, [248, 248, 252, 255], [255, 255, 255, 255], [190, 190, 205, 255])
  canvas.fillRect(cafeX + 16, cafeY + 6, 4, 18, C_WOOD_DARK)
  canvas.fillRect(cafeX + 10, weatherFloorY - 2, 16, 2, C_WOOD_DARK)
  canvas.fillRect(cafeX + 6, cafeY - 8, 6, 8, [245, 180, 48, 255])
  canvas.fillRect(cafeX + 18, cafeY - 6, 10, 6, [228, 140, 64, 255])
  canvas.drawBeveledBox(cafeX - 10, weatherFloorY - 22, 8, 22, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
  canvas.drawBeveledBox(cafeX + 38, weatherFloorY - 22, 8, 22, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)

  // Naval 18-Pounder Cannon on Wheeled Wooden Carriage
  const cannonX = 530
  const cannonY = weatherFloorY - 18
  canvas.drawBeveledBox(cannonX, cannonY + 6, 30, 12, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
  canvas.drawBeveledBox(cannonX + 2, cannonY + 12, 8, 8, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
  canvas.drawBeveledBox(cannonX + 20, cannonY + 12, 8, 8, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
  canvas.drawBeveledBox(cannonX - 4, cannonY + 2, 38, 8, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
  canvas.drawBeveledBox(cannonX + 32, cannonY, 6, 12, C_STEEL_LIGHT, C_STEEL_HI, C_INK)
  canvas.fillRect(cannonX - 16, weatherFloorY - 10, 10, 10, C_STEEL_DARK)
  canvas.strokeRect(cannonX - 16, weatherFloorY - 10, 10, 10, C_INK)

  // Brass Ship's Bell
  const bellX = 650
  const bellY = 176
  canvas.drawBeveledBox(bellX, bellY, 4, 40, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
  canvas.drawBeveledBox(bellX + 16, bellY, 4, 40, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
  canvas.drawBeveledBox(bellX - 2, bellY, 24, 5, C_WOOD_LIGHT, C_WOOD_HI, C_INK)
  canvas.drawBeveledBox(bellX + 5, bellY + 6, 10, 12, C_BRASS_LIGHT, C_GOLD_HI, C_BRONZE_DARK)
  canvas.drawVLine(bellX + 10, bellY + 18, bellY + 26, [210, 210, 210, 255])

  // Cargo Grating Skylight
  const grateX = 460
  canvas.fillRect(grateX, weatherFloorY - 4, 48, 4, C_STEEL_DARK)
  for (let gx = grateX + 2; gx < grateX + 46; gx += 4) {
    canvas.setPixel(gx, weatherFloorY - 3, 240, 210, 60, 255)
  }

  // 2. Captain's Stateroom & Bunkroom on Deck 1 right of Library (x: 624..860, y: 240..320)
  const bunkFloorY = 314
  const bunkX = 644
  const bunkW = 68
  const bunkH = 64
  const bunkY = bunkFloorY - bunkH

  // Ornate two-tier built-in wooden bunk bed with carved posts
  canvas.drawBeveledBox(bunkX, bunkY, bunkW, bunkH, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
  // Lower bunk mattress, pillow, and folded red blanket
  canvas.drawBeveledBox(bunkX + 6, bunkFloorY - 26, bunkW - 12, 12, [226, 230, 240, 255], [255, 255, 255, 255], [178, 184, 198, 255])
  canvas.drawBeveledBox(bunkX + 20, bunkFloorY - 26, bunkW - 26, 12, [198, 46, 52, 255], [240, 92, 98, 255], [134, 26, 30, 255])
  canvas.drawBeveledBox(bunkX + 8, bunkFloorY - 24, 12, 8, [250, 250, 255, 255], [255, 255, 255, 255], [200, 204, 218, 255])

  // Upper bunk mattress, pillow, and folded blue blanket
  canvas.drawBeveledBox(bunkX + 6, bunkY + 8, bunkW - 12, 12, [226, 230, 240, 255], [255, 255, 255, 255], [178, 184, 198, 255])
  canvas.drawBeveledBox(bunkX + 20, bunkY + 8, bunkW - 26, 12, [46, 114, 188, 255], [96, 164, 238, 255], [28, 74, 134, 255])
  canvas.drawBeveledBox(bunkX + 8, bunkY + 10, 12, 8, [250, 250, 255, 255], [255, 255, 255, 255], [200, 204, 218, 255])

  // Brass bedpost ladder
  canvas.drawVLine(bunkX + bunkW - 10, bunkY, bunkFloorY, C_BRASS_LIGHT)
  for (let by = bunkY + 8; by < bunkFloorY; by += 10) {
    canvas.drawHLine(bunkX + bunkW - 14, bunkX + bunkW - 6, by, C_BRASS_LIGHT)
  }

  // Hanging coat hooks with Luffy's pirate jacket & Robin's sunhat
  canvas.fillRect(bunkX - 12, bunkY + 12, 8, 3, C_WOOD_LIGHT)
  canvas.fillRect(bunkX - 10, bunkY + 15, 6, 14, [198, 46, 52, 255]) // Red vest
  canvas.fillRect(bunkX - 11, bunkY + 32, 8, 3, C_WOOD_LIGHT)
  canvas.fillRect(bunkX - 12, bunkY + 35, 10, 8, [240, 196, 68, 255]) // Straw hat brim

  // Ornate Stern Gallery Windows overlooking sea wake (x: 780..860)
  const galleryX = 780
  const galleryY = 246
  canvas.drawBeveledBox(galleryX, galleryY, 74, 62, [36, 48, 64, 255], C_WOOD_HI, C_INK)
  for (let panX = galleryX + 4; panX < galleryX + 70; panX += 14) {
    canvas.fillRect(panX, galleryY + 4, 10, 54, [160, 220, 245, 220])
    canvas.strokeRect(panX, galleryY + 4, 10, 54, C_WOOD_DARK)
    for (let my = galleryY + 12; my < galleryY + 54; my += 14) {
      canvas.drawHLine(panX, panX + 9, my, C_INK)
    }
  }

  // Hanging hammock & sailor footlocker
  const hamX = 726
  canvas.drawLine(hamX, 254, hamX + 22, 282, [214, 194, 162, 255])
  canvas.drawLine(hamX + 22, 282, hamX + 44, 254, [214, 194, 162, 255])
  canvas.fillRect(hamX + 14, 276, 16, 8, [226, 208, 178, 255])
  canvas.drawBeveledBox(734, bunkFloorY - 14, 22, 14, C_WOOD_LIGHT, C_WOOD_HI, C_WOOD_DARK)
  canvas.fillRect(742, bunkFloorY - 9, 6, 4, C_BRASS_LIGHT)

  // 3. Coup de Burst Propulsion Chamber & Ballast on Deck 2 (x: 752..860, y: 336..416)
  const propRoomX = 756
  const propFloorY = 410
  canvas.drawBeveledBox(propRoomX, 342, 98, propFloorY - 342, [36, 42, 54, 255], C_STEEL_HI, C_INK)
  canvas.drawPipeH(propRoomX, propRoomX + 90, 372, 8, C_BRASS_MID, C_BRASS_LIGHT, C_BRONZE_DARK, 28)
  canvas.drawBeveledBox(propRoomX + 24, 346, 28, 22, C_STEEL_DARK, C_STEEL_HI, C_INK)
  canvas.drawBeveledBox(propRoomX + 58, 346, 28, 22, C_STEEL_DARK, C_STEEL_HI, C_INK)
  canvas.setPixel(propRoomX + 38, 356, 48, 220, 72, 255)
  canvas.setPixel(propRoomX + 72, 356, 240, 48, 48, 255)
  canvas.drawBeveledBox(propRoomX + 16, propFloorY - 24, 24, 22, C_STEEL_MID, C_STEEL_HI, C_INK)
  canvas.drawPipeV(propRoomX + 26, propFloorY - 24, propFloorY, 4, C_COPPER_MID, C_COPPER_HI, C_INK, 0)

  // Forepeak chain locker (x: 70..144, Deck 2)
  const chainX = 76
  canvas.drawBeveledBox(chainX, 350, 58, 60, [42, 28, 20, 255], [78, 52, 38, 255], C_INK)
  for (let cy = 370; cy < 406; cy += 6) {
    canvas.drawHLine(chainX + 6, chainX + 52, cy, C_STEEL_LIGHT)
    canvas.drawHLine(chainX + 6, chainX + 52, cy + 1, C_STEEL_DARK)
  }

  // 4. Official 10 Rooms from ship.json
  for (const room of ship.rooms.filter((r) => !r.pixelOnly)) {
    const rx = room.rect.x * tileSize
    const ry = room.rect.y * tileSize
    const rw = room.rect.w * tileSize
    const rh = room.rect.h * tileSize
    const floorY = ry + rh - 6

    switch (room.id) {
      case 'galley': {
        // --- GALLEY & DINING ROOM (Grand Gourmet centerpiece!) ---
        // Back wall: Cream tile backsplash behind the stove, warm oak shiplap elsewhere
        canvas.fillRect(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), [92, 62, 42, 255])
        canvas.fillRect(rx + 8, floorY - 50, 56, 50, [234, 226, 208, 255])
        for (let tx = rx + 8; tx < rx + 64; tx += 8) {
          canvas.drawVLine(tx, floorY - 50, floorY, [204, 194, 176, 255])
        }
        for (let ty = floorY - 50; ty < floorY; ty += 6) {
          canvas.drawHLine(rx + 8, rx + 64, ty, [204, 194, 176, 255])
        }
        canvas.drawAmbientOcclusion(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), 65)

        // Sanji's Heavy Cast-Iron Commercial Range Stove
        const stoveX = rx + 14
        const stoveW = 44
        const stoveH = 34
        const stoveY = floorY - stoveH

        canvas.drawBeveledBox(stoveX, stoveY, stoveW, stoveH, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
        canvas.fillRect(stoveX + 6, stoveY + 16, 16, 12, [36, 20, 18, 255])
        canvas.fillRect(stoveX + 8, stoveY + 20, 12, 6, [245, 96, 28, 255])
        canvas.setPixel(stoveX + 13, stoveY + 22, 255, 220, 100, 255)
        canvas.fillRect(stoveX + 26, stoveY + 18, 4, 4, C_BRASS_MID)
        canvas.fillRect(stoveX + 34, stoveY + 18, 4, 4, C_BRASS_MID)

        // Copper Stockpot & Sizzling Skillet
        canvas.drawBeveledBox(stoveX + 6, stoveY - 14, 16, 14, C_COPPER_MID, C_COPPER_HI, C_COPPER_DARK)
        canvas.drawHLine(stoveX + 4, stoveX + 23, stoveY - 13, C_BRASS_LIGHT)
        canvas.drawBeveledBox(stoveX + 24, stoveY - 6, 14, 6, C_STEEL_LIGHT, C_STEEL_HI, C_STEEL_DARK)
        canvas.drawLine(stoveX + 38, stoveY - 4, stoveX + 46, stoveY - 10, C_STEEL_DARK)
        canvas.setPixel(stoveX + 29, stoveY - 4, 255, 210, 40, 255)

        // Stovepipe venting upward
        canvas.drawBeveledBox(stoveX + 32, ry + 6, 8, stoveY - (ry + 6), C_STEEL_DARK, C_STEEL_MID, C_INK)

        // Hanging Copper Pot Rack & Garlic
        canvas.drawHLine(rx + 16, rx + 80, ry + 16, C_STEEL_LIGHT)
        for (let px = rx + 22; px < rx + 75; px += 14) {
          canvas.drawVLine(px, ry + 16, ry + 22, C_STEEL_MID)
          canvas.drawBeveledBox(px - 3, ry + 22, 7, 7, C_COPPER_MID, C_COPPER_HI, C_COPPER_DARK)
        }
        for (let g = 0; g < 4; g++) {
          canvas.setPixel(rx + 78, ry + 20 + g * 4, 240, 238, 224, 255)
          canvas.setPixel(rx + 79, ry + 21 + g * 4, 220, 210, 190, 255)
        }

        // Dining Banquet Table
        const tableX = rx + 84
        const tableW = 86
        const tableY = floorY - 24
        canvas.drawBeveledBox(tableX, tableY, tableW, 6, C_WOOD_LIGHT, C_WOOD_HI, C_WOOD_DARK)
        canvas.drawBeveledBox(tableX + 4, tableY + 6, 6, 18, C_WOOD_DARK, C_WOOD_MID, C_INK)
        canvas.drawBeveledBox(tableX + tableW - 10, tableY + 6, 6, 18, C_WOOD_DARK, C_WOOD_MID, C_INK)
        canvas.drawBeveledBox(tableX - 12, floorY - 28, 10, 28, C_WOOD_DARK, C_WOOD_MID, C_INK)
        canvas.drawBeveledBox(tableX + tableW + 2, floorY - 28, 10, 28, C_WOOD_DARK, C_WOOD_MID, C_INK)

        // GRAND GOURMET FEAST
        const meatX = tableX + 30
        const meatY = tableY - 14
        canvas.drawBeveledBox(meatX, meatY, 26, 14, [178, 42, 38, 255], [228, 82, 74, 255], [112, 24, 22, 255])
        canvas.fillRect(meatX + 4, meatY + 2, 18, 8, [214, 92, 54, 255])
        canvas.fillRect(meatX - 6, meatY + 4, 6, 6, [248, 242, 226, 255])
        canvas.fillRect(meatX + 26, meatY + 4, 6, 6, [248, 242, 226, 255])

        canvas.drawBeveledBox(tableX + 8, tableY - 12, 10, 12, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.fillRect(tableX + 9, tableY - 14, 8, 4, [255, 255, 255, 255])
        canvas.drawBeveledBox(tableX + 66, tableY - 12, 10, 12, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.fillRect(tableX + 67, tableY - 14, 8, 4, [255, 255, 255, 255])

        canvas.drawBeveledBox(tableX + 19, tableY - 8, 8, 8, [248, 194, 52, 255], [255, 230, 96, 255], [184, 134, 28, 255])
        canvas.drawBeveledBox(tableX + 57, tableY - 8, 8, 8, [184, 114, 52, 255], [224, 154, 86, 255], [128, 74, 28, 255])

        canvas.fillRect(tableX + 40, ry + 6, 2, 16, C_STEEL_MID)
        canvas.drawBeveledBox(tableX + 37, ry + 22, 8, 12, C_BRASS_MID, C_BRASS_LIGHT, C_BRONZE_DARK)
        canvas.setPixel(tableX + 40, ry + 27, 255, 240, 180, 255)
        canvas.drawRadialLight(tableX + 40, ry + 28, 84, GLOW_AMBER, 130)
        break
      }

      case 'lawn': {
        // --- LAWN DECK & AQUARIUM BAR ---
        const lawnW = 90
        canvas.fillRect(rx + 6, floorY - 4, lawnW, 4, [48, 124, 56, 255])
        for (let gx = rx + 8; gx < rx + lawnW; gx += 3) {
          const gh = (gx % 5) + 3
          canvas.drawVLine(gx, floorY - 4 - gh, floorY - 4, [82, 178, 68, 255])
        }

        // Nami's Tangerine / Mikan Tree in planter barrel (Kairosoft/Grand Gourmet style fluffy foliage)
        const treeX = rx + 18
        const treeY = floorY - 52
        canvas.drawBeveledBox(treeX + 4, floorY - 16, 18, 16, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.fillRect(treeX + 11, treeY + 16, 4, 18, C_WOOD_DARK)
        // Fluffy layered foliage
        canvas.drawBeveledBox(treeX, treeY, 26, 22, [36, 110, 48, 255], [68, 164, 72, 255], [22, 72, 30, 255])
        canvas.drawBeveledBox(treeX + 4, treeY - 6, 18, 14, [48, 132, 58, 255], [84, 188, 88, 255], [28, 88, 36, 255])
        canvas.fillRect(treeX + 4, treeY + 6, 4, 4, [255, 128, 24, 255])
        canvas.fillRect(treeX + 16, treeY + 5, 4, 4, [255, 128, 24, 255])
        canvas.fillRect(treeX + 9, treeY + 13, 4, 4, [255, 128, 24, 255])
        canvas.fillRect(treeX + 19, treeY + 12, 4, 4, [255, 128, 24, 255])

        // White garden lounge chair
        const chairX = rx + 52
        canvas.drawLine(chairX, floorY - 4, chairX + 16, floorY - 18, [242, 244, 248, 255])
        canvas.drawLine(chairX + 16, floorY - 18, chairX + 28, floorY - 4, [242, 244, 248, 255])
        canvas.drawHLine(chairX + 6, chairX + 22, floorY - 10, [242, 244, 248, 255])

        // Aquarium Bar & Lounge
        const barStartX = rx + 104
        const barW = rw - 110
        const aqW = barW - 12
        canvas.fillRect(barStartX, ry + 8, aqW, floorY - (ry + 8), [18, 54, 94, 255])
        canvas.drawBeveledBox(barStartX, ry + 8, aqW, floorY - (ry + 8), [18, 54, 94, 255], C_STEEL_HI, C_INK)
        for (let ay = ry + 12; ay < floorY - 10; ay += 12) {
          canvas.drawHLine(barStartX + 6, barStartX + aqW - 6, ay, [42, 148, 196, 160])
        }
        canvas.fillRect(barStartX + 20, ry + 22, 8, 4, [255, 140, 48, 240])
        canvas.fillRect(barStartX + 52, ry + 36, 10, 4, [240, 220, 60, 240])
        canvas.fillRect(barStartX + 34, ry + 46, 7, 3, [240, 80, 80, 240])

        // Polished Bar Counter
        const barY = floorY - 26
        canvas.drawBeveledBox(barStartX + 10, barY, aqW - 20, 8, [142, 54, 32, 255], [194, 88, 58, 255], [84, 28, 18, 255])
        canvas.fillRect(barStartX + 12, barY + 8, aqW - 24, 18, C_WOOD_DARK)
        canvas.drawHLine(barStartX + 10, barStartX + aqW - 10, floorY - 2, C_BRASS_LIGHT)

        for (let bx = barStartX + 20; bx < barStartX + aqW - 25; bx += 24) {
          canvas.fillRect(bx, floorY - 22, 10, 4, [192, 42, 48, 255])
          canvas.drawVLine(bx + 5, floorY - 18, floorY - 2, C_BRASS_LIGHT)
          canvas.drawHLine(bx + 2, bx + 8, floorY - 2, C_BRASS_LIGHT)
        }

        for (let bx = barStartX + 14; bx < barStartX + aqW - 16; bx += 8) {
          const color =
            bx % 3 === 0
              ? [210, 150, 40, 255]
              : bx % 3 === 1
                ? [48, 156, 88, 255]
                : [196, 48, 54, 255]
          canvas.fillRect(bx, barY - 10, 5, 10, color as [number, number, number, number])
          canvas.drawVLine(bx + 2, barY - 14, barY - 10, [220, 220, 240, 255])
        }

        // Upright Saloon Piano
        const pianoX = rx + rw - 38
        const pianoY = floorY - 36
        canvas.drawBeveledBox(pianoX, pianoY, 28, 36, [34, 24, 20, 255], [68, 48, 42, 255], C_INK)
        canvas.fillRect(pianoX + 2, pianoY + 16, 24, 6, [248, 246, 238, 255])
        for (let k = 0; k < 7; k++) {
          canvas.drawVLine(pianoX + 4 + k * 3, pianoY + 16, pianoY + 19, [20, 20, 20, 255])
        }

        canvas.drawRadialLight(barStartX + aqW / 2, ry + 36, 92, GLOW_AQUA, 110)
        break
      }

      case 'engine_room': {
        // --- ENGINE ROOM (Barotrauma Industrial Core) ---
        canvas.fillRect(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), [32, 38, 48, 255])
        canvas.drawAmbientOcclusion(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), 75)
        canvas.fillRect(rx + 6, floorY - 4, rw - 12, 4, C_STEEL_DARK)
        for (let dx = rx + 6; dx < rx + rw - 6; dx += 8) {
          canvas.setPixel(dx, floorY - 3, C_STEEL_LIGHT[0], C_STEEL_LIGHT[1], C_STEEL_LIGHT[2], 255)
        }

        // Triple-Cylinder Cola Boiler Turbine
        const engX = rx + 24
        const engW = 96
        const engH = 54
        const engY = floorY - engH

        canvas.drawBeveledBox(engX, engY, engW, engH, C_STEEL_DARK, C_STEEL_HI, C_INK)

        for (let c = 0; c < 3; c++) {
          const cx = engX + 6 + c * 30
          canvas.drawBeveledBox(cx, engY + 4, 24, engH - 8, [48, 56, 70, 255], C_STEEL_HI, C_STEEL_DARK)
          canvas.drawHLine(cx, cx + 23, engY + 16, C_STEEL_LIGHT)
          canvas.drawHLine(cx, cx + 23, engY + 32, C_STEEL_LIGHT)

          if (c === 1) {
            canvas.drawBeveledBox(cx + 4, engY + 14, 16, 16, [14, 28, 42, 255], C_BRASS_LIGHT, C_BRONZE_DARK)
            canvas.fillRect(cx + 6, engY + 16, 12, 12, [64, 228, 255, 255])
            canvas.fillRect(cx + 8, engY + 18, 8, 8, [180, 255, 255, 255])
          }
        }

        for (let p = 0; p < 3; p++) {
          const px = engX + 16 + p * 30
          canvas.drawPipeV(px, ry + 6, engY, 6, C_COPPER_MID, C_COPPER_HI, C_INK, 0)
          canvas.drawBeveledBox(px - 2, engY - 4, 10, 4, C_BRASS_MID, C_BRASS_LIGHT, C_BRONZE_DARK)
        }

        const gaugeX = rx + rw - 44
        const gaugeY = ry + 16
        canvas.drawBeveledBox(gaugeX, gaugeY, 32, 24, C_STEEL_DARK, C_STEEL_HI, C_INK)
        canvas.drawBeveledBox(gaugeX + 4, gaugeY + 4, 10, 10, [240, 240, 240, 255], C_BRASS_LIGHT, C_BRONZE_DARK)
        canvas.drawLine(gaugeX + 9, gaugeY + 9, gaugeX + 12, gaugeY + 6, [220, 30, 30, 255])

        canvas.drawBeveledBox(gaugeX + 18, gaugeY + 4, 10, 10, [240, 240, 240, 255], C_BRASS_LIGHT, C_BRONZE_DARK)
        canvas.drawLine(gaugeX + 23, gaugeY + 9, gaugeX + 20, gaugeY + 6, [220, 30, 30, 255])

        const hazY = floorY - 6
        for (let hx = engX; hx < engX + engW; hx += 8) {
          canvas.fillRect(hx, hazY, 4, 4, C_HAZARD_YELLOW)
          canvas.fillRect(hx + 4, hazY, 4, 4, C_HAZARD_BLACK)
        }

        const drumX = rx + rw - 34
        canvas.drawBeveledBox(drumX, floorY - 26, 18, 22, [124, 38, 42, 255], [178, 68, 74, 255], C_INK)
        canvas.drawHLine(drumX, drumX + 17, floorY - 18, C_STEEL_LIGHT)

        canvas.drawRadialLight(engX + 48, engY + 22, 98, GLOW_CYAN, 145)
        break
      }

      case 'map_room': {
        // --- NAVIGATOR'S MAP ROOM ---
        canvas.fillRect(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), [104, 68, 44, 255])
        canvas.drawAmbientOcclusion(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), 60)
        canvas.drawBeveledBox(rx + rw - 44, ry + 12, 34, 24, [240, 234, 212, 255], [255, 250, 235, 255], C_WOOD_DARK)
        canvas.fillRect(rx + rw - 38, ry + 18, 8, 5, [64, 138, 188, 255])
        canvas.fillRect(rx + rw - 24, ry + 22, 10, 6, [64, 138, 188, 255])

        const tableX = rx + 16
        const tableW = 54
        const tableY = floorY - 22
        canvas.drawBeveledBox(tableX, tableY, tableW, 6, C_WOOD_LIGHT, C_WOOD_HI, C_WOOD_DARK)
        canvas.drawBeveledBox(tableX + 4, tableY + 6, 6, 16, C_WOOD_DARK, C_WOOD_MID, C_INK)
        canvas.drawBeveledBox(tableX + tableW - 10, tableY + 6, 6, 16, C_WOOD_DARK, C_WOOD_MID, C_INK)

        canvas.drawBeveledBox(tableX + 8, tableY - 4, 38, 6, [244, 236, 212, 255], [255, 250, 235, 255], [178, 154, 120, 255])
        canvas.fillRect(tableX + 14, tableY - 3, 6, 3, [82, 142, 196, 255])
        canvas.fillRect(tableX + 28, tableY - 3, 8, 3, [82, 142, 196, 255])
        canvas.drawLine(tableX + 40, tableY - 8, tableX + 44, tableY - 2, C_BRASS_LIGHT)

        const globeX = rx + rw - 36
        const globeY = floorY - 36
        canvas.fillRect(globeX + 6, floorY - 12, 12, 12, C_WOOD_DARK)
        canvas.drawBeveledBox(globeX + 4, globeY, 16, 16, [48, 110, 168, 255], C_BRASS_LIGHT, C_BRONZE_DARK)
        canvas.setPixel(globeX + 9, globeY + 5, 84, 168, 80, 255)
        canvas.setPixel(globeX + 14, globeY + 8, 84, 168, 80, 255)

        const rackX = rx + 14
        const rackY = ry + 12
        canvas.drawBeveledBox(rackX, rackY, 28, 26, C_WOOD_DARK, C_WOOD_MID, C_INK)
        for (let sy = rackY + 4; sy < rackY + 24; sy += 8) {
          canvas.fillRect(rackX + 4, sy, 20, 4, [240, 230, 205, 255])
          canvas.setPixel(rackX + 20, sy + 1, 184, 42, 38, 255)
        }

        canvas.fillRect(tableX + 4, tableY - 14, 10, 4, [38, 148, 76, 255])
        canvas.drawVLine(tableX + 8, tableY - 10, tableY, C_BRASS_LIGHT)
        canvas.drawRadialLight(tableX + 16, tableY - 6, 60, GLOW_GREEN, 90)
        break
      }

      case 'library': {
        // --- LIBRARY & ARCHIVES ---
        canvas.fillRect(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), [40, 24, 16, 255])
        canvas.drawAmbientOcclusion(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), 70)
        const shelfX = rx + 14
        const shelfW = 58
        const shelfY = ry + 10
        const shelfH = floorY - shelfY
        canvas.drawBeveledBox(shelfX, shelfY, shelfW, shelfH, [48, 28, 18, 255], [84, 48, 32, 255], C_INK)

        for (let tier = 0; tier < 4; tier++) {
          const ty = shelfY + 8 + tier * 15
          canvas.drawHLine(shelfX, shelfX + shelfW - 1, ty, [84, 48, 28, 255])
          for (let bx = shelfX + 3; bx < shelfX + shelfW - 4; bx += 5) {
            const colors = [
              [178, 42, 38, 255],
              [48, 86, 148, 255],
              [42, 124, 76, 255],
              [194, 148, 38, 255],
              [96, 54, 38, 255]
            ]
            const bookColor = colors[(bx + tier) % colors.length] as [number, number, number, number]
            const bh = 10 + (bx % 3)
            canvas.drawBeveledBox(bx, ty - bh, 4, bh, bookColor, [255, 230, 160, 255], C_INK)
          }
        }

        canvas.drawLine(shelfX + 8, shelfY, shelfX + 16, floorY, C_BRASS_LIGHT)
        canvas.drawLine(shelfX + 16, shelfY, shelfX + 24, floorY, C_BRASS_LIGHT)
        for (let ly = shelfY + 8; ly < floorY; ly += 10) {
          canvas.drawHLine(shelfX + 10 + (ly - shelfY) * 0.12, shelfX + 18 + (ly - shelfY) * 0.12, ly, C_BRASS_LIGHT)
        }

        const chairX = rx + rw - 38
        const chairY = floorY - 30
        canvas.drawBeveledBox(chairX, chairY, 26, 30, [148, 32, 38, 255], [198, 54, 62, 255], [88, 16, 22, 255])
        canvas.fillRect(chairX + 4, chairY + 8, 18, 14, [184, 46, 52, 255])
        canvas.drawBeveledBox(chairX - 12, floorY - 18, 10, 4, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.drawVLine(chairX - 7, floorY - 14, floorY, C_WOOD_DARK)
        canvas.fillRect(chairX - 10, floorY - 24, 6, 6, [248, 246, 240, 255])

        canvas.drawRadialLight(chairX + 12, chairY + 8, 68, GLOW_AMBER, 100)
        break
      }

      case 'factory': {
        // --- WORKSHOP FACTORY (Franky / Usopp styling) ---
        canvas.fillRect(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), [44, 36, 32, 255])
        canvas.drawAmbientOcclusion(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), 65)
        const anvilX = rx + 18
        const stumpY = floorY - 16
        canvas.drawBeveledBox(anvilX + 4, stumpY, 20, 16, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.drawBeveledBox(anvilX, stumpY - 12, 28, 12, C_STEEL_DARK, C_STEEL_HI, C_INK)
        canvas.fillRect(anvilX + 28, stumpY - 10, 8, 6, C_STEEL_LIGHT)
        canvas.fillRect(anvilX + 8, stumpY - 16, 12, 4, C_STEEL_LIGHT)
        canvas.drawVLine(anvilX + 14, stumpY - 12, stumpY - 4, C_WOOD_DARK)

        const benchX = rx + 56
        const benchW = 58
        const benchY = floorY - 26
        canvas.drawBeveledBox(benchX, benchY, benchW, 8, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.drawBeveledBox(benchX + 4, benchY + 8, 6, 18, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
        canvas.drawBeveledBox(benchX + benchW - 10, benchY + 8, 6, 18, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
        canvas.drawBeveledBox(benchX + benchW - 6, benchY - 8, 8, 10, C_STEEL_LIGHT, C_STEEL_HI, C_INK)

        const pegX = benchX
        const pegY = ry + 12
        canvas.drawBeveledBox(pegX, pegY, benchW, 26, [58, 42, 32, 255], [88, 64, 52, 255], C_INK)
        canvas.drawBeveledBox(pegX + 4, pegY + 4, 18, 18, [42, 94, 168, 255], [92, 154, 238, 255], C_INK)
        canvas.drawLine(pegX + 28, pegY + 6, pegX + 28, pegY + 20, C_STEEL_MID)
        canvas.drawLine(pegX + 42, pegY + 4, pegX + 48, pegY + 20, C_BRASS_LIGHT)

        const ballX = rx + rw - 34
        canvas.fillRect(ballX + 4, floorY - 10, 10, 10, C_STEEL_DARK)
        canvas.strokeRect(ballX + 4, floorY - 10, 10, 10, C_INK)
        canvas.fillRect(ballX + 16, floorY - 10, 10, 10, C_STEEL_DARK)
        canvas.strokeRect(ballX + 16, floorY - 10, 10, 10, C_INK)
        canvas.fillRect(ballX + 10, floorY - 18, 10, 10, C_STEEL_DARK)
        canvas.strokeRect(ballX + 10, floorY - 18, 10, 10, C_INK)

        canvas.drawRadialLight(benchX + 30, benchY - 10, 70, GLOW_AMBER, 95)
        break
      }

      case 'infirmary': {
        // --- INFIRMARY & CLINIC (Chopper styling) ---
        canvas.fillRect(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), [212, 226, 236, 255])
        canvas.drawAmbientOcclusion(rx + 6, ry + 6, rw - 12, floorY - (ry + 6), 45)
        for (let x = rx + 6; x < rx + rw - 6; x += 12) {
          canvas.drawVLine(x, ry + 6, floorY, [190, 206, 218, 255])
        }

        const bedX = rx + 16
        const bedW = 54
        const bedH = 22
        const bedY = floorY - bedH
        canvas.drawBeveledBox(bedX, bedY + 8, bedW, 6, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.drawBeveledBox(bedX + 2, bedY + 14, 4, 8, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
        canvas.drawBeveledBox(bedX + bedW - 6, bedY + 14, 4, 8, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
        canvas.drawBeveledBox(bedX + 4, bedY + 2, bedW - 8, 8, [224, 236, 246, 255], [255, 255, 255, 255], [180, 196, 212, 255])
        canvas.fillRect(bedX + 6, bedY, 14, 6, [248, 252, 255, 255])
        canvas.fillRect(bedX + 24, bedY + 2, bedW - 28, 7, [74, 154, 188, 255])

        const cabX = rx + 78
        const cabW = 44
        const cabY = ry + 12
        canvas.drawBeveledBox(cabX, cabY, cabW, 46, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        for (let s = 0; s < 3; s++) {
          const sy = cabY + 12 + s * 12
          canvas.drawHLine(cabX + 4, cabX + cabW - 5, sy, [180, 210, 230, 200])
          canvas.fillRect(cabX + 6, sy - 8, 5, 8, [184, 54, 172, 255])
          canvas.fillRect(cabX + 16, sy - 8, 5, 8, [42, 186, 162, 255])
          canvas.fillRect(cabX + 26, sy - 8, 5, 8, [242, 164, 42, 255])
          canvas.fillRect(cabX + 34, sy - 6, 5, 6, [248, 246, 240, 255])
        }

        const deskX = rx + rw - 58
        const deskY = floorY - 24
        canvas.drawBeveledBox(deskX, deskY, 48, 6, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.drawBeveledBox(deskX + 4, deskY + 6, 6, 18, C_WOOD_DARK, C_WOOD_MID, C_INK)
        canvas.drawBeveledBox(deskX + 38, deskY + 6, 6, 18, C_WOOD_DARK, C_WOOD_MID, C_INK)
        canvas.fillRect(deskX + 12, deskY - 16, 6, 16, C_BRASS_LIGHT)
        canvas.fillRect(deskX + 8, deskY - 2, 14, 3, C_STEEL_DARK)
        canvas.fillRect(deskX + 30, deskY - 8, 10, 8, [178, 186, 196, 255])
        canvas.drawLine(deskX + 36, deskY - 12, deskX + 32, deskY - 4, C_WOOD_DARK)

        canvas.drawRadialLight(bedX + 28, bedY + 6, 72, GLOW_CLINIC, 85)
        break
      }

      case 'helm': {
        // --- HELM & QUARTERDECK (Open-Air Quarterdeck!) ---
        canvas.fillRect(rx + 6, floorY - 6, rw - 12, 6, C_DECK_PLANK)
        canvas.drawHLine(rx + 6, rx + rw - 6, floorY, C_DECK_SEAM)

        // Grand 8-Spoke Ship's Wheel
        const wheelX = rx + 36
        const wheelY = floorY - 38
        const rad = 16
        canvas.drawBeveledBox(wheelX - 3, wheelY - 3, 7, 7, C_BRASS_MID, C_BRASS_LIGHT, C_BRONZE_DARK)
        canvas.strokeRect(wheelX - rad, wheelY - rad, rad * 2, rad * 2, C_WOOD_DARK)
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4
          const sx = Math.round(wheelX + Math.cos(ang) * (rad + 4))
          const sy = Math.round(wheelY + Math.sin(ang) * (rad + 4))
          canvas.drawLine(wheelX, wheelY, sx, sy, C_WOOD_MID)
          canvas.setPixel(sx, sy, C_GOLD_HI[0], C_GOLD_HI[1], C_GOLD_HI[2], 255)
        }
        canvas.drawBeveledBox(wheelX - 4, wheelY + rad, 8, floorY - (wheelY + rad), C_WOOD_DARK, C_WOOD_LIGHT, C_INK)

        // Binnacle Compass Pedestal
        const binX = wheelX + 28
        const binY = floorY - 26
        canvas.drawBeveledBox(binX, binY, 14, 26, C_WOOD_DARK, C_BRASS_LIGHT, C_INK)
        canvas.fillRect(binX + 3, binY + 3, 8, 8, [240, 245, 255, 255])
        canvas.setPixel(binX + 7, binY + 5, 220, 40, 40, 255)
        canvas.setPixel(binX + 7, binY + 8, 40, 40, 220, 255)

        for (let bx = rx + rw - 28; bx < rx + rw - 6; bx += 6) {
          canvas.drawVLine(bx, floorY - 22, floorY, C_WOOD_LIGHT)
        }
        canvas.drawHLine(rx + rw - 30, rx + rw - 6, floorY - 22, C_WOOD_DARK)

        canvas.drawRadialLight(wheelX, wheelY, 74, GLOW_AMBER, 110)
        break
      }

      case 'crows_nest': {
        // --- CROW'S NEST GYM (Zoro styling) ---
        // Curved wooden crow's nest barrel platform directly on the mast
        const nestX = rx + 8
        const nestY = ry + 8
        const nestW = rw - 16
        const nestH = rh - 16

        canvas.drawBeveledBox(nestX, nestY, nestW, nestH, [84, 56, 38, 255], [128, 92, 64, 255], C_INK)
        canvas.drawAmbientOcclusion(nestX, nestY, nestW, nestH, 50)

        // Arched lookout windows
        for (let wx = nestX + 10; wx < nestX + nestW - 22; wx += 24) {
          canvas.drawBeveledBox(wx, nestY + 6, 20, 24, [190, 228, 246, 220], [255, 255, 255, 255], C_WOOD_DARK)
          canvas.drawVLine(wx + 9, nestY + 6, nestY + 30, C_WOOD_DARK)
        }

        // Zoro's Heavy Iron Squat Rack with massive barbell
        const barX = nestX + 22
        const barY = floorY - 24
        canvas.drawVLine(barX, barY, floorY, C_STEEL_DARK)
        canvas.drawVLine(barX + 54, barY, floorY, C_STEEL_DARK)
        canvas.drawHLine(barX - 12, barX + 66, barY - 2, C_STEEL_HI)
        canvas.drawBeveledBox(barX - 10, barY - 14, 8, 24, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)
        canvas.drawBeveledBox(barX + 56, barY - 14, 8, 24, C_STEEL_DARK, C_STEEL_LIGHT, C_INK)

        const benchX = nestX + 34
        canvas.drawBeveledBox(benchX, floorY - 10, 28, 6, [34, 112, 54, 255], [68, 168, 92, 255], C_INK)
        canvas.fillRect(benchX + 6, floorY - 12, 10, 4, [245, 245, 245, 255])

        // Katana Sword Stand with 3 swords!
        const swordX = nestX + nestW - 36
        const swordY = floorY - 32
        canvas.drawBeveledBox(swordX, swordY, 26, 30, C_WOOD_DARK, C_WOOD_LIGHT, C_INK)
        canvas.drawHLine(swordX + 2, swordX + 23, swordY + 6, [245, 245, 245, 255])
        canvas.drawHLine(swordX + 2, swordX + 23, swordY + 14, [178, 42, 42, 255])
        canvas.drawHLine(swordX + 2, swordX + 23, swordY + 22, [42, 42, 42, 255])

        const scopeX = nestX + 12
        const scopeY = floorY - 34
        canvas.drawLine(scopeX, scopeY, scopeX - 8, floorY, C_BRASS_LIGHT)
        canvas.drawLine(scopeX, scopeY, scopeX + 8, floorY, C_BRASS_LIGHT)
        canvas.drawBeveledBox(scopeX - 4, scopeY - 4, 20, 6, C_BRASS_LIGHT, C_GOLD_HI, C_BRONZE_DARK)
        canvas.setPixel(scopeX + 16, scopeY - 2, 220, 240, 255, 255)
        break
      }

      case 'figurehead': {
        // --- FIGUREHEAD DECK & GOLDEN LION ---
        // Forecastle open-air prow deck
        canvas.fillRect(rx + 6, floorY - 4, rw - 12, 4, C_DECK_PLANK)
        canvas.drawHLine(rx + 6, rx + rw - 6, floorY, C_DECK_SEAM)

        for (let bx = rx + 38; bx < rx + rw - 6; bx += 10) {
          canvas.drawVLine(bx, floorY - 18, floorY, C_WOOD_LIGHT)
        }
        canvas.drawHLine(rx + 36, rx + rw - 6, floorY - 18, C_WOOD_DARK)

        // Splendid 3D-Shaded Thousand Sunny Golden Lion Head Figurehead
        const lionX = 14
        const lionY = floorY - 62

        const petals = [
          [lionX + 6, lionY],
          [lionX + 20, lionY - 4],
          [lionX + 34, lionY],
          [lionX + 42, lionY + 12],
          [lionX + 44, lionY + 26],
          [lionX + 38, lionY + 38],
          [lionX + 24, lionY + 44],
          [lionX + 8, lionY + 42],
          [lionX, lionY + 30],
          [lionX, lionY + 14]
        ]
        for (const [px, py] of petals) {
          canvas.drawBeveledBox(px - 5, py - 5, 11, 11, C_BRASS_LIGHT, C_GOLD_HI, C_BRONZE_DARK)
        }

        canvas.drawBeveledBox(lionX + 8, lionY + 8, 30, 30, C_BRASS_LIGHT, C_GOLD_HI, C_BRONZE_DARK)
        canvas.fillRect(lionX + 13, lionY + 16, 5, 7, C_INK)
        canvas.setPixel(lionX + 14, lionY + 17, 255, 255, 255, 255)
        canvas.fillRect(lionX + 25, lionY + 16, 5, 7, C_INK)
        canvas.setPixel(lionX + 26, lionY + 17, 255, 255, 255, 255)
        canvas.fillRect(lionX + 19, lionY + 23, 5, 3, [168, 48, 38, 255])
        canvas.fillRect(lionX + 17, lionY + 27, 9, 7, [214, 52, 42, 255])
        canvas.fillRect(lionX + 19, lionY + 27, 5, 2, [255, 255, 255, 255])

        const capX = rx + rw - 34
        const capY = floorY - 28
        canvas.drawBeveledBox(capX, capY, 22, 28, C_WOOD_DARK, C_STEEL_LIGHT, C_INK)
        for (let cy = capY + 6; cy < floorY - 4; cy += 6) {
          canvas.drawHLine(capX, capX + 21, cy, C_STEEL_HI)
          canvas.drawHLine(capX, capX + 21, cy + 1, C_STEEL_DARK)
        }
        canvas.strokeRect(rx + rw - 48, floorY - 12, 12, 10, [156, 118, 76, 255])
        break
      }
    }
  }

  // Bilge Cargo Hold & Ballast (below Deck 2, y = 416 .. 450)
  for (let bx = 160; bx < 780; bx += 40) {
    canvas.drawBeveledBox(bx, 422, 8, 26, C_WOOD_DARK, C_WOOD_MID, C_INK)
  }
  for (let cx = 180; cx < 320; cx += 26) {
    canvas.drawBeveledBox(cx, 424, 22, 20, [142, 98, 64, 255], [188, 138, 98, 255], [78, 46, 28, 255])
    canvas.drawLine(cx + 2, 426, cx + 19, 442, [98, 62, 38, 255])
    canvas.drawLine(cx + 19, 426, cx + 2, 442, [98, 62, 38, 255])
  }
  for (let bx = 560; bx < 720; bx += 22) {
    canvas.drawBeveledBox(bx, 424, 18, 22, [118, 74, 46, 255], [164, 112, 78, 255], [58, 32, 18, 255])
    canvas.drawHLine(bx, bx + 17, 429, C_STEEL_DARK)
    canvas.drawHLine(bx, bx + 17, 439, C_STEEL_DARK)
  }
}

/**
 * Render the complete high-detail pixel art cross-section PNG for The Sunny Deck.
 * Inspired by Barotrauma multi-deck cutaways and One Piece Grand Gourmet warmth.
 */
export function renderShipScenePng(ship: ShipDef): Buffer {
  const w = ship.size.w * ship.tileSize // 896px
  const h = ship.size.h * ship.tileSize // 480px
  const waterY = Math.floor(h * 0.8) // 384px

  const canvas = new PixelCanvas(w, h)

  // 1. Full tropical sky, clouds, islands, deep ocean, & underwater searchlight
  drawEnvironment(canvas, w, h, waterY)

  // 2. Masts, yards, furled canvas sails, pirate flag, & rigging
  drawMastsAndRigging(canvas, w)

  // 3. Multi-layer armored hull cross-section, portholes, & keel
  drawHullAndArmor(canvas, w, h, waterY)

  // 4. Barotrauma heavy steel bulkheads, deck girders, utility piping, & ladders
  drawBulkheadsAndDecks(canvas, ship)

  // 5. One Piece Grand Gourmet culinary items, room furnishings, & weather deck
  drawAllRoomsAndDecks(canvas, ship)

  const rgba = canvas.toRgbaImage()
  return encodePng(rgba)
}

/** Compatibility shims for legacy grid callers. */
export function composeShipScene(ship: ShipDef): string[][] {
  const { w, h } = ship.size
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 'D'))
}

export function scaleGridToPixels(grid: string[][], tileSize: number): readonly string[] {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    for (let py = 0; py < tileSize; py++) {
      let row = ''
      for (let x = 0; x < w; x++) {
        row += grid[y][x].repeat(tileSize)
      }
      out.push(row)
    }
  }
  return out
}
