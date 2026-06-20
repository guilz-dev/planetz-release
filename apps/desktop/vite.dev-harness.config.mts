import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  define: {
    __BRIDGE_REVISION__: JSON.stringify('dev-harness'),
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
  plugins: [react(), tailwindcss()],
  server: { port: 5191 },
})
