#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NATIVE_SQLITE_PACKAGES = ['better-sqlite3', 'sqlite3', '@vscode/sqlite3']

function assertNoNativeSqliteDeps(pkgJsonPath, pkgJsonText) {
  const parsed = JSON.parse(pkgJsonText)
  const buckets = [
    ['dependencies', parsed.dependencies ?? {}],
    ['devDependencies', parsed.devDependencies ?? {}],
    ['optionalDependencies', parsed.optionalDependencies ?? {}],
  ]

  const offenders = []
  for (const [bucketName, bucket] of buckets) {
    for (const name of NATIVE_SQLITE_PACKAGES) {
      if (Object.hasOwn(bucket, name)) {
        offenders.push(`${name} (${bucketName})`)
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `native sqlite dependency found in ${pkgJsonPath}: ${offenders.join(', ')}\n` +
        'Use built-in node:sqlite to avoid Electron native packaging issues.',
    )
  }
}

async function verifyDependencyPolicy() {
  const rootPkgPath = join(root, 'package.json')
  const desktopPkgPath = join(root, 'apps/desktop/package.json')
  const [rootPkg, desktopPkg] = await Promise.all([
    readFile(rootPkgPath, 'utf8'),
    readFile(desktopPkgPath, 'utf8'),
  ])
  assertNoNativeSqliteDeps(rootPkgPath, rootPkg)
  assertNoNativeSqliteDeps(desktopPkgPath, desktopPkg)
}

async function verifyNodeProbe(dbPath) {
  let sqlite
  try {
    sqlite = await import('node:sqlite')
  } catch (error) {
    throw new Error(
      `node:sqlite is unavailable in current Node runtime (${process.version}): ${String(error)}`,
    )
  }
  const { DatabaseSync } = sqlite
  const db = new DatabaseSync(dbPath)
  try {
    const mode = String(db.prepare('PRAGMA journal_mode = WAL;').get().journal_mode ?? '')
    if (mode.toLowerCase() !== 'wal') {
      throw new Error(`unexpected journal_mode from node runtime: ${mode}`)
    }
    const row = db.prepare('SELECT 1 AS one').get()
    if (row.one !== 1) {
      throw new Error('node runtime sqlite query failed')
    }
  } finally {
    db.close()
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      rejectPromise(error)
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} failed (exit ${code})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      )
    })
  })
}

async function verifyElectronProbe(dbPath) {
  const probeCode = [
    "import { DatabaseSync } from 'node:sqlite'",
    'const db = new DatabaseSync(process.env.PLANETZ_SQLITE_PROBE_DB)',
    "const mode = String(db.prepare('PRAGMA journal_mode = WAL;').get().journal_mode ?? '')",
    "if (mode.toLowerCase() !== 'wal') throw new Error('unexpected journal_mode from electron runtime: ' + mode)",
    "const row = db.prepare('SELECT 1 AS one').get()",
    "if (row.one !== 1) throw new Error('electron runtime sqlite query failed')",
    'db.close()',
    "console.log('electron-sqlite-probe-ok')",
  ].join(';')

  const result = await runCommand(
    'pnpm',
    ['--filter', '@planetz/desktop', 'exec', 'electron', '--input-type=module', '-e', probeCode],
    {
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        PLANETZ_SQLITE_PROBE_DB: dbPath,
      },
    },
  )

  if (!result.stdout.includes('electron-sqlite-probe-ok')) {
    throw new Error(
      `electron sqlite probe output was unexpected:\n${result.stdout}\n${result.stderr}`,
    )
  }
}

async function main() {
  await verifyDependencyPolicy()
  const tmp = await mkdtemp(join(tmpdir(), 'planetz-sqlite-compat-'))
  const dbPath = join(tmp, 'probe.db')
  try {
    await verifyNodeProbe(dbPath)
    await verifyElectronProbe(dbPath)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }

  console.log('sqlite-electron-compat: ok')
  console.log('- driver: node:sqlite')
  console.log('- native sqlite addon dependency: none')
  console.log('- node runtime probe: ok')
  console.log('- electron runtime probe: ok')
}

await main()
