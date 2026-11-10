/**
 * The 3x5 pixel font used for in-scene room plaques. Glyph sprites live in assets/ship/ui.png
 * as `font_<name>`; both the art build and the renderer use this table so they cannot drift apart.
 */
export const FONT_GLYPH_W = 3
export const FONT_GLYPH_H = 5
/** Pixels between glyphs. */
export const FONT_ADVANCE = FONT_GLYPH_W + 1

const SPECIAL: Readonly<Record<string, string>> = {
  '&': 'amp',
  "'": 'apos',
  '-': 'dash',
  '.': 'dot',
  ',': 'comma',
  ':': 'colon',
  '!': 'bang',
  '?': 'q'
}

/** Atlas frame name for a character, or null for a space / unsupported character. */
export function fontGlyphName(ch: string): string | null {
  if (ch === ' ') return null
  const up = ch.toUpperCase()
  if (/^[A-Z0-9]$/.test(up)) return `font_${up}`
  const special = SPECIAL[ch]
  return special ? `font_${special}` : null
}

export const FONT_SPECIAL_NAMES: readonly string[] = Object.values(SPECIAL)

/** Width in px of `text` when drawn with this font (no trailing gap). */
export function fontTextWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * FONT_ADVANCE - 1
}
