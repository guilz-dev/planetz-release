#!/usr/bin/env node
/**
 * CI gate: fail when pnpm reports high-or-critical dependency advisories.
 * @see https://github.com/guilz-dev/planetz/issues/7
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const level = process.env.PLANETZ_AUDIT_LEVEL?.trim() || 'high'

const result = spawnSync('pnpm', ['audit', `--audit-level=${level}`], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (result.stdout?.trim()) {
  process.stdout.write(result.stdout)
}
if (result.stderr?.trim()) {
  process.stderr.write(result.stderr)
}

if (result.status === 0) {
  console.info(`[audit-dependencies] No ${level}+ advisories reported by pnpm audit.`)
  process.exit(0)
}

if (result.error) {
  console.error('[audit-dependencies] Failed to run pnpm audit:', result.error.message)
  process.exit(1)
}

console.error(
  `[audit-dependencies] pnpm audit reported ${level} or critical vulnerabilities (exit ${result.status ?? 'unknown'}).`,
)
process.exit(result.status === null ? 1 : result.status)
