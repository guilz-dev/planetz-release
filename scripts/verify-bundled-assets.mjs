import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const desktopPackageMode = process.argv.includes('--desktop-package')

const requiredPaths = [
  'third_party/orbit/dist/app/cli/index.js',
  'resources/orbit/dist/app/cli/index.js',
  'resources/orbit/package.json',
  'resources/orbit/node_modules',
  'apps/desktop/resources/orbit/dist/app/cli/index.js',
  'apps/desktop/resources/orbit/package.json',
  'apps/desktop/resources/orbit/node_modules',
  'apps/desktop/resources/orbit/builtins/en/workflows/frontend-refactor-mock.yaml',
  'apps/desktop/resources/composer-orbit-llm-runner.mjs',
  'apps/desktop/resources/orbit-interactive-session-runner.mjs',
  'LICENSES/takt-MIT.txt',
  'THIRD_PARTY_NOTICES.md',
  'resources/licenses/takt-MIT.txt',
  'resources/licenses/THIRD_PARTY_NOTICES.md',
  'apps/desktop/resources/licenses/takt-MIT.txt',
  'apps/desktop/resources/licenses/THIRD_PARTY_NOTICES.md',
  'third_party/orbit/dist/infra/providers/ollama.js',
  'resources/orbit/dist/infra/providers/ollama.js',
  'apps/desktop/resources/orbit/dist/infra/providers/ollama.js',
]

if (desktopPackageMode && process.platform === 'darwin') {
  requiredPaths.push('apps/desktop/resources/node/bin/node')
}

const missing = []

for (const relative of requiredPaths) {
  const absolute = resolve(root, relative)
  try {
    await access(absolute)
  } catch {
    missing.push(relative)
  }
}

if (missing.length > 0) {
  console.error('[bundled-assets] missing required files:')
  for (const file of missing) {
    console.error(`- ${file}`)
  }
  process.exit(1)
}

console.log('[bundled-assets] verified')
for (const file of requiredPaths) {
  console.log(`- ${file}`)
}
