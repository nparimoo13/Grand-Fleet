import { useEffect, useState } from 'react'
import { crewAssetUrl } from '@/lib/crew-asset'
import { resolveIsNight, useNow } from '@/lib/time'
import { useAgents, useAppStore } from '@/store/app-store'
import { STATUS_LABEL } from './common'
import { PixelScene } from './PixelScene'

/**
 * Schematic stand-in for the PixiJS scene (Phase 5). It already reads the
 * room layout from the crew's ship.json, so nothing here is crew-specific.
 */
type SceneView = 'pixel' | 'legacy'

export function ShipPreview() {
  const pack = useAppStore((s) => s.pack)
  const sceneTime = useAppStore((s) => s.prefs.sceneTime)
  const weather = useAppStore((s) => s.prefs.sceneWeather)
  const selectedId = useAppStore((s) => s.selectedId)
  const select = useAppStore((s) => s.select)
  const agents = useAgents()
  const [view, setView] = useState<SceneView>('pixel')
  /** Room the pixel scene is zoomed into (null = whole ship). */
  const [focusRoom, setFocusRoom] = useState<string | null>(null)
  useNow()

  useEffect(() => {
    if (!focusRoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusRoom(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusRoom])

  if (!pack) return <section className="ship-scene panel" aria-label="Ship scene" />
  const { ship, shipArt } = pack
  const night = resolveIsNight(sceneTime)
  const sceneSheet = shipArt?.sheets.find((s) => s.id === 'scene')
  const sceneSrc = sceneSheet ? crewAssetUrl(pack.id, sceneSheet.png) : null

  const toggle = (
    <div className="scene-view-toggle" role="group" aria-label="Scene view">
      <button type="button" aria-pressed={view === 'pixel'} onClick={() => setView('pixel')}>
        Pixel ship (new art)
      </button>
      <button type="button" aria-pressed={view === 'legacy'} onClick={() => setView('legacy')}>
        Full ship (legacy)
      </button>
    </div>
  )

  if (view === 'pixel') {
    const crew = agents
      .filter((a) => a.active)
      .map((a) => ({ id: a.id, name: a.displayName, status: a.runtime.status, selected: a.id === selectedId, roomId: a.defaultRoomId }))
    const focusLabel = focusRoom ? ship.rooms.find((r) => r.id === focusRoom)?.label : null
    return (
      <section className={`ship-scene panel galley-mode ${night ? 'night' : 'day'}`} aria-label="Ship scene">
        {toggle}
        {focusRoom ? (
          <button type="button" className="scene-back" onClick={() => setFocusRoom(null)}>
            ← Whole ship{focusLabel ? ` · ${focusLabel}` : ''}
          </button>
        ) : null}
        <PixelScene crew={crew} crewId={pack.id} spriteOverrides={pack.spriteOverrides} night={night} weather={weather} focusRoom={focusRoom} onSelect={select} onFocusRoom={setFocusRoom} />
      </section>
    )
  }

  return (
    <section className={`ship-scene panel ${night ? 'night' : 'day'}`} aria-label="Ship scene">
      {toggle}
      <div className="scene-sky" />
      <div className="scene-ocean">
        <div className="wave wave-far" />
        <div className="wave wave-near" />
      </div>
      <div className="ship-frame" style={{ aspectRatio: `${ship.size.w} / ${ship.size.h}` }}>
        {sceneSrc ? <img className="ship-pixel-art" src={sceneSrc} alt="" draggable={false} /> : <div className="ship-hull" />}
        {ship.rooms.filter((room) => !room.pixelOnly).map((room) => {
          const occupants = agents.filter((a) => a.active && a.defaultRoomId === room.id)
          const { x, y, w, h } = room.rect
          return (
            <div
              key={room.id}
              className={`room ${occupants.length ? 'occupied' : ''}`}
              style={{
                left: `${(x / ship.size.w) * 100}%`,
                top: `${(y / ship.size.h) * 100}%`,
                width: `${(w / ship.size.w) * 100}%`,
                height: `${(h / ship.size.h) * 100}%`
              }}
            >
              <span className="room-label">{room.label}</span>
              <div className="room-crew">
                {occupants.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`crew-chip status-bg-${a.runtime.status} ${a.id === selectedId ? 'selected' : ''}`}
                    style={{ background: a.signatureColor }}
                    title={`${a.displayName} · ${STATUS_LABEL[a.runtime.status]}`}
                    onClick={() => select(a.id)}
                  >
                    {a.displayName.slice(0, 1)}
                    <span className={`chip-dot status-dot-${a.runtime.status}`} />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="scene-caption pixel-title">
        {ship.name} · {sceneSrc ? 'pixel art preview (PixiJS scene in Phase 5)' : 'schematic preview — run pnpm art'}
      </p>
    </section>
  )
}
