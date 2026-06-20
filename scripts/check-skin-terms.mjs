#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))

const BANNED = [
  'shari',
  'neta',
  'sushi',
  'enqueueNeta',
  'reassignNeta',
  'takt-sushi-planet',
  'SushiCounter',
]

const SCAN_ROOTS = [
  join(root, 'packages/shared/src'),
  join(root, 'apps/desktop/src/main'),
  join(root, 'apps/desktop/src/preload'),
]

const SKIP_DIRS = new Set(['skins', '__tests__'])

function collectFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      collectFiles(path, out)
      continue
    }
    if (/\.(ts|tsx)$/.test(name) && name !== 'constants.ts') {
      out.push(path)
    }
  }
  return out
}

const violations = []

for (const scanRoot of SCAN_ROOTS) {
  let files = []
  try {
    files = collectFiles(scanRoot)
  } catch {
    continue
  }
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const term of BANNED) {
      if (text.includes(term)) {
        violations.push({ file: relative(root, file), term })
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Skin-specific terms found in shared/main/preload:')
  for (const v of violations) {
    console.error(`  ${v.file}: "${v.term}"`)
  }
  process.exit(1)
}

console.log('check:skin OK')
