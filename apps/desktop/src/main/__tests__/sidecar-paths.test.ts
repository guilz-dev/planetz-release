import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
  PLANETZ_SIDECAR_DIR_BASENAME,
  PLANETZ_SQLITE_FILENAME,
  SIDECAR_DIR_NAME,
} from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { resolveWorkspaceSidecarRoot } from '../sidecar/sidecar-paths.js'

describe('resolveWorkspaceSidecarRoot', () => {
  it('creates sidecar root when no sidecar exists', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'planetz-sidecar-new-'))
    const root = await resolveWorkspaceSidecarRoot(workspace)
    expect(root).toBe(join(workspace, SIDECAR_DIR_NAME))
  })

  it('prefers sidecar root when sqlite exists', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'planetz-sidecar-db-'))
    const primary = join(workspace, SIDECAR_DIR_NAME)
    await mkdir(primary, { recursive: true })
    await writeFile(join(primary, PLANETZ_SQLITE_FILENAME), '', 'utf8')
    const root = await resolveWorkspaceSidecarRoot(workspace)
    expect(root).toBe(primary)
  })

  it('uses sidecar root when directory exists and has no persisted data', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'planetz-sidecar-empty-'))
    const orbit = join(workspace, SIDECAR_DIR_NAME)
    await mkdir(orbit, { recursive: true })

    const root = await resolveWorkspaceSidecarRoot(workspace)
    expect(root).toBe(orbit)
  })

  it('falls back to typo legacy .planets/orbit when canonical sidecar is absent', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'planetz-sidecar-legacy-'))
    const legacy = join(
      workspace,
      LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
      PLANETZ_SIDECAR_DIR_BASENAME,
    )
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, PLANETZ_SQLITE_FILENAME), '', 'utf8')

    const root = await resolveWorkspaceSidecarRoot(workspace)
    expect(root).toBe(legacy)
  })

  it('prefers typo legacy with data over empty canonical directory', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'planetz-sidecar-legacy-over-empty-'))
    const canonical = join(workspace, SIDECAR_DIR_NAME)
    const legacy = join(
      workspace,
      LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
      PLANETZ_SIDECAR_DIR_BASENAME,
    )
    await mkdir(canonical, { recursive: true })
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, PLANETZ_SQLITE_FILENAME), '', 'utf8')

    const root = await resolveWorkspaceSidecarRoot(workspace)
    expect(root).toBe(legacy)
  })
})
