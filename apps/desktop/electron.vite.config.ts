import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { BRIDGE_REVISION } from '../../packages/shared/src/bridge-revision.js'

// Cursor injects ELECTRON_RUN_AS_NODE=1; child Electron inherits it and preload fails.
delete process.env.ELECTRON_RUN_AS_NODE

/** Ensure spawned Electron never inherits RUN_AS_NODE from the parent shell. */
function stripElectronRunAsNodePlugin() {
  return {
    name: 'strip-electron-run-as-node',
    config() {
      delete process.env.ELECTRON_RUN_AS_NODE
    },
    configureServer() {
      delete process.env.ELECTRON_RUN_AS_NODE
    },
  }
}

export default defineConfig({
  main: {
    plugins: [
      stripElectronRunAsNodePlugin(),
      externalizeDepsPlugin({ exclude: ['@planetz/shared'] }),
    ],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@planetz/shared'] })],
  },
  renderer: {
    // Relative base so `rendererPublicUrl()` works under packaged file:// loads.
    base: './',
    // Default publicDir: src/renderer/public (favicon, etc.).
    // Manta GIFs: apps/desktop/public via ?url imports in manta-public-assets.ts.
    define: {
      __BRIDGE_REVISION__: JSON.stringify(BRIDGE_REVISION),
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
      /** Fail fast when another dev session holds the port (avoids ELECTRON_RENDERER_URL mismatch). */
      strictPort: true,
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
