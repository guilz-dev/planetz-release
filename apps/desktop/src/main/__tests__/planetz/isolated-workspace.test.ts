import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  PLANETZ_SIDECAR_PARENT_DIR_NAME,
  PLANETZ_SQLITE_FILENAME,
  SIDECAR_DIR_NAME,
} from '@planetz/shared'
import { execa } from 'execa'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { syncIsolatedRepoToMain } from '../../planetz/isolated-repo-sync.js'
import { ensureIsolatedTaktWorkspace } from '../../planetz/isolated-takt-workspace.js'
import {
  assertIsolatedOutsideMain,
  hashMainWorkspacePath,
  isolatedRepoPath,
  isolatedTaktCompatWorktreesRoot,
  isolatedTaktWorktreesRoot,
} from '../../planetz/isolated-workspace-paths.js'
import { projectMainOrbitToIsolated } from '../../planetz/orbit-isolated-projection.js'
import { openSidecarSqlite } from '../../storage/sqlite/connection.js'
import { BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML } from '../../takt/builtin-workflow-yaml.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from '../test-timeouts.js'

const planetzUserData = join(tmpdir(), 'planetz-isolated-userdata')

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'userData' ? planetzUserData : tmpdir()),
  },
}))

const GIT_TEST_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@test',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@test',
}

async function initDevelopRepo(dir: string): Promise<void> {
  await execa('git', ['init', '-b', 'develop'], { cwd: dir })
  await writeFile(join(dir, 'README.md'), '# main\n', 'utf8')
  await execa('git', ['-C', dir, 'add', 'README.md'])
  await execa('git', ['-C', dir, 'commit', '-m', 'init'], { env: GIT_TEST_ENV })
}

async function readAbbrevRef(repo: string): Promise<string> {
  const result = await execa('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD'])
  return result.stdout.trim()
}

async function readOriginUrl(repo: string): Promise<string> {
  const result = await execa('git', ['-C', repo, 'remote', 'get-url', 'origin'])
  return result.stdout.trim()
}

