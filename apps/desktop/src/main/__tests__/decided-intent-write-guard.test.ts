import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

const DENYLIST_DIRS = [
  join(repoRoot, 'src/main/planetz'),
  join(repoRoot, 'src/shared/spec-driven'),
  join(repoRoot, 'src/main/session'),
] as const

const ALLOWLIST_SUFFIXES = [
  'src/main/app-session.ts',
  'src/main/sidecar/decided-intent-store.ts',
  'src/main/storage/sqlite/repositories/decided-intent-repository.ts',
  'src/main/ipc/register-spec-studio-ipc.ts',
] as const

const FORBIDDEN_PATTERNS = [
  'saveDecidedIntent',
  'decidedIntentStore.save',
  'insertDecidedIntentVersion',
  /\bDecidedIntentStore\b/,
] as const

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      files.push(...listSourceFiles(fullPath))
      continue
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

function isAllowlisted(path: string): boolean {
  return ALLOWLIST_SUFFIXES.some((suffix) => path.endsWith(suffix))
}

describe('decided intent write guard', () => {
  it('blocks facet/loop/session modules from decided_intent writes', () => {
    const violations: string[] = []

    for (const dir of DENYLIST_DIRS) {
      for (const file of listSourceFiles(dir)) {
        if (isAllowlisted(file)) continue
        const content = readFileSync(file, 'utf8')
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)) {
            violations.push(`${file} matches ${String(pattern)}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps decided-intent-context-writer read-only', () => {
    const path = join(repoRoot, 'src/main/planetz/decided-intent-context-writer.ts')
    const content = readFileSync(path, 'utf8')
    expect(content).not.toContain('saveDecidedIntent')
    expect(content).not.toContain('insertDecidedIntentVersion')
    expect(content).not.toContain('.save(')
  })
})
