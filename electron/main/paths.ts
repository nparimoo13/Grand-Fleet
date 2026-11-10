import { app } from 'electron'
import path from 'node:path'

/** Root of the crew packs. Bundled as an extra resource when packaged. */
export function assetsRoot(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(app.getAppPath(), 'assets')
}
