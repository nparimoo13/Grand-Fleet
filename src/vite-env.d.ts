/// <reference types="vite/client" />

import type { GrandFleetApi } from '../electron/preload/index'

declare global {
  interface Window {
    grandFleet: GrandFleetApi
  }
}

export {}
