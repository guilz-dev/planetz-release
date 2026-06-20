/**
 * Builds a URL for a file under renderer `src/renderer/public` (Vite default `publicDir`).
 *
 * For Manta GIFs under `apps/desktop/public`, use `?url` imports in
 * {@link ../skins/manta/manta-public-assets.ts} instead.
 *
 * Root-absolute paths (`/foo.png`) break under packaged Electron (`file://`).
 * `import.meta.env.BASE_URL` keeps dev (http) and production (relative file) consistent.
 */
export function rendererPublicUrl(publicPath: string): string {
  const normalized = publicPath.replace(/^\/+/, '')
  if (normalized.length === 0) {
    throw new Error('rendererPublicUrl: publicPath must not be empty')
  }
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? `${base}${normalized}` : `${base}/${normalized}`
}
