import { packSheet, type FrameInput } from '../lib/aseprite'
import { SUNNY_DECK_PALETTE } from '../palettes/sunny-deck'

/** UI icons for bubbles, Den Den Mushi, status markers (Phase 5–9). */
export function buildUiIconSheet(): { png: Buffer; json: object; w: number; h: number } {
  const snail: FrameInput = {
    name: 'den_den_idle',
    durationMs: 200,
    grid: [
      '....oooooooo....',
      '...oYYYYYYYo...',
      '..oYYllllYYo..',
      '..oYlrrrrlYo..',
      '..oYlrrrrlYo..',
      '..oYYllllYYo..',
      '...oYYYYYYYo...',
      '....oooooo....',
      '.....ohho.....',
      '.....ohho.....',
      '.....ohho.....',
      '....oooooooo....',
      '...oYYYYYYYYo...',
      '..oYYllllllYYo..',
      '..oYYllllllYYo..',
      '...oYYYYYYYYo...'
    ]
  }
  const snailRing: FrameInput = {
    name: 'den_den_ring',
    durationMs: 200,
    grid: [
      'o............o',
      '.oooooooooooo.',
      '.oYYYYYYYYYYo.',
      '.oYllllllllYo.',
      '.oYlrrrrrrlYo.',
      '.oYlrrrrrrlYo.',
      '.oYllllllllYo.',
      '.oYYYYYYYYYYo.',
      '.oooooooooooo.',
      'o............o',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............'
    ]
  }
  const bang: FrameInput = {
    name: 'marker_bang',
    grid: [
      '......rr......',
      '.....rrrr.....',
      '....rrrrrr....',
      '...rrrrrrrr...',
      '....rrrrrr....',
      '.....rrrr.....',
      '......rr......',
      '......rr......',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............'
    ]
  }
  const dots: FrameInput = {
    name: 'marker_think',
    grid: [
      '..............',
      '..............',
      '....ooo.......',
      '...o...o......',
      '....ooo.......',
      '......ooo.....',
      '.....o...o....',
      '......ooo.....',
      '........ooo...',
      '.......o...o..',
      '........ooo...',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............'
    ]
  }
  const sheet = packSheet([snail, snailRing, bang, dots], SUNNY_DECK_PALETTE)
  sheet.json.meta.frameTags = [
    { name: 'den_den', from: 0, to: 1, direction: 'forward' },
    { name: 'markers', from: 2, to: 3, direction: 'forward' }
  ]
  return { png: sheet.png, json: sheet.json, w: sheet.width, h: sheet.height }
}
