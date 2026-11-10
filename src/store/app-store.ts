import { useMemo } from 'react'
import { create } from 'zustand'
import type {
  ActivityRecord,
  AppPreferences,
  CrewIndexEntry,
  CrewPack,
  DeckTab,
  Voyage
} from '@shared/ipc'
import { CATEGORY_LABELS, DEFAULT_PREFERENCES } from '@shared/ipc'
import { errorMessage, invoke } from '@/lib/api'
import { disposeAllTerminals } from '@/terminal/registry'
import { buildDemo, type DemoData } from './demo'
import { refreshSnapshots, startLiveEvents, useLiveStore, type AgentLive } from './live-store'
import {
  effectiveCharacters,
  type ActivityItem,
  type AgentRuntime,
  type Bounty,
  type DenDenRequest,
  type EffectiveCharacter,
  OFF_DUTY_RUNTIME
} from './types'

export type SettingsTab = 'voyage' | 'crew' | 'policy' | 'keys' | 'scene'

export interface Notice {
  id: number
  kind: 'error' | 'info'
  text: string
}

interface AppState {
  booted: boolean
  version: string
  prefs: AppPreferences
  crewIndex: CrewIndexEntry[]
  pack: CrewPack | null
  voyages: Voyage[]
  voyage: Voyage | null
  realActiveIds: string[]
  realStartedAt: Record<string, number>
  realActivity: ActivityRecord[]
  demo: DemoData | null
  selectedId: string
  activeTab: DeckTab
  settingsOpen: boolean
  settingsTab: SettingsTab
  infoAgentId: string | null
  notice: Notice | null
  queueDraft: string

  init: () => Promise<void>
  updatePrefs: (patch: Partial<AppPreferences>) => Promise<void>
  switchCrew: (crewId: string) => Promise<void>
  refreshVoyages: () => Promise<void>
  openVoyage: (id: string) => Promise<void>
  pickVoyage: () => Promise<void>
  createVoyage: (name: string) => Promise<boolean>
  forgetVoyage: (id: string) => Promise<void>
  toggleAgent: (agentId: string, active?: boolean) => Promise<void>
  openInIde: (agentId: string | null) => Promise<void>
  refreshActivity: () => Promise<void>
  resolveDenDen: (id: string, decision: 'allow' | 'deny') => Promise<void>
  sendDraft: () => Promise<void>
  restartAgent: (agentId: string) => Promise<void>
  select: (id: string) => void
  setTab: (tab: DeckTab) => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  showInfo: (id: string | null) => void
  setQueueDraft: (text: string) => void
  notify: (kind: Notice['kind'], text: string) => void
  dismissNotice: () => void
}

let noticeSeq = 0

function deriveDemo(prefs: AppPreferences, voyage: Voyage | null, pack: CrewPack | null): DemoData | null {
  return prefs.demoData && !voyage && pack ? buildDemo(pack) : null
}

