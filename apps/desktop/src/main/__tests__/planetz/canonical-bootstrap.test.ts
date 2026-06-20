import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyCanonicalImport,
  ensureCanonicalScaffold,
  previewCanonicalImport,
} from '../../planetz/canonical-bootstrap.js'
import * as taktImportSources from '../../planetz/takt-import-sources.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

describe('ensureCanonicalBootstrap', { timeout: BUNDLED_CLI_TEST_TIMEOUT_MS }, () => {
  let workspace = ''
  let sidecar = ''

  afterEach(async () => {
    vi.restoreAllMocks()
    const dir = workspace
    workspace = ''
    sidecar = ''
    if (dir) {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  })

  it('imports engine config from .takt once and does not overwrite existing .orbit file', async () => {
    vi.spyOn(taktImportSources, 'isHomeGlobalImportAvailable').mockResolvedValue(false)
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-'))
    sidecar = join(workspace, '.orbit')
    await mkdir(sidecar, { recursive: true })
    await mkdir(join(workspace, '.takt'), { recursive: true })
    await writeFile(
      join(workspace, '.takt', 'config.yaml'),
      'provider: from-takt\nmodel: takt-model\n',
      'utf8',
    )
    const paths = mockSidecarPaths(sidecar)
    const config = { ...DEFAULT_CONFIG, taktDir: '.takt', facetsDir: 'facets' }

    await ensureCanonicalScaffold(paths)
    const offer = await previewCanonicalImport(workspace, config, paths, {
      taktRepoPath: workspace,
    })
    expect(offer?.engineConfig).toBe(true)
    const first = await applyCanonicalImport(workspace, config, paths, offer!, {
      taktRepoPath: workspace,
    })
    expect(first.engineConfigImported).toBe(true)
    const engineYaml = await readFile(paths.engineConfigPath, 'utf8')
    expect(engineYaml).toContain('from-takt')

    await writeFile(paths.engineConfigPath, 'provider: local-edit\n', 'utf8')
    const secondOffer = await previewCanonicalImport(workspace, config, paths)
    expect(secondOffer).toBeNull()
    const kept = await readFile(paths.engineConfigPath, 'utf8')
    expect(kept).toContain('local-edit')
    expect(kept).not.toContain('from-takt')
  })

  it('offers import when only ~/.takt global content is available', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-home-only-'))
    sidecar = join(workspace, '.orbit')
    await mkdir(sidecar, { recursive: true })
    const paths = mockSidecarPaths(sidecar)
    const config = { ...DEFAULT_CONFIG, taktDir: '.takt', facetsDir: 'facets' }

    vi.spyOn(taktImportSources, 'isHomeGlobalImportAvailable').mockResolvedValue(true)

    const offer = await previewCanonicalImport(workspace, config, paths)
    expect(offer?.engineConfig).toBe(false)
    expect(offer?.homeGlobalAvailable).toBe(true)
  })

  it('does not import ~/.takt unless importHomeGlobal is true', async () => {
    vi.spyOn(taktImportSources, 'isHomeGlobalImportAvailable').mockResolvedValue(false)
    workspace = await mkdtemp(join(tmpdir(), 'planetz-ws-no-home-'))
    sidecar = join(workspace, '.orbit')
    await mkdir(sidecar, { recursive: true })
    const paths = mockSidecarPaths(sidecar)
    const config = { ...DEFAULT_CONFIG, taktDir: '.takt', facetsDir: 'facets' }

    const homeImport = vi
      .spyOn(taktImportSources, 'importGlobalTaktFromHome')
      .mockResolvedValue({ configImported: true, workflowsImported: ['wf'] })

    await applyCanonicalImport(workspace, config, paths, {
      engineConfig: false,
      workflows: [],
    })
    expect(homeImport).not.toHaveBeenCalled()

    await applyCanonicalImport(workspace, config, paths, {
      engineConfig: false,
      workflows: [],
      importHomeGlobal: true,
    })
    expect(homeImport).toHaveBeenCalledOnce()
  })
})
