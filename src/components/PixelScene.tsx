import { useEffect, useRef, useState } from 'react'
import type { SceneWeather } from '@shared/ipc'
import { loadShipAtlases } from '@/ship/atlas'
import { applySpriteOverrides } from '@/ship/overrides'
import { WORLD_H, WORLD_W, roomDef, roomRect } from '@/ship/room-defs'
import { ShipScene, inRect, type CrewHit, type SceneCrew } from '@/ship/ship-scene'

interface Props {
  crew: readonly SceneCrew[]
  /** Crew pack id and the characters in it that ship drop-in sprite sheets. */
  crewId: string
  spriteOverrides?: readonly string[]
  night: boolean
  weather?: SceneWeather
  /** Room currently zoomed into, or null for the whole-ship view. */
  focusRoom: string | null
  onSelect: (id: string) => void
  onFocusRoom: (id: string | null) => void
}

/** Optional `window.__gfScene` overrides, used only by the screenshot scripts. */
interface SceneDebug {
  status?: Record<string, SceneCrew['status']>
  night?: boolean
  weather?: SceneWeather
  timeMs?: number
  /** Bump after changing the fields above to force a repaint. */
  rev?: number
}

interface View {
  scale: number
  /** Visible region in native world px. */
  w: number
  h: number
  x: number
  y: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Manual camera: an integer scale and the world point at the middle of the panel. Null = the automatic fit. */
interface Cam {
  scale: number
  cx: number
  cy: number
}

const MAX_SCALE = 8

/** The visible window for a manual camera, clamped to the world. */
export function viewFromCam(panelW: number, panelH: number, cam: Cam): View {
  const w = Math.min(WORLD_W, Math.floor(panelW / cam.scale))
  const h = Math.min(WORLD_H, Math.floor(panelH / cam.scale))
  return {
    scale: cam.scale,
    w,
    h,
    x: clamp(Math.round(cam.cx - w / 2), 0, WORLD_W - w),
    y: clamp(Math.round(cam.cy - h / 2), 0, WORLD_H - h)
  }
}

const resolveView = (panelW: number, panelH: number, focus: string | null, cam: Cam | null): View =>
  cam ? viewFromCam(panelW, panelH, cam) : computeView(panelW, panelH, focus)

/**
 * Camera rules. The world is 896x512 native px and is always upscaled by an integer factor with
 * nearest-neighbour sampling, so pixels never blur. The ship view shows everything at the largest integer
 * scale that fits; zooming into a room picks the largest integer scale that fits the room plus a margin and
 * centres the camera on it.
 */
export function computeView(panelW: number, panelH: number, focus: string | null): View {
  const def = focus ? roomDef(focus) : undefined
  if (!def) {
    const scale = Math.max(1, Math.floor(Math.min(panelW / WORLD_W, panelH / WORLD_H)))
    return { scale, w: WORLD_W, h: WORLD_H, x: 0, y: 0 }
  }
  const r = roomRect(def)
  const scale = Math.max(1, Math.floor(Math.min(panelW / (r.w + 32), panelH / (r.h + 48))))
  const w = Math.min(WORLD_W, Math.floor(panelW / scale))
  const h = Math.min(WORLD_H, Math.floor(panelH / scale))
  return {
    scale,
    w,
    h,
    x: clamp(Math.round(r.x + r.w / 2 - w / 2), 0, WORLD_W - w),
    y: clamp(Math.round(r.y + r.h / 2 - 6 - h / 2), 0, WORLD_H - h)
  }
}

/**
 * Native-resolution pixel scene: composed on an 896x512 offscreen canvas from PNG sprite sheets, then the
 * visible window is scaled to the display canvas by an integer factor with nearest-neighbour sampling.
 */
export function PixelScene({ crew, crewId, spriteOverrides = [], night, weather = 'clear', focusRoom, onSelect, onFocusRoom }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scene, setScene] = useState<ShipScene | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState({ w: 0, h: 0 })
  /** Wheel zoom and drag pan. Cleared when the focused room changes and on Escape. */
  const [cam, setCam] = useState<Cam | null>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)

  // live inputs read by the render loop without restarting it
  const live = useRef({ crew, night, weather, hoverRoom: null as string | null, onSelect, onFocusRoom, focusRoom })
  live.current.crew = crew
  live.current.night = night
  live.current.weather = weather
  live.current.onSelect = onSelect
  live.current.onFocusRoom = onFocusRoom
  live.current.focusRoom = focusRoom
  const hits = useRef<CrewHit[]>([])
  const redraw = useRef<() => void>(() => undefined)
  const viewRef = useRef<View>({ scale: 1, w: WORLD_W, h: WORLD_H, x: 0, y: 0 })

  const overrideKey = spriteOverrides.join(',')
  useEffect(() => {
    let cancelled = false
    loadShipAtlases()
      .then((atlases) => (overrideKey ? applySpriteOverrides(atlases, crewId, overrideKey.split(',')) : atlases))
      .then((atlases) => {
        if (!cancelled) setScene(new ShipScene(atlases))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [crewId, overrideKey])

  // panel size in device pixels
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const dpr = window.devicePixelRatio || 1
      setPanel({ w: wrap.clientWidth * dpr, h: wrap.clientHeight * dpr })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  viewRef.current = resolveView(panel.w, panel.h, focusRoom, cam)

  // a new room (or back to the whole ship) starts from the automatic fit again
  useEffect(() => setCam(null), [focusRoom])
  useEffect(() => {
    if (!cam) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCam(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cam])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !scene || panel.w < 1) return
    const dpr = window.devicePixelRatio || 1
    const v = resolveView(panel.w, panel.h, focusRoom, cam)
    canvas.width = v.w * v.scale
    canvas.height = v.h * v.scale
    canvas.style.width = `${(v.w * v.scale) / dpr}px`
    canvas.style.height = `${(v.h * v.scale) / dpr}px`
    const out = canvas.getContext('2d')
    const world = document.createElement('canvas')
    world.width = WORLD_W
    world.height = WORLD_H
    const wctx = world.getContext('2d')
    if (!out || !wctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    let last = -1

    const paint = (force: boolean) => {
      // screenshot scripts can pin statuses, the animation clock and day/night (see scripts/ship-shot.mjs)
      const dbg = (window as unknown as { __gfScene?: SceneDebug }).__gfScene
      const now = dbg?.timeMs ?? (reduced ? 0 : performance.now() - start)
      const frame = Math.floor(now / 62) + (dbg?.rev ?? 0) * 1e6
      if (!force && frame === last) return
      last = frame
      const { crew: base, night: baseNight, weather: baseWeather, hoverRoom } = live.current
      const c = dbg?.status ? base.map((m) => (dbg.status?.[m.id] ? { ...m, status: dbg.status[m.id] } : m)) : base
      const n = dbg?.night ?? baseNight
      hits.current = scene.draw(wctx, { night: n, weather: dbg?.weather ?? baseWeather, timeMs: now, hoverRoom, crew: c, still: reduced || dbg?.timeMs !== undefined })
      out.imageSmoothingEnabled = false
      out.clearRect(0, 0, canvas.width, canvas.height)
      out.drawImage(world, v.x, v.y, v.w, v.h, 0, 0, canvas.width, canvas.height)
      canvas.dataset.ready = 'true'
      canvas.dataset.scale = String(v.scale)
      canvas.dataset.view = live.current.focusRoom ?? 'ship'
      canvas.dataset.hover = hoverRoom ?? ''
    }
    redraw.current = () => paint(true)
    const loop = () => {
      paint(false)
      raf = requestAnimationFrame(loop)
    }
    paint(true)
    if (!reduced) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      redraw.current = () => undefined
    }
  }, [scene, panel.w, panel.h, focusRoom, cam])

  // keep a frozen (reduced-motion) frame current when inputs change
  useEffect(() => redraw.current(), [crew, night, weather, scene, panel.w, panel.h, focusRoom, cam])

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const v = viewRef.current
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * v.w) + v.x,
      y: Math.floor(((e.clientY - r.top) / r.height) * v.h) + v.y
    }
  }
  const crewAt = (x: number, y: number) => hits.current.find((h) => inRect(x, y, h.rect))

  const baseView = computeView(panel.w, panel.h, focusRoom)
  const label = focusRoom ? (roomDef(focusRoom)?.label ?? 'Room') : 'The Sunny Deck'

  return (
    <div className="pixel-scene" ref={wrapRef}>
      {error ? (
        <p className="pixel-scene-error">Ship art missing — run pnpm art ({error})</p>
      ) : (
        <canvas
          ref={canvasRef}
          className="pixel-canvas"
          role="img"
          aria-label={`${label}. ${crew.map((c) => `${c.name} is ${c.status}`).join('. ')}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            const v = viewRef.current
            drag.current = { x: e.clientX, y: e.clientY, cx: v.x + v.w / 2, cy: v.y + v.h / 2, moved: false }
          }}
          onPointerUp={() => {
            // keep a finished drag around for the click event that follows, which must not select anything
            if (!drag.current?.moved) drag.current = null
          }}
          onWheel={(e) => {
            // integer zoom steps, anchored on the cursor; never below the automatic fit
            const v = viewRef.current
            const base = computeView(panel.w, panel.h, live.current.focusRoom)
            const scale = clamp(v.scale + (e.deltaY < 0 ? 1 : -1), base.scale, MAX_SCALE)
            if (scale === v.scale) return
            if (scale === base.scale) {
              setCam(null)
              return
            }
            const r = e.currentTarget.getBoundingClientRect()
            const p = toWorld(e)
            const w = Math.min(WORLD_W, Math.floor(panel.w / scale))
            const h = Math.min(WORLD_H, Math.floor(panel.h / scale))
            const fx = (e.clientX - r.left) / r.width
            const fy = (e.clientY - r.top) / r.height
            setCam({ scale, cx: p.x - (fx - 0.5) * w, cy: p.y - (fy - 0.5) * h })
          }}
          onPointerMove={(e) => {
            if (!scene) return
            const d = drag.current
            if (d && e.buttons & 1) {
              const r = e.currentTarget.getBoundingClientRect()
              const v = viewRef.current
              const dx = e.clientX - d.x
              const dy = e.clientY - d.y
              if (d.moved || Math.abs(dx) + Math.abs(dy) > 5) {
                d.moved = true
                // 1 world px is r.width / v.w CSS px; moving the pointer right drags the world right
                setCam({ scale: v.scale, cx: d.cx - (dx * v.w) / r.width, cy: d.cy - (dy * v.h) / r.height })
                return
              }
            }
            const p = toWorld(e)
            const room = scene.roomAt(p.x, p.y)
            live.current.hoverRoom = room?.id ?? null
            e.currentTarget.style.cursor = crewAt(p.x, p.y) || (room && !live.current.focusRoom) ? 'pointer' : 'default'
            redraw.current()
          }}
          onPointerLeave={() => {
            live.current.hoverRoom = null
            redraw.current()
          }}
          onClick={(e) => {
            if (!scene) return
            // a drag that ended on the canvas is a pan, not a click
            if (drag.current?.moved) {
              drag.current = null
              return
            }
            const p = toWorld(e)
            const hit = crewAt(p.x, p.y)
            if (hit) {
              live.current.onSelect(hit.id)
              return
            }
            const room = scene.roomAt(p.x, p.y)
            if (room && !live.current.focusRoom) live.current.onFocusRoom(room.id)
          }}
        />
      )}
      {cam && (viewRef.current.scale !== baseView.scale || viewRef.current.x !== baseView.x || viewRef.current.y !== baseView.y) ? (
        <button type="button" className="scene-back" style={{ top: 'auto', bottom: 8 }} onClick={() => setCam(null)} title="Back to the automatic fit (Esc)">
          Reset view
        </button>
      ) : null}
    </div>
  )
}

