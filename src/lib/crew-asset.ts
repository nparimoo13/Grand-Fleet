/** Build a grandfleet:// URL for a crew asset path relative to `assets/`. */
export function crewAssetUrl(crewId: string, relativePath: string): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return `grandfleet://crews/${crewId}/${rel}`
}
