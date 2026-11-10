import { useEffect } from 'react'
import { AgentInfoModal } from '@/components/AgentInfoModal'
import { CaptainsDeck } from '@/components/CaptainsDeck'
import { CrewRoster } from '@/components/CrewRoster'
import { FirstRunWizard } from '@/components/FirstRunWizard'
import { SettingsModal } from '@/components/SettingsModal'
import { ShipPreview } from '@/components/ShipPreview'
import { Toast } from '@/components/Toast'
import { TopBar } from '@/components/TopBar'
import { useAppStore } from '@/store/app-store'

export default function App() {
  const init = useAppStore((s) => s.init)
  const booted = useAppStore((s) => s.booted)
  const firstRunCompleted = useAppStore((s) => s.prefs.firstRunCompleted)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const infoAgentId = useAppStore((s) => s.infoAgentId)

  useEffect(() => {
    void init()
  }, [init])

  if (!booted) return <div className="boot pixel-title">Hoisting the sails…</div>

  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">
        <ShipPreview />
        <CaptainsDeck />
      </main>
      <CrewRoster />
      {settingsOpen ? <SettingsModal /> : null}
      {infoAgentId ? <AgentInfoModal /> : null}
      {!firstRunCompleted ? <FirstRunWizard /> : null}
      <Toast />
    </div>
  )
}
