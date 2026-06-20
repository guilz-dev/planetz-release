import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG, SIDECAR_DIR_NAME } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateLegacyMainTaktFacetsToOrbitIfNeeded } from '../../planetz/orbit-facets-migrate.js'

describe('migrateLegacyMainTaktFacetsToOrbitIfNeeded', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
  })

  it('copies main .takt/facets into sidecar facets once', async () => {
    workspace = join(tmpdir(), `planetz-facet-migrate-${Date.now()}`)
    const legacyDir = join(workspace, '.takt', 'facets', 'personas')
    await mkdir(legacyDir, { recursive: true })
    await writeFile(join(legacyDir, 'coder.md'), '# Coder\n', 'utf8')

    const migrated = await migrateLegacyMainTaktFacetsToOrbitIfNeeded(workspace, DEFAULT_CONFIG)
    expect(migrated).toBe(true)

    const body = await readFile(
      join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'coder.md'),
      'utf8',
    )
    expect(body).toBe('# Coder\n')

    const again = await migrateLegacyMainTaktFacetsToOrbitIfNeeded(workspace, DEFAULT_CONFIG)
    expect(again).toBe(false)
  })

  it('ignores broken symlinks under legacy facets directory', async () => {
    workspace = join(tmpdir(), `planetz-facet-migrate-broken-link-${Date.now()}`)
    const legacyDir = join(workspace, '.takt', 'facets', 'personas')
    await mkdir(legacyDir, { recursive: true })
    await writeFile(join(legacyDir, 'coder.md'), '# Coder\n', 'utf8')
    await symlink(join(workspace, 'missing-skill-target'), join(legacyDir, 'skill-remove-design'))

    const migrated = await migrateLegacyMainTaktFacetsToOrbitIfNeeded(workspace, DEFAULT_CONFIG)
    expect(migrated).toBe(true)
    const body = await readFile(
      join(workspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'coder.md'),
      'utf8',
    )
    expect(body).toBe('# Coder\n')
  })
})
