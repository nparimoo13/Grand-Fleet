import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/app-store'

export function VoyageMenu() {
  const voyage = useAppStore((s) => s.voyage)
  const voyages = useAppStore((s) => s.voyages)
  const voyagesRoot = useAppStore((s) => s.prefs.voyagesRoot)
  const openVoyage = useAppStore((s) => s.openVoyage)
  const pickVoyage = useAppStore((s) => s.pickVoyage)
  const createVoyage = useAppStore((s) => s.createVoyage)
  const forgetVoyage = useAppStore((s) => s.forgetVoyage)
  const openSettings = useAppStore((s) => s.openSettings)

  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const submitNew = async () => {
    if (!name.trim()) return
    if (await createVoyage(name)) {
      setName('')
      setNaming(false)
      setOpen(false)
    }
  }

  return (
    <div className="voyage-menu" ref={ref}>
      <button
        type="button"
        className="btn voyage-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title={voyage?.path ?? 'Choose the project this voyage works on'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="voyage-label">voyage</span>
        <span className="voyage-name">{voyage ? voyage.name : 'none selected'}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="menu-pop" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={() => { setOpen(false); void pickVoyage() }}>
            Open project folder…
          </button>
          {naming ? (
            <div className="menu-new">
              <input
                autoFocus
                value={name}
                placeholder="New voyage name"
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submitNew()}
              />
              <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => void submitNew()}>
                Create
              </button>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => (voyagesRoot ? setNaming(true) : (setOpen(false), openSettings('voyage')))}
              title={voyagesRoot ? `Creates a folder in ${voyagesRoot}` : 'Set a voyages folder first'}
            >
              New voyage…{voyagesRoot ? '' : ' (set voyages folder)'}
            </button>
          )}
          <div className="menu-sep" />
          <div className="menu-heading">Recent voyages</div>
          {voyages.length === 0 ? <div className="menu-empty">None yet</div> : null}
          {voyages.map((v) => (
            <div key={v.id} className={`menu-row ${v.id === voyage?.id ? 'current' : ''}`}>
              <button
                type="button"
                role="menuitem"
                className="menu-item grow"
                title={v.path}
                onClick={() => { setOpen(false); void openVoyage(v.id) }}
              >
                <strong>{v.name}</strong>
                <small>{v.path}</small>
              </button>
              <button
                type="button"
                className="menu-forget"
                title="Remove from recent (files are not deleted)"
                aria-label={`Forget ${v.name}`}
                onClick={() => void forgetVoyage(v.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
