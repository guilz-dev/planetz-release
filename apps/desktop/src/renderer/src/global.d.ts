import type { OrbitBridge } from '@planetz/shared'

declare global {
  interface Window {
    orbit: OrbitBridge
    orbitMeta?: { revision: string }
  }

  /** Injected by electron-vite renderer define from @planetz/shared bridge revision. */
  const __BRIDGE_REVISION__: string
}