export const useAppStore = create<AppState>((set, get) => {
  const fail = (err: unknown): void => get().notify('error', errorMessage(err))

  const loadPack = async (crewId: string): Promise<CrewPack> => {
    try {
      return await invoke('crews:load', { crewId })
    } catch (err) {
      // Fall back to the first available crew rather than leaving the app empty.
      const first = get().crewIndex.find((c) => c.available && c.id !== crewId)
      if (!first) throw err
      get().notify('error', `Could not load crew "${crewId}": ${errorMessage(err)}. Using ${first.name}.`)
      await invoke('settings:set', { activeCrewId: first.id })
      return invoke('crews:load', { crewId: first.id })
    }
  }

  const applyVoyage = async (voyage: Voyage): Promise<void> => {
    const [activeIds, prefs, voyages] = await Promise.all([
      invoke('agents:listActive', { voyageId: voyage.id }),
      invoke('settings:get'),
      invoke('voyages:list', { crewId: voyage.crewId })
    ])
    const now = Date.now()
    const { pack } = get()
    disposeAllTerminals()
    useLiveStore.getState().clear()
    set({
      voyage,
      voyages,
      prefs,
      realActiveIds: activeIds,
      realStartedAt: Object.fromEntries(activeIds.map((id) => [id, now])),
      demo: null,
      selectedId: pack?.captainId ?? get().selectedId
    })
    await Promise.all([get().refreshActivity(), refreshSnapshots().catch(() => undefined)])
  }

  /** Forget everything tied to the open voyage (its sessions are parked by the main process). */
  const closeLive = (): void => {
    disposeAllTerminals()
    useLiveStore.getState().clear()
  }

  return {
    booted: false,
    version: '',
    prefs: structuredClone(DEFAULT_PREFERENCES),
    crewIndex: [],
    pack: null,
    voyages: [],
    voyage: null,
    realActiveIds: [],
    realStartedAt: {},
    realActivity: [],
    demo: null,
    selectedId: '',
    activeTab: 'terminal',
    settingsOpen: false,
    settingsTab: 'voyage',
    infoAgentId: null,
    notice: null,
    queueDraft: '',

    init: async () => {
      // Subscribe before any voyage opens so no early session event is missed.
      startLiveEvents(() => void get().refreshActivity())
      try {
        const [version, prefs, crewIndex] = await Promise.all([
          invoke('app:getVersion'),
          invoke('settings:get'),
          invoke('crews:list')
        ])
        set({ version, prefs, crewIndex })
        const pack = await loadPack(prefs.activeCrewId)
        const current = await invoke('settings:get')
        const voyages = await invoke('voyages:list', { crewId: pack.id })
        set({
          prefs: current,
          pack,
          voyages,
          selectedId: pack.captainId,
          demo: deriveDemo(current, null, pack)
        })
        const last = current.activeVoyageId ? voyages.find((v) => v.id === current.activeVoyageId) : undefined
        if (last) {
          try {
            await applyVoyage(await invoke('voyages:open', { id: last.id }))
          } catch (err) {
            await invoke('settings:set', { activeVoyageId: null })
            fail(err)
          }
        }
      } catch (err) {
        fail(err)
      } finally {
        set({ booted: true })
      }
    },

    updatePrefs: async (patch) => {
      try {
        const prefs = await invoke('settings:set', patch)
        const { voyage, pack } = get()
        set({ prefs, demo: deriveDemo(prefs, voyage, pack) })
      } catch (err) {
        fail(err)
      }
    },

    switchCrew: async (crewId) => {
      if (crewId === get().pack?.id) return
      try {
        await invoke('settings:set', { activeCrewId: crewId, activeVoyageId: null })
        closeLive()
        const [pack, prefs, voyages] = await Promise.all([
          loadPack(crewId),
          invoke('settings:get'),
          invoke('voyages:list', { crewId })
        ])
        set({
          pack,
          prefs,
          voyages,
          voyage: null,
          realActiveIds: [],
          realStartedAt: {},
          realActivity: [],
          selectedId: pack.captainId,
          demo: deriveDemo(prefs, null, pack)
        })
        if (voyages[0]) await get().openVoyage(voyages[0].id)
      } catch (err) {
        fail(err)
      }
    },

    refreshVoyages: async () => {
      const crewId = get().pack?.id
      if (!crewId) return
      try {
        set({ voyages: await invoke('voyages:list', { crewId }) })
      } catch (err) {
        fail(err)
      }
    },

    openVoyage: async (id) => {
      try {
        await applyVoyage(await invoke('voyages:open', { id }))
      } catch (err) {
        fail(err)
        await get().refreshVoyages()
      }
    },

    pickVoyage: async () => {
      const crewId = get().pack?.id
      if (!crewId) return
      try {
        const voyage = await invoke('voyages:pickAndOpen', { crewId })
        if (voyage) await applyVoyage(voyage)
      } catch (err) {
        fail(err)
      }
    },

    createVoyage: async (name) => {
      const crewId = get().pack?.id
      if (!crewId) return false
      try {
        await applyVoyage(await invoke('voyages:create', { crewId, name }))
        return true
      } catch (err) {
        fail(err)
        return false
      }
    },

    forgetVoyage: async (id) => {
      try {
        const voyages = await invoke('voyages:forget', { id })
        const { voyage, prefs, pack } = get()
        const closing = voyage?.id === id
        if (closing) closeLive()
        const nextPrefs = closing ? { ...prefs, activeVoyageId: null } : prefs
        set({
          voyages,
          ...(closing
            ? {
                voyage: null,
                prefs: nextPrefs,
                realActiveIds: [],
                realStartedAt: {},
                realActivity: [],
                demo: deriveDemo(nextPrefs, null, pack)
              }
            : {})
        })
      } catch (err) {
        fail(err)
      }
    },

    toggleAgent: async (agentId, active) => {
      const { voyage, realActiveIds, demo } = get()
      if (!voyage) {
        get().notify('info', demo ? 'This is demo data. Open or create a voyage to put crew on duty.' : 'Open a voyage first.')
        return
      }
      const next = active ?? !realActiveIds.includes(agentId)
      try {
        const res = await invoke('agents:setActive', { voyageId: voyage.id, agentId, active: next })
        const ids = new Set(get().realActiveIds)
        const started = { ...get().realStartedAt }
        if (res.active) {
          ids.add(agentId)
          started[agentId] ??= Date.now()
        } else {
          ids.delete(agentId)
          delete started[agentId]
        }
        set({ realActiveIds: [...ids], realStartedAt: started })
        if (res.warning) get().notify('info', res.warning)
        await get().refreshActivity()
      } catch (err) {
        fail(err)
      }
    },

    openInIde: async (agentId) => {
      const { voyage } = get()
      if (!voyage) return get().notify('info', 'Open a voyage first.')
      try {
        await invoke('agents:openInIde', { voyageId: voyage.id, agentId })
      } catch (err) {
        fail(err)
      }
    },

    refreshActivity: async () => {
      const crewId = get().pack?.id
      if (!crewId) return
      try {
        set({ realActivity: await invoke('activity:list', { crewId, limit: 100 }) })
      } catch (err) {
        fail(err)
      }
    },

    resolveDenDen: async (id, decision) => {
      const { demo } = get()
      if (demo) {
        set((s) => {
          if (!s.demo) return s
          const req = s.demo.denDen.find((r) => r.id === id)
          if (!req) return s
          const name = s.pack?.characters.find((c) => c.id === req.agentId)?.displayName ?? 'A crew member'
          const runtime = { ...s.demo.runtime }
          const rt = runtime[req.agentId]
          if (rt) runtime[req.agentId] = { ...rt, status: 'working', statusLine: decision === 'allow' ? 'Approved. Carrying on.' : 'Denied. Finding another way.' }
          return {
            demo: {
              ...s.demo,
              runtime,
              denDen: s.demo.denDen.filter((r) => r.id !== id),
              activity: [
                ...s.demo.activity,
                { id: `x${Date.now()}`, at: new Date().toISOString(), message: `You ${decision === 'allow' ? 'allowed' : 'denied'} ${name}: ${req.detail}` }
              ]
            }
          }
        })
        return
      }
      const req = Object.values(useLiveStore.getState().live)
        .flatMap((l) => l.pending)
        .find((p) => p.id === id)
      if (!req) return
      try {
        await invoke('agents:decide', { agentId: req.agentId, requestId: id, decision })
      } catch (err) {
        // Usually "answered in the terminal already": the queue entry is stale, so drop it.
        useLiveStore.getState().apply({ type: 'permissionResolved', agentId: req.agentId, requestId: id, outcome: 'terminal', by: 'terminal' })
        fail(err)
      }
    },

    sendDraft: async () => {
      const { queueDraft, selectedId, voyage, demo, pack } = get()
      const text = queueDraft.trim()
      if (!text) return
      if (!voyage) {
        get().notify('info', demo ? 'This is demo data. Open or create a voyage to message the crew.' : 'Open a voyage first.')
        return
      }
      if (!get().realActiveIds.includes(selectedId)) {
        const name = pack?.characters.find((c) => c.id === selectedId)?.displayName ?? 'That crew member'
        get().notify('info', `${name} is off duty. Put them on duty first.`)
        return
      }
      try {
        await invoke('agents:send', { agentId: selectedId, message: text })
        set({ queueDraft: '' })
      } catch (err) {
        fail(err)
      }
    },

    restartAgent: async (agentId) => {
      const { voyage } = get()
      if (!voyage) return
      try {
        await invoke('agents:restart', { voyageId: voyage.id, agentId })
      } catch (err) {
        fail(err)
      }
    },

    select: (id) => set({ selectedId: id }),
    setTab: (tab) => set({ activeTab: tab }),
    openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
    closeSettings: () => set({ settingsOpen: false }),
    showInfo: (id) => set({ infoAgentId: id }),
    setQueueDraft: (text) => set({ queueDraft: text }),
    notify: (kind, text) => set({ notice: { id: ++noticeSeq, kind, text } }),
    dismissNotice: () => set({ notice: null })
  }
})

