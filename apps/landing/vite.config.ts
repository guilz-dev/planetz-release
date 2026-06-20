import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname),
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        manta: resolve(__dirname, 'manta.html'),
      },
    },
  },
  server: {
    port: 5175,
    strictPort: true,
  },
})
