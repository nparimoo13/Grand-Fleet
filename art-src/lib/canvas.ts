import type { Palette, RgbaImage } from './raster'

export type Color = readonly [r: number, g: number, b: number, a?: number]

/**
 * High-performance 2D pixel buffer with rich drawing primitives for
 * Barotrauma-style industrial cutaways and Grand Gourmet pixel art.
 */
export class PixelCanvas {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8Array(width * height * 4)
  }

  setPixel(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    const idx = (y * this.width + x) * 4
    this.data[idx] = r
    this.data[idx + 1] = g
    this.data[idx + 2] = b
    this.data[idx + 3] = a
  }

  blendPixel(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || a <= 0) return
    const idx = (y * this.width + x) * 4
    if (a >= 255) {
      this.data[idx] = r
      this.data[idx + 1] = g
      this.data[idx + 2] = b
      this.data[idx + 3] = 255
      return
    }

    const sa = a / 255
    const da = this.data[idx + 3] / 255
    const outA = sa + da * (1 - sa)

    if (outA > 0) {
      this.data[idx] = Math.round((r * sa + this.data[idx] * da * (1 - sa)) / outA)
      this.data[idx + 1] = Math.round((g * sa + this.data[idx + 1] * da * (1 - sa)) / outA)
      this.data[idx + 2] = Math.round((b * sa + this.data[idx + 2] * da * (1 - sa)) / outA)
      this.data[idx + 3] = Math.round(outA * 255)
    }
  }

  getPixel(x: number, y: number): [r: number, g: number, b: number, a: number] {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0]
    const idx = (y * this.width + x) * 4
    return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]]
  }

  fillRect(x: number, y: number, w: number, h: number, color: Color): void {
    const x0 = Math.max(0, Math.floor(x))
    const y0 = Math.max(0, Math.floor(y))
    const x1 = Math.min(this.width, Math.floor(x + w))
    const y1 = Math.min(this.height, Math.floor(y + h))
    const [r, g, b, a = 255] = color

    if (a >= 255) {
      for (let py = y0; py < y1; py++) {
        let idx = (py * this.width + x0) * 4
        for (let px = x0; px < x1; px++) {
          this.data[idx] = r
          this.data[idx + 1] = g
          this.data[idx + 2] = b
          this.data[idx + 3] = 255
          idx += 4
        }
      }
    } else {
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          this.blendPixel(px, py, r, g, b, a)
        }
      }
    }
  }

  strokeRect(x: number, y: number, w: number, h: number, color: Color): void {
    this.drawHLine(x, x + w - 1, y, color)
    this.drawHLine(x, x + w - 1, y + h - 1, color)
    this.drawVLine(x, y, y + h - 1, color)
    this.drawVLine(x + w - 1, y, y + h - 1, color)
  }

  /**
   * Barotrauma / pixel art beveled panel:
   * 1px top and left highlight, 1px bottom and right shadow, with solid fill.
   */
  drawBeveledBox(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: Color,
    highlight: Color,
    shadow: Color
  ): void {
    this.fillRect(x, y, w, h, fill)
    this.drawHLine(x, x + w - 2, y, highlight)
    this.drawVLine(x, y, y + h - 2, highlight)
    this.drawHLine(x + 1, x + w - 1, y + h - 1, shadow)
    this.drawVLine(x + w - 1, y + 1, y + h - 1, shadow)
  }

  drawHLine(x0: number, x1: number, y: number, color: Color): void {
    const minX = Math.max(0, Math.min(Math.floor(x0), Math.floor(x1)))
    const maxX = Math.min(this.width - 1, Math.max(Math.floor(x0), Math.floor(x1)))
    const py = Math.floor(y)
    if (py < 0 || py >= this.height) return
    const [r, g, b, a = 255] = color

    for (let px = minX; px <= maxX; px++) {
      if (a >= 255) {
        this.setPixel(px, py, r, g, b, 255)
      } else {
        this.blendPixel(px, py, r, g, b, a)
      }
    }
  }

  drawVLine(x: number, y0: number, y1: number, color: Color): void {
    const px = Math.floor(x)
    if (px < 0 || px >= this.width) return
    const minY = Math.max(0, Math.min(Math.floor(y0), Math.floor(y1)))
    const maxY = Math.min(this.height - 1, Math.max(Math.floor(y0), Math.floor(y1)))
    const [r, g, b, a = 255] = color

    for (let py = minY; py <= maxY; py++) {
      if (a >= 255) {
        this.setPixel(px, py, r, g, b, 255)
      } else {
        this.blendPixel(px, py, r, g, b, a)
      }
    }
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, color: Color): void {
    let x = Math.floor(x0)
    let y = Math.floor(y0)
    const targetX = Math.floor(x1)
    const targetY = Math.floor(y1)
    const dx = Math.abs(targetX - x)
    const dy = Math.abs(targetY - y)
    const sx = x < targetX ? 1 : -1
    const sy = y < targetY ? 1 : -1
    let err = dx - dy
    const [r, g, b, a = 255] = color

    for (;;) {
      if (a >= 255) this.setPixel(x, y, r, g, b, 255)
      else this.blendPixel(x, y, r, g, b, a)
      if (x === targetX && y === targetY) break
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }
  }

  /**
   * Barotrauma-style 3D-shaded horizontal industrial pipe with highlight,
   * midtone, shadow, and joint collar rings.
   */
  drawPipeH(
    x0: number,
    x1: number,
    y: number,
    thickness: number,
    colorMid: Color,
    colorHi: Color,
    colorShadow: Color,
    jointStep = 40
  ): void {
    const minX = Math.min(x0, x1)
    const maxX = Math.max(x0, x1)
    this.fillRect(minX, y, maxX - minX + 1, thickness, colorMid)
    this.drawHLine(minX, maxX, y, colorHi)
    this.drawHLine(minX, maxX, y + thickness - 1, colorShadow)

    if (jointStep > 0) {
      for (let jx = minX + jointStep; jx < maxX; jx += jointStep) {
        this.fillRect(jx - 1, y - 1, 3, thickness + 2, colorMid)
        this.drawVLine(jx - 1, y - 1, y + thickness, colorHi)
        this.drawVLine(jx + 1, y - 1, y + thickness, colorShadow)
      }
    }
  }

  /**
   * Barotrauma-style vertical industrial pipe.
   */
  drawPipeV(
    x: number,
    y0: number,
    y1: number,
    thickness: number,
    colorMid: Color,
    colorHi: Color,
    colorShadow: Color,
    jointStep = 32
  ): void {
    const minY = Math.min(y0, y1)
    const maxY = Math.max(y0, y1)
    this.fillRect(x, minY, thickness, maxY - minY + 1, colorMid)
    this.drawVLine(x, minY, maxY, colorHi)
    this.drawVLine(x + thickness - 1, minY, maxY, colorShadow)

    if (jointStep > 0) {
      for (let jy = minY + jointStep; jy < maxY; jy += jointStep) {
        this.fillRect(x - 1, jy - 1, thickness + 2, 3, colorMid)
        this.drawHLine(x - 1, x + thickness, jy - 1, colorHi)
        this.drawHLine(x - 1, x + thickness, jy + 1, colorShadow)
      }
    }
  }

  /**
   * Smooth ambient occlusion shadow inside a compartment to create
   * realistic Barotrauma atmospheric depth along ceilings and corners.
   */
  drawAmbientOcclusion(x: number, y: number, w: number, h: number, maxAlpha = 70): void {
    // Ceiling drop shadow
    const ceilingH = Math.min(16, Math.floor(h * 0.35))
    for (let dy = 0; dy < ceilingH; dy++) {
      const a = Math.round(maxAlpha * (1 - dy / ceilingH))
      this.drawHLine(x, x + w - 1, y + dy, [10, 12, 18, a])
    }
    // Floor shadow
    const floorH = Math.min(8, Math.floor(h * 0.2))
    for (let dy = 0; dy < floorH; dy++) {
      const a = Math.round((maxAlpha * 0.6) * ((floorH - dy) / floorH))
      this.drawHLine(x, x + w - 1, y + h - 1 - dy, [10, 12, 18, a])
    }
    // Corner vignettes
    const cornerW = Math.min(12, Math.floor(w * 0.15))
    for (let dx = 0; dx < cornerW; dx++) {
      const a = Math.round((maxAlpha * 0.5) * (1 - dx / cornerW))
      this.drawVLine(x + dx, y, y + h - 1, [10, 12, 18, a])
      this.drawVLine(x + w - 1 - dx, y, y + h - 1, [10, 12, 18, a])
    }
  }

  /**
   * Barotrauma-style radial lighting with realistic quadratic falloff.
   */
  drawRadialLight(
    cx: number,
    cy: number,
    radius: number,
    rgb: readonly [number, number, number],
    maxAlpha = 140
  ): void {
    const x0 = Math.max(0, Math.floor(cx - radius))
    const y0 = Math.max(0, Math.floor(cy - radius))
    const x1 = Math.min(this.width, Math.ceil(cx + radius))
    const y1 = Math.min(this.height, Math.ceil(cy + radius))
    const r2 = radius * radius
    const [lr, lg, lb] = rgb

    for (let py = y0; py < y1; py++) {
      const dy = py - cy
      const dy2 = dy * dy
      for (let px = x0; px < x1; px++) {
        const dx = px - cx
        const dist2 = dx * dx + dy2
        if (dist2 >= r2) continue
        const dist = Math.sqrt(dist2)
        const factor = 1 - dist / radius
        const a = Math.round(maxAlpha * factor * factor)
        if (a > 0) {
          this.blendPixel(px, py, lr, lg, lb, a)
        }
      }
    }
  }

  /**
   * Barotrauma searchlight cone (light beam angled downwards/outwards).
   */
  drawSpotlightCone(
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    length: number,
    spreadAngleRad: number,
    color: Color,
    maxAlpha = 90
  ): void {
    const angle = Math.atan2(targetY - originY, targetX - originX)
    const [lr, lg, lb] = color
    const steps = Math.floor(length)

    for (let r = 0; r <= steps; r += 2) {
      const t = r / length
      const currentSpread = Math.tan(spreadAngleRad * 0.5) * r
      const cx = originX + Math.cos(angle) * r
      const cy = originY + Math.sin(angle) * r
      const perpAngle = angle + Math.PI * 0.5
      const perpX = Math.cos(perpAngle)
      const perpY = Math.sin(perpAngle)
      const alpha = Math.round(maxAlpha * (1 - t * t))

      for (let s = -currentSpread; s <= currentSpread; s += 1.5) {
        const px = Math.round(cx + perpX * s)
        const py = Math.round(cy + perpY * s)
        const distFromCenter = Math.abs(s) / (currentSpread + 0.1)
        const beamA = Math.round(alpha * (1 - distFromCenter * distFromCenter))
        if (beamA > 0) {
          this.blendPixel(px, py, lr, lg, lb, beamA)
        }
      }
    }
  }

  toRgbaImage(): RgbaImage {
    return {
      width: this.width,
      height: this.height,
      data: new Uint8Array(this.data)
    }
  }
}
