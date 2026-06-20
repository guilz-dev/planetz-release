import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const sourceOrbitRoot = resolve(root, 'third_party/orbit')
const sourceCliDir = resolve(sourceOrbitRoot, 'dist')
const sourceBuiltinsDir = resolve(sourceOrbitRoot, 'builtins')
const sourcePackageJson = resolve(sourceOrbitRoot, 'package.json')
const sourceNodeModules = resolve(sourceOrbitRoot, 'node_modules')
const sourceMit = resolve(root, 'LICENSES/takt-MIT.txt')
const sourceNotices = resolve(root, 'THIRD_PARTY_NOTICES.md')

const copyDirs = [
  resolve(root, 'resources/orbit/dist'),
  resolve(root, 'apps/desktop/resources/orbit/dist'),
]

const copyBuiltinsDirs = [
  resolve(root, 'resources/orbit/builtins'),
  resolve(root, 'apps/desktop/resources/orbit/builtins'),
]

const copyRuntimeRoots = [
  resolve(root, 'resources/orbit'),
  resolve(root, 'apps/desktop/resources/orbit'),
]

const licenseTargets = [
  resolve(root, 'resources/licenses'),
  resolve(root, 'apps/desktop/resources/licenses'),
]

await access(sourceCliDir)
await access(sourceBuiltinsDir)
await access(sourcePackageJson)
await access(sourceNodeModules)
await access(sourceMit)
await access(sourceNotices)

for (const dir of copyDirs) {
  await mkdir(dirname(dir), { recursive: true })
  await cp(sourceCliDir, dir, { recursive: true, force: true })
}

for (const dir of copyBuiltinsDirs) {
  await mkdir(dirname(dir), { recursive: true })
  await cp(sourceBuiltinsDir, dir, { recursive: true, force: true })
}

for (const targetRoot of copyRuntimeRoots) {
  await mkdir(targetRoot, { recursive: true })
  await cp(sourcePackageJson, resolve(targetRoot, 'package.json'), { force: true })
  await cp(sourceNodeModules, resolve(targetRoot, 'node_modules'), { recursive: true, force: true })
}

const mitText = await readFile(sourceMit, 'utf8')
const noticesText = await readFile(sourceNotices, 'utf8')

for (const target of licenseTargets) {
  await mkdir(target, { recursive: true })
  await writeFile(resolve(target, 'takt-MIT.txt'), mitText, 'utf8')
  await writeFile(resolve(target, 'THIRD_PARTY_NOTICES.md'), noticesText, 'utf8')
}

console.log(
  '[bundled-assets] synced orbit dist, builtins, runtime (package.json + node_modules), and licenses',
)
for (const dir of copyDirs) {
  console.log(`- ${dir}`)
}
for (const dir of copyBuiltinsDirs) {
  console.log(`- ${dir}`)
}
for (const target of licenseTargets) {
  console.log(`- ${target}`)
}
