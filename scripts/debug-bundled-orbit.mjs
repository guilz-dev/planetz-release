import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const candidates = []
const resourcesPath = process.resourcesPath?.trim()
if (resourcesPath) {
  candidates.push(resolve(resourcesPath, 'orbit', 'dist', 'app', 'cli', 'index.js'))
  candidates.push(resolve(resourcesPath, 'third_party', 'orbit', 'dist', 'app', 'cli', 'index.js'))
}
candidates.push(resolve(root, 'third_party', 'orbit', 'dist', 'app', 'cli', 'index.js'))
candidates.push(resolve(root, 'resources', 'orbit', 'dist', 'app', 'cli', 'index.js'))
candidates.push(
  resolve(root, 'apps', 'desktop', 'resources', 'orbit', 'dist', 'app', 'cli', 'index.js'),
)
const roots = [
  resolve(root, 'third_party', 'orbit'),
  resolve(root, 'resources', 'orbit'),
  resolve(root, 'apps', 'desktop', 'resources', 'orbit'),
]

console.log('[bundled-orbit] debug info')
console.log(`- cwd: ${process.cwd()}`)
console.log(`- process.resourcesPath: ${resourcesPath ?? '(undefined)'}`)

for (const path of candidates) {
  try {
    await access(path)
    console.log(`OK  ${path}`)
  } catch {
    console.log(`MISS ${path}`)
  }
}

for (const base of roots) {
  const pkg = resolve(base, 'package.json')
  const modules = resolve(base, 'node_modules')
  try {
    await access(pkg)
    await access(modules)
    console.log(`RUNNABLE ${base}`)
  } catch {
    console.log(`NOT-RUNNABLE ${base}`)
  }
}