describe('isolated takt workspace', () => {
  let mainWorkspace = ''
  let isolatedRepo = ''

  afterEach(async () => {
    if (mainWorkspace) await rm(mainWorkspace, { recursive: true, force: true })
    if (isolatedRepo) await rm(isolatedRepo, { recursive: true, force: true })
    mainWorkspace = ''
    isolatedRepo = ''
  })

  beforeAll(async () => {
    await mkdir(planetzUserData, { recursive: true })
  })

  it('places isolated repo outside main workspace under planetz userData', () => {
    mainWorkspace = join(tmpdir(), `planetz-main-${Date.now()}`)
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    assertIsolatedOutsideMain(mainWorkspace, isolatedRepo)
    expect(isolatedRepo).toContain(planetzUserData)
    expect(hashMainWorkspacePath(mainWorkspace)).toHaveLength(16)
  })

  it('resolves isolated takt worktree roots using DEFAULT_CONFIG.taktDir', () => {
    const repo = join(tmpdir(), 'isolated', 'repo')
    expect(isolatedTaktWorktreesRoot(repo)).toBe(join(tmpdir(), 'isolated', 'takt-worktrees'))
    expect(isolatedTaktCompatWorktreesRoot(repo)).toBe(
      join(repo, DEFAULT_CONFIG.taktDir, 'worktrees'),
    )
  })

  it('syncs main tree into isolated repo without copying sidecar tree', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-sync-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows'), { recursive: true })
    await writeFile(join(mainWorkspace, 'README.md'), '# main\n', 'utf8')
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows', 'secret.yaml'),
      'orbit-only\n',
      'utf8',
    )

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    await expect(access(join(isolatedRepo, 'README.md'))).resolves.toBeUndefined()
    await expect(access(join(isolatedRepo, PLANETZ_SIDECAR_PARENT_DIR_NAME))).rejects.toBeDefined()
  })

  it('ignores broken symlinks while seeding non-git workspace', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-sync-broken-link-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(join(mainWorkspace, '.agent', 'skills'), { recursive: true })
    await writeFile(join(mainWorkspace, 'README.md'), '# main\n', 'utf8')
    await symlink(
      join(mainWorkspace, 'missing-skill-target'),
      join(mainWorkspace, '.agent', 'skills', 'skill-remove-design'),
    )

    await expect(syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)).resolves.toEqual({
      baseRef: null,
    })
    await expect(access(join(isolatedRepo, 'README.md'))).resolves.toBeUndefined()
  })

  it('cleans stale isolated files before seeding non-git workspace', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-sync-clean-seed-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(isolatedRepo, { recursive: true })
    await mkdir(join(isolatedRepo, '.takt'), { recursive: true })
    await writeFile(join(isolatedRepo, '.takt', 'tasks.yaml'), 'tasks:\n  - name: stale\n', 'utf8')
    await writeFile(join(mainWorkspace, 'README.md'), '# dummy\n', 'utf8')

    await expect(syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)).resolves.toEqual({
      baseRef: null,
    })
    await expect(access(join(isolatedRepo, 'README.md'))).resolves.toBeUndefined()
    await expect(access(join(isolatedRepo, '.takt', 'tasks.yaml'))).rejects.toBeDefined()
  })

  it('resets isolated repo when workspace marker points to another workspace', async () => {
    const workspaceA = await mkdtemp(join(tmpdir(), 'planetz-main-marker-a-'))
    const workspaceB = await mkdtemp(join(tmpdir(), 'planetz-main-marker-b-'))
    mainWorkspace = workspaceA
    isolatedRepo = isolatedRepoPath(workspaceA)
    await mkdir(isolatedRepo, { recursive: true })
    await writeFile(join(isolatedRepo, '.planetz-main-workspace-path'), `${workspaceB}\n`, 'utf8')
    await mkdir(join(isolatedRepo, '.takt'), { recursive: true })
    await writeFile(join(isolatedRepo, '.takt', 'tasks.yaml'), 'tasks:\n  - name: other\n', 'utf8')
    await writeFile(join(workspaceA, 'README.md'), '# workspace-a\n', 'utf8')

    await expect(syncIsolatedRepoToMain(workspaceA, isolatedRepo)).resolves.toEqual({
      baseRef: null,
    })
    await expect(access(join(isolatedRepo, 'README.md'))).resolves.toBeUndefined()
    await expect(access(join(isolatedRepo, '.takt', 'tasks.yaml'))).rejects.toBeDefined()
    await rm(workspaceB, { recursive: true, force: true })
  })

  it('projects main orbit workflows and import snapshot into isolated takt-global', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-project-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows'), { recursive: true })
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'import-snapshot', 'workflows'), {
      recursive: true,
    })
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows', 'wf.yaml'),
      'name: wf\nsteps:\n  - name: plan\n    persona: orbit\n',
      'utf8',
    )
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows', 'ollama-chat.yaml'),
      'name: ollama-chat\nsteps:\n  - name: custom-main\n',
      'utf8',
    )
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'import-snapshot', 'global-config.yaml'),
      'provider: snapshot\n',
      'utf8',
    )
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'facets', 'personas'), { recursive: true })
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'planner.md'),
      '# Planner\n',
      'utf8',
    )
    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    const mainSidecar = mockSidecarPaths(join(mainWorkspace, SIDECAR_DIR_NAME))
    await projectMainOrbitToIsolated(
      mainSidecar,
      mainWorkspace,
      isolatedRepo,
      { provider: 'snapshot' },
      DEFAULT_CONFIG,
    )

    const projectedWorkflow = await readFile(
      join(isolatedRepo, SIDECAR_DIR_NAME, 'workflows', 'wf.yaml'),
      'utf8',
    )
    expect(projectedWorkflow).toContain('persona: orbit')
    const mainOllama = await readFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows', 'ollama-chat.yaml'),
      'utf8',
    )
    expect(mainOllama).toContain('custom-main')

    const projectedFacet = await readFile(
      join(isolatedRepo, '.takt', 'facets', 'personas', 'planner.md'),
      'utf8',
    )
    expect(projectedFacet).toBe('# Planner\n')

    const globalConfig = await readFile(
      join(isolatedRepo, SIDECAR_DIR_NAME, 'takt-global', 'config.yaml'),
      'utf8',
    )
    expect(globalConfig).toContain('provider: snapshot')

    const taktGlobalWorkflow = await readFile(
      join(isolatedRepo, SIDECAR_DIR_NAME, 'takt-global', 'workflows', 'wf.yaml'),
      'utf8',
    )
    expect(taktGlobalWorkflow).toContain('persona: orbit')

    const isolatedFallback = await readFile(
      join(isolatedRepo, SIDECAR_DIR_NAME, 'workflows', 'ollama-chat.yaml'),
      'utf8',
    )
    expect(isolatedFallback).toBe(BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML)

    const isolatedTaktGlobalFallback = await readFile(
      join(isolatedRepo, SIDECAR_DIR_NAME, 'takt-global', 'workflows', 'ollama-chat.yaml'),
      'utf8',
    )
    expect(isolatedTaktGlobalFallback).toBe(BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML)
  }, 20_000)

  it('does not project planetz.db into the isolated repo', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-project-sqlite-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows'), { recursive: true })
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows', 'wf.yaml'),
      'name: wf\nsteps:\n  - name: plan\n    persona: orbit\n',
      'utf8',
    )
    await openSidecarSqlite(mockSidecarPaths(join(mainWorkspace, SIDECAR_DIR_NAME)))
    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    const mainSidecar = mockSidecarPaths(join(mainWorkspace, SIDECAR_DIR_NAME))
    await projectMainOrbitToIsolated(mainSidecar, mainWorkspace, isolatedRepo, {}, DEFAULT_CONFIG)

    await expect(
      access(join(mainWorkspace, SIDECAR_DIR_NAME, PLANETZ_SQLITE_FILENAME)),
    ).resolves.toBeUndefined()
    await expect(
      access(join(isolatedRepo, SIDECAR_DIR_NAME, PLANETZ_SQLITE_FILENAME)),
    ).rejects.toThrow()
  })

  it('materializes bundled facets referenced by projected workflows onto isolated repo', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-project-facet-materialize-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows'), { recursive: true })
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'workflows', 'minimal.yaml'),
      `name: minimal
personas:
  coder: ../facets/personas/coder.md
steps:
  - name: run
    persona: coder
`,
      'utf8',
    )
    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    const mainSidecar = mockSidecarPaths(join(mainWorkspace, SIDECAR_DIR_NAME))
    await projectMainOrbitToIsolated(mainSidecar, mainWorkspace, isolatedRepo, {}, DEFAULT_CONFIG)

    const coder = await readFile(
      join(isolatedRepo, '.takt', 'facets', 'personas', 'coder.md'),
      'utf8',
    )
    expect(coder.length).toBeGreaterThan(10)

    const taktGlobalMinimal = await readFile(
      join(isolatedRepo, SIDECAR_DIR_NAME, 'takt-global', 'workflows', 'minimal.yaml'),
      'utf8',
    )
    expect(taktGlobalMinimal).toContain('name: minimal')
  })

  it('ignores broken symlinks under sidecar facets during projection', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-project-broken-link-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await mkdir(join(mainWorkspace, SIDECAR_DIR_NAME, 'facets', 'personas'), { recursive: true })
    await writeFile(
      join(mainWorkspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'planner.md'),
      '# Planner\n',
      'utf8',
    )
    await symlink(
      join(mainWorkspace, 'missing-facet-target'),
      join(mainWorkspace, SIDECAR_DIR_NAME, 'facets', 'personas', 'skill-remove-design'),
    )
    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    const mainSidecar = mockSidecarPaths(join(mainWorkspace, SIDECAR_DIR_NAME))
    await expect(
      projectMainOrbitToIsolated(mainSidecar, mainWorkspace, isolatedRepo, {}, DEFAULT_CONFIG),
    ).resolves.toBeDefined()
    const projectedFacet = await readFile(
      join(isolatedRepo, '.takt', 'facets', 'personas', 'planner.md'),
      'utf8',
    )
    expect(projectedFacet).toBe('# Planner\n')
  })

  it('ensureIsolatedTaktWorkspace returns stable isolated path', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-ensure-'))
    const first = await ensureIsolatedTaktWorkspace(mainWorkspace)
    const second = await ensureIsolatedTaktWorkspace(mainWorkspace)
    expect(first.isolatedRepoPath).toBe(second.isolatedRepoPath)
    expect(first.mainWorkspacePath).toBe(mainWorkspace)
  })

  it('leaves isolated repo on a named branch after git workspace sync', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-git-sync-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await initDevelopRepo(mainWorkspace)

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    expect(await readAbbrevRef(isolatedRepo)).toBe('develop')
  })

  it('aligns isolated origin URL to main workspace origin URL', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-git-origin-align-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await initDevelopRepo(mainWorkspace)
    const originUrl = 'https://github.com/guilz-dev/dummy.git'
    await execa('git', ['-C', mainWorkspace, 'remote', 'add', 'origin', originUrl])

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    await expect(readOriginUrl(isolatedRepo)).resolves.toBe(originUrl)
  })

  it(
    'repairs pre-existing local-path isolated origin URL',
    async () => {
      mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-git-origin-repair-'))
      isolatedRepo = isolatedRepoPath(mainWorkspace)
      await initDevelopRepo(mainWorkspace)
      const originUrl = 'https://github.com/guilz-dev/dummy.git'
      await execa('git', ['-C', mainWorkspace, 'remote', 'add', 'origin', originUrl])

      await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)
      await execa('git', ['-C', isolatedRepo, 'remote', 'set-url', 'origin', mainWorkspace])
      await expect(readOriginUrl(isolatedRepo)).resolves.toBe(mainWorkspace)

      await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

      await expect(readOriginUrl(isolatedRepo)).resolves.toBe(originUrl)
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('re-aligns detached isolated repo without full resync', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-git-realign-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await initDevelopRepo(mainWorkspace)

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)
    expect(await readAbbrevRef(isolatedRepo)).toBe('develop')

    await execa('git', ['-C', isolatedRepo, 'checkout', '--detach', 'HEAD'])
    expect(await readAbbrevRef(isolatedRepo)).toBe('HEAD')

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    expect(await readAbbrevRef(isolatedRepo)).toBe('develop')
  })

  it('preserves uncommitted tasks.yaml across cold start when main HEAD unchanged', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-git-preserve-tasks-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await initDevelopRepo(mainWorkspace)

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)
    await mkdir(join(isolatedRepo, '.takt'), { recursive: true })
    const tasksYaml = 'tasks:\n  - name: keep-me\n    status: pending\n'
    await writeFile(join(isolatedRepo, '.takt', 'tasks.yaml'), tasksYaml, 'utf8')

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    await expect(readFile(join(isolatedRepo, '.takt', 'tasks.yaml'), 'utf8')).resolves.toBe(
      tasksYaml,
    )
  })

  it('resyncs isolated repo when main HEAD advances', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-git-resync-on-advance-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await initDevelopRepo(mainWorkspace)

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)
    await mkdir(join(isolatedRepo, '.takt'), { recursive: true })
    await writeFile(join(isolatedRepo, '.takt', 'tasks.yaml'), 'tasks:\n  - name: stale\n', 'utf8')

    await writeFile(join(mainWorkspace, 'README.md'), '# main updated\n', 'utf8')
    await execa('git', ['-C', mainWorkspace, 'add', 'README.md'])
    await execa('git', ['-C', mainWorkspace, 'commit', '-m', 'advance'], { env: GIT_TEST_ENV })

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    await expect(access(join(isolatedRepo, '.takt', 'tasks.yaml'))).rejects.toBeDefined()
    await expect(readFile(join(isolatedRepo, 'README.md'), 'utf8')).resolves.toBe(
      '# main updated\n',
    )
  })

  it('preserves uncommitted tasks.yaml across cold start for non-git main workspace', async () => {
    mainWorkspace = await mkdtemp(join(tmpdir(), 'planetz-main-nongit-preserve-tasks-'))
    isolatedRepo = isolatedRepoPath(mainWorkspace)
    await writeFile(join(mainWorkspace, 'README.md'), '# non-git\n', 'utf8')

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)
    await mkdir(join(isolatedRepo, '.takt'), { recursive: true })
    const tasksYaml = 'tasks:\n  - name: keep-me\n    status: pending\n'
    await writeFile(join(isolatedRepo, '.takt', 'tasks.yaml'), tasksYaml, 'utf8')

    await syncIsolatedRepoToMain(mainWorkspace, isolatedRepo)

    await expect(readFile(join(isolatedRepo, '.takt', 'tasks.yaml'), 'utf8')).resolves.toBe(
      tasksYaml,
    )
  })
})
