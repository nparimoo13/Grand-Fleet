import { protocol } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { assetsRoot } from './paths'

/** Must run before app.ready. Serves packaged crew art to the renderer without exposing the whole disk. */
export function registerAssetProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'grandfleet',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function registerAssetProtocol(): void {
  const root = path.resolve(assetsRoot())
  protocol.registerFileProtocol('grandfleet', (request, callback) => {
    try {
      const raw = decodeURIComponent(request.url.replace(/^grandfleet:\/\//, ''))
      const rel = raw.replace(/^\/+/, '').replace(/\\/g, '/')
      if (!rel || rel.includes('..')) {
        callback({ error: -6 })
        return
      }
      const file = path.resolve(root, rel)
      if (!file.startsWith(root + path.sep) && file !== root) {
        callback({ error: -6 })
        return
      }
      if (!existsSync(file)) {
        callback({ error: -6 })
        return
      }
      callback({ path: file })
    } catch {
      callback({ error: -2 })
    }
  })
}

/** URL for a file under `assets/` (e.g. `crews/strawhats/ship/scene.png`). */
export function assetUrl(relativePath: string): string {
  return `grandfleet://${relativePath.split(path.sep).join('/')}`
}
