import { useEffect, useRef, useState } from 'react'
import type { AgentStatus } from '@shared/ipc'
import { loadShipAtlases } from '@/ship/atlas'
import type { Agent } from '@/store/app-store'

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'idle',
  working: 'working',
  waiting: 'waiting',
  error: 'error',
  off_duty: 'off duty'
}

export function StatusPill({ status }: { status: AgentStatus }) {
  return <span className={`status-pill status-${status}`}>{STATUS_LABEL[status]}</span>
}

const PORTRAIT_PX = 32
const PORTRAIT_BORDER = 3

/**
 * The crew member's 32x32 bust from the ui sheet (`portrait_<id>`), on their signature colour, at the largest whole
 * pixel scale that fits `size` (so it stays crisp). Falls back to the initial for crew with no bust.
 */
export function Portrait({ agent, size = 70 }: { agent: Pick<Agent, 'id' | 'displayName' | 'signatureColor'>; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)
  const scale = Math.max(1, Math.floor((size - PORTRAIT_BORDER * 2) / PORTRAIT_PX))
  const px = PORTRAIT_PX * scale
  useEffect(() => {
    let live = true
    setDrawn(false)
    loadShipAtlases()
      .then((atlases) => {
        const frame = atlases.ui.frames.get(`portrait_${agent.id}`)
        const g = ref.current?.getContext('2d')
        if (!live || !frame || !g) return
        g.imageSmoothingEnabled = false
        g.clearRect(0, 0, PORTRAIT_PX, PORTRAIT_PX)
        g.drawImage(atlases.ui.image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h)
        setDrawn(true)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [agent.id])
  return (
    <div
      className="portrait"
      style={{
        width: px + PORTRAIT_BORDER * 2,
        height: px + PORTRAIT_BORDER * 2,
        background: agent.signatureColor,
        fontSize: Math.round(px * 0.4),
        overflow: 'hidden'
      }}
      aria-hidden
    >
      <canvas ref={ref} width={PORTRAIT_PX} height={PORTRAIT_PX} style={{ width: px, height: px, imageRendering: 'pixelated', display: drawn ? 'block' : 'none' }} />
      {drawn ? null : agent.displayName.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function providerLabel(provider: string): string {
  return provider.replace(/-cli$/, '').replace(/-api$/, ' api')
}
