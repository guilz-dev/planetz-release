import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../shared/spec-driven/spec-driven-workflow-yaml.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  invalidateBuiltinWorkflowCatalog,
  listBuiltinWorkflowNames,
  listBuiltinWorkflowSummaries,
  loadBuiltinWorkflowCatalog,
  readBuiltinWorkflowYaml,
} from '../takt/builtin-workflow-registry.js'
import {
  BUILTIN_CHAT_INVESTIGATION_WORKFLOW_YAML,
  BUILTIN_DEFAULT_WORKFLOW_YAML,
  BUILTIN_MINIMAL_WORKFLOW_YAML,
  BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML,
} from '../takt/builtin-workflow-yaml.js'
import { BUNDLED_CLI_TEST_TIMEOUT_MS } from './test-timeouts.js'

const BUNDLED_ORBIT_ROOT_ENV = 'PLANETZ_BUNDLED_ORBIT_ROOT'
const PREVIOUS_BUNDLED_ROOT = process.env[BUNDLED_ORBIT_ROOT_ENV]

async function createBundledWorkflowFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'bundled-workflows-'))
  const workflowDir = join(root, 'builtins', 'en', 'workflows')
  await mkdir(workflowDir, { recursive: true })
  await writeFile(
    join(workflowDir, 'sample-bundled.yaml'),
    'name: sample-bundled\ndescription: Sample bundled workflow\nsteps:\n  - name: plan\n    persona: planner\n',
    'utf8',
  )
  await writeFile(
    join(root, 'builtins', 'en', 'workflow-categories.yaml'),
    [
      'workflow_categories:',
      '  Test Category:',
      '    workflows:',
      '      - sample-bundled',
      '      - default',
    ].join('\n'),
    'utf8',
  )
  return root
}

describe('builtin-workflow-registry', { timeout: BUNDLED_CLI_TEST_TIMEOUT_MS }, () => {
  let fixtureRoot = ''

  afterEach(async () => {
    invalidateBuiltinWorkflowCatalog()
    if (PREVIOUS_BUNDLED_ROOT === undefined) {
      delete process.env[BUNDLED_ORBIT_ROOT_ENV]
    } else {
      process.env[BUNDLED_ORBIT_ROOT_ENV] = PREVIOUS_BUNDLED_ROOT
    }
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true })
      fixtureRoot = ''
    }
    await ensureBuiltinWorkflowCatalogLoaded()
  })

  it('prefers Planetz fallback default over bundled default.yaml scan', async () => {
    invalidateBuiltinWorkflowCatalog()
    fixtureRoot = await createBundledWorkflowFixture()
    await writeFile(
      join(fixtureRoot, 'builtins', 'en', 'workflows', 'default.yaml'),
      'name: default\ndescription: bundled default\nsteps:\n  - name: bundled\n',
      'utf8',
    )
    process.env[BUNDLED_ORBIT_ROOT_ENV] = fixtureRoot

    await ensureBuiltinWorkflowCatalogLoaded()
    expect(readBuiltinWorkflowYaml('default')).toBe(BUILTIN_DEFAULT_WORKFLOW_YAML)
    expect(listBuiltinWorkflowNames().filter((name) => name === 'default')).toHaveLength(1)
  })

  it(
    'scans bundled workflows and attaches categories',
    async () => {
      invalidateBuiltinWorkflowCatalog()
      fixtureRoot = await createBundledWorkflowFixture()
      process.env[BUNDLED_ORBIT_ROOT_ENV] = fixtureRoot

      const _catalog = await loadBuiltinWorkflowCatalog()
      expect(readBuiltinWorkflowYaml('sample-bundled')).toContain('name: sample-bundled')
      expect(listBuiltinWorkflowNames()).toContain('sample-bundled')
      expect(listBuiltinWorkflowNames()).not.toContain('default.yaml')

      const bundled = listBuiltinWorkflowSummaries().find((w) => w.name === 'sample-bundled')
      expect(bundled?.categories).toEqual(['Test Category'])

      const fallbackDefault = listBuiltinWorkflowSummaries().find((w) => w.name === 'default')
      expect(fallbackDefault?.categories).toEqual(['Test Category'])
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('includes Planetz ollama-chat fallback', async () => {
    invalidateBuiltinWorkflowCatalog()
    fixtureRoot = await createBundledWorkflowFixture()
    process.env[BUNDLED_ORBIT_ROOT_ENV] = fixtureRoot

    await ensureBuiltinWorkflowCatalogLoaded()
    expect(readBuiltinWorkflowYaml('ollama-chat')).toBe(BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML)
  })

  it('includes Planetz minimal fallback', async () => {
    invalidateBuiltinWorkflowCatalog()
    fixtureRoot = await createBundledWorkflowFixture()
    process.env[BUNDLED_ORBIT_ROOT_ENV] = fixtureRoot

    await ensureBuiltinWorkflowCatalogLoaded()
    expect(readBuiltinWorkflowYaml('minimal')).toBe(BUILTIN_MINIMAL_WORKFLOW_YAML)
  })

  it(
    'includes Planetz spec-driven fallback',
    async () => {
      invalidateBuiltinWorkflowCatalog()
      fixtureRoot = await createBundledWorkflowFixture()
      process.env[BUNDLED_ORBIT_ROOT_ENV] = fixtureRoot

      await ensureBuiltinWorkflowCatalogLoaded()
      expect(readBuiltinWorkflowYaml('spec-driven')).toBe(SPEC_DRIVEN_WORKFLOW_YAML)
      expect(listBuiltinWorkflowNames()).toContain('spec-driven')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )

  it('includes Planetz chat-investigation fallback', async () => {
    invalidateBuiltinWorkflowCatalog()
    fixtureRoot = await createBundledWorkflowFixture()
    process.env[BUNDLED_ORBIT_ROOT_ENV] = fixtureRoot

    await ensureBuiltinWorkflowCatalogLoaded()
    expect(readBuiltinWorkflowYaml('chat-investigation')).toBe(
      BUILTIN_CHAT_INVESTIGATION_WORKFLOW_YAML,
    )
  })
})

describe('builtin-workflow-registry (repo bundled)', () => {
  afterEach(async () => {
    invalidateBuiltinWorkflowCatalog()
    await ensureBuiltinWorkflowCatalogLoaded()
  })

  it(
    'loads bundled frontend workflows from third_party orbit',
    async () => {
      invalidateBuiltinWorkflowCatalog()
      await loadBuiltinWorkflowCatalog()
      const names = listBuiltinWorkflowNames()
      expect(names).toContain('frontend')
      expect(names).toContain('frontend-refactor-mock')
      expect(names.filter((name) => name === 'default')).toHaveLength(1)
      expect(readBuiltinWorkflowYaml('default')).toBe(BUILTIN_DEFAULT_WORKFLOW_YAML)
      expect(readBuiltinWorkflowYaml('frontend-refactor-mock')).toContain(
        'name: frontend-refactor-mock',
      )

      const mockSummary = listBuiltinWorkflowSummaries().find(
        (summary) => summary.name === 'frontend-refactor-mock',
      )
      expect(mockSummary?.source).toBe('builtin')
      expect(mockSummary?.categories).toContain('🎨 Frontend')
    },
    BUNDLED_CLI_TEST_TIMEOUT_MS,
  )
})
