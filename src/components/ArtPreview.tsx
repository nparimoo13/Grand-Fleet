import { useEffect, useMemo, useState } from 'react'
import type { AsepriteDocument, ArtSheetEntry } from '@shared/types/art'
import { crewAssetUrl } from '@/lib/crew-asset'
import { useAppStore } from '@/store/app-store'

async function loadAseprite(url: string): Promise<AsepriteDocument | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as AsepriteDocument
  } catch {
    return null
  }
}

function AnimatedSheet({ crewId, sheet }: { crewId: string; sheet: ArtSheetEntry }) {
  const png = crewAssetUrl(crewId, sheet.png)
  const [doc, setDoc] = useState<AsepriteDocument | null>(null)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!sheet.json) return
    void loadAseprite(crewAssetUrl(crewId, sheet.json)).then(setDoc)
  }, [crewId, sheet.json])

  const frames = useMemo(() => {
    if (!doc) return []
    return Object.entries(doc.frames).map(([name, f]) => ({ name, ...f.frame, duration: f.duration }))
  }, [doc])

  useEffect(() => {
    if (frames.length < 2) return
    const id = window.setInterval(() => setFrame((f) => (f + 1) % frames.length), frames[frame]?.duration ?? 120)
    return () => clearInterval(id)
  }, [frames, frame])

  const cur = frames[frame]
  const scale = sheet.w > 280 ? 2 : 3

  return (
    <article className="art-card panel-inset">
      <h4 className="pixel-title">{sheet.label}</h4>
      <p className="small muted">
        {sheet.id} · {sheet.w}×{sheet.h}px
      </p>
      <div className="art-stage dark">
        {cur && doc ? (
          <div
            className="art-sprite"
            style={{
              width: cur.w * scale,
              height: cur.h * scale,
              backgroundImage: `url(${png})`,
              backgroundPosition: `-${cur.x * scale}px -${cur.y * scale}px`,
              backgroundSize: `${doc.meta.size.w * scale}px ${doc.meta.size.h * scale}px`
            }}
          />
        ) : (
          <img src={png} alt={sheet.label} className="art-static" width={Math.min(sheet.w * scale, 400)} style={{ imageRendering: 'pixelated' }} />
        )}
      </div>
      <div className="art-stage light">
        {cur && doc ? (
          <div
            className="art-sprite"
            style={{
              width: cur.w * scale,
              height: cur.h * scale,
              backgroundImage: `url(${png})`,
              backgroundPosition: `-${cur.x * scale}px -${cur.y * scale}px`,
              backgroundSize: `${doc.meta.size.w * scale}px ${doc.meta.size.h * scale}px`
            }}
          />
        ) : (
          <img src={png} alt="" className="art-static" width={Math.min(sheet.w * scale, 400)} style={{ imageRendering: 'pixelated' }} />
        )}
      </div>
    </article>
  )
}

/** Dev-only sheet gallery (Phase 3 review loop). */
export function ArtPreview({ onClose }: { onClose: () => void }) {
  const pack = useAppStore((s) => s.pack)
  const sheets = pack?.shipArt?.sheets ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!pack) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Art preview">
      <div className="modal art-preview-modal panel">
        <header className="modal-header">
          <h2 className="pixel-title">Art preview · {pack.name}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            close
          </button>
        </header>
        {sheets.length === 0 ? (
          <p className="settings-pane">No generated art found. Run <code>pnpm art</code> and reload the crew.</p>
        ) : (
          <div className="art-grid">
            {sheets.map((s) => (
              <AnimatedSheet key={s.id} crewId={pack.id} sheet={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
