import { spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const cliCandidates = [
  resolve(root, 'third_party', 'orbit', 'dist', 'app', 'cli', 'index.js'),
  resolve(root, 'resources', 'orbit', 'dist', 'app', 'cli', 'index.js'),
  resolve(root, 'apps', 'desktop', 'resources', 'orbit', 'dist', 'app', 'cli', 'index.js'),
]

async function resolveCliPath() {
  for (const candidate of cliCandidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // continue
    }
  }
  throw new Error(
    `bundled orbit CLI not found. run pnpm prepare:bundled-orbit first.\nchecked:\n${cliCandidates
      .map((p) => `- ${p}`)
      .join('\n')}`,
  )
}

function runCheck(cliPath, name, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: '1' },
  })

  if (result.error) {
    throw new Error(`[orbit-contract] ${name} failed to spawn: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    const stdout = (result.stdout ?? '').trim()
    throw new Error(
      `[orbit-contract] ${name} failed (exit=${result.status})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    )
  }

  console.log(`[orbit-contract] OK ${name}`)
}

const checks = [
  { name: 'help', args: ['--help'] },
  { name: 'watch help', args: ['watch', '--help'] },
  { name: 'list help', args: ['list', '--help'] },
  { name: 'list json help', args: ['list', '--format', 'json', '--help'] },
  { name: 'workflow doctor help', args: ['workflow', 'doctor', '--help'] },
  { name: 'add help', args: ['add', '--help'] },
  { name: 'run help', args: ['run', '--help'] },
]

const cliPath = await resolveCliPath()
console.log(`[orbit-contract] using CLI: ${cliPath}`)

for (const check of checks) {
  runCheck(cliPath, check.name, check.args)
}

console.log('[orbit-contract] verified')