export interface Agent extends EffectiveCharacter {
  active: boolean
  runtime: AgentRuntime
}

const OFF_DUTY = OFF_DUTY_RUNTIME

/** On duty but the main process has not reported a session yet. */
const STARTING: AgentRuntime = { ...OFF_DUTY_RUNTIME, status: 'idle', statusLine: 'Starting...' }

function runtimeFromLive(live: AgentLive | undefined): AgentRuntime {
  if (!live) return STARTING
  return {
    status: live.status,
    statusLine: live.statusText,
    contextPercent: live.usage.contextPercent === null ? null : Math.round(live.usage.contextPercent),
    contextTokens: live.usage.inputTokens > 0 ? live.usage.inputTokens : null,
    costUsd: live.usage.costUsd > 0 ? live.usage.costUsd : null,
    startedAt: live.startedAt,
    running: live.running,
    error: live.error
  }
}

/** Crew with overrides, activation and runtime state merged. Memoised per input change. */
export function useAgents(): Agent[] {
  const pack = useAppStore((s) => s.pack)
  const overrides = useAppStore((s) => s.prefs.characterOverrides)
  const realActiveIds = useAppStore((s) => s.realActiveIds)
  const demo = useAppStore((s) => s.demo)
  const live = useLiveStore((s) => s.live)
  return useMemo(() => {
    const chars = effectiveCharacters(pack, overrides)
    const activeIds = demo ? demo.activeIds : realActiveIds
    return chars.map((c) => {
      const active = activeIds.includes(c.id)
      const runtime: AgentRuntime = !active ? OFF_DUTY : demo ? (demo.runtime[c.id] ?? OFF_DUTY) : runtimeFromLive(live[c.id])
      return { ...c, active, runtime }
    })
  }, [pack, overrides, realActiveIds, demo, live])
}
export function useSelectedAgent(): Agent | undefined {
  const agents = useAgents()
  const selectedId = useAppStore((s) => s.selectedId)
  return agents.find((a) => a.id === selectedId) ?? agents[0]
}

export function useBounties(): Bounty[] {
  return useAppStore((s) => s.demo?.bounties) ?? EMPTY_BOUNTIES
}
const EMPTY_BOUNTIES: Bounty[] = []

/** The Den Den Mushi queue: demo fixtures with no voyage, otherwise real pending permission requests. */
export function useDenDen(): DenDenRequest[] {
  const demo = useAppStore((s) => s.demo)
  const live = useLiveStore((s) => s.live)
  return useMemo(() => {
    if (demo) return demo.denDen
    return Object.values(live)
      .flatMap((l) => l.pending)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
      .map((p) => ({
        id: p.id,
        agentId: p.agentId,
        summary: p.summary,
        detail: p.detail,
        at: Date.parse(p.requestedAt),
        reason: p.reason,
        categoryLabel: CATEGORY_LABELS[p.category].label,
        tool: p.tool
      }))
  }, [demo, live])
}

export function useActivityItems(): ActivityItem[] {
  const demo = useAppStore((s) => s.demo)
  const real = useAppStore((s) => s.realActivity)
  return useMemo(
    () => (demo ? [...demo.activity].reverse() : real.map((r) => ({ id: String(r.id), at: r.at, message: r.message }))),
    [demo, real]
  )
}
