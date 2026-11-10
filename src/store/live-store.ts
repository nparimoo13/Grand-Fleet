import { create } from 'zustand'
import type { AgentEvent, AgentSnapshot, PermissionRequestInfo } from '@shared/ipc'
import { invoke } from '@/lib/api'
import { disposeTerminal, startTerminalOutput } from '@/terminal/registry'
import { applyEvent, fromSnapshot, type AgentLive } from './live-reducer'

export type { AgentLive } from './live-reducer'

interface LiveState {
  live: Record<string, AgentLive>
  setSnapshots: (snapshots: AgentSnapshot[]) => void
  apply: (event: AgentEvent) => void
  clear: () => void
}

export const useLiveStore = create<LiveState>((set) => ({
  live: {},
  setSnapshots: (snapshots) => set({ live: Object.fromEntries(snapshots.map((s) => [s.agentId, fromSnapshot(s)])) }),
  apply: (event) => set((s) => ({ live: applyEvent(s.live, event) })),
  clear: () => set({ live: {} })
}))

export async function refreshSnapshots(): Promise<void> {
  useLiveStore.getState().setSnapshots(await invoke('agents:snapshot'))
}

/** Subscribe to agent events from main. `onActivity` fires when the activity log changed. */
export function startLiveEvents(onActivity: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const offOutput = startTerminalOutput()
  const off = window.grandFleet.on('agent:event', (event) => {
    useLiveStore.getState().apply(event)
    // Stood down: free the terminal. (Failures keep theirs so the error stays visible.)
    if (event.type === 'running' && !event.running && event.error === null) disposeTerminal(event.agentId)
    if (event.type === 'activity' && !timer) {
      timer = setTimeout(() => {
        timer = null
        onActivity()
      }, 250)
    }
  })
  return () => {
    off()
    offOutput()
    if (timer) clearTimeout(timer)
  }
}

/** All requests waiting in the Den Den Mushi queue, oldest first. */
export function usePendingRequests(): PermissionRequestInfo[] {
  const live = useLiveStore((s) => s.live)
  return Object.values(live)
    .flatMap((l) => l.pending)
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
}
