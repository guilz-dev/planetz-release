import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  INTENT_LEDGER_DECISIONS_REPORT_FILE,
  INTENT_LEDGER_OBSERVATION_REPORT_FILE,
} from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { IntentLedgerIngestService } from '../../planetz/intent-ledger-ingest-service.js'
import { IntentLedgerStore } from '../../sidecar/intent-ledger-store.js'
import { closeAllSidecarSqlite } from '../../storage/sqlite/connection.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

const config = DEFAULT_CONFIG
const fixtures: string[] = []

afterEach(() => {
  closeAllSidecarSqlite()
  fixtures.length = 0
})

async function writeRunFixture(options: {
  decisionsJson?: string
  observationJson?: string
  omitDecisions?: boolean
  omitObservation?: boolean
}): Promise<{ taktRepo: string; taskId: string; runSlug: string; sidecarRoot: string }> {
  const base = join(tmpdir(), `intent-ingest-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fixtures.push(base)
  const taskId = 'task-ingest-1'
  const runSlug = 'run-ingest-001'
  const reportsDir = join(base, '.takt', 'runs', runSlug, 'reports')
  await mkdir(reportsDir, { recursive: true })
  if (!options.omitDecisions) {
    await writeFile(
      join(reportsDir, INTENT_LEDGER_DECISIONS_REPORT_FILE),
      options.decisionsJson ??
        JSON.stringify({
          version: 1,
          decisions: [
            {
              decisionId: 'auth-model',
              statement: 'Provider and model are independent',
              authority: 'assumed',
              source: 'requirements.md',
              reversibility: 'cheap',
            },
          ],
        }),
      'utf8',
    )
  }
  if (options.observationJson !== undefined) {
    await writeFile(
      join(reportsDir, INTENT_LEDGER_OBSERVATION_REPORT_FILE),
      options.observationJson,
      'utf8',
    )
  }
  await mkdir(join(base, '.takt'), { recursive: true })
  await writeFile(
    join(base, '.takt', 'tasks.yaml'),
    `tasks:
  - name: ${taskId}
    run_slug: ${runSlug}
    workflow: spec-driven
    status: completed
`,
    'utf8',
  )
  const sidecarRoot = join(base, '.planetz', 'orbit')
  await mkdir(sidecarRoot, { recursive: true })
  return { taktRepo: base, taskId, runSlug, sidecarRoot }
}

describe('IntentLedgerIngestService', () => {
  it('ingests valid decisions.json into intent_ledger', async () => {
    const { taktRepo, taskId, runSlug, sidecarRoot } = await writeRunFixture({})
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 1 })
    const store = new IntentLedgerStore()
    const rows = await store.listByTaskId(paths, taskId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sourceRun).toBe(runSlug)
    expect(rows[0]?.decisionId).toBe('auth-model')
    expect(rows[0]?.authority).toBe('assumed')
  })

  it('persists satisfies and deviates trace fields', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      decisionsJson: JSON.stringify({
        version: 1,
        decisions: [
          {
            decisionId: 'traced',
            statement: 'JWT sessions',
            authority: 'assumed',
            satisfies: ['REQ-auth-1'],
            deviates: ['DSN-api-1'],
          },
        ],
      }),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 1 })
    const store = new IntentLedgerStore()
    const rows = await store.listByTaskId(paths, taskId)
    expect(rows[0]?.satisfies).toEqual(['REQ-auth-1'])
    expect(rows[0]?.deviates).toEqual(['DSN-api-1'])
  })

  it('skips when decisions.json is missing', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({ omitDecisions: true })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'skip', reason: 'missing_report' })
  })

  it('ingests decisions.json from worktree run path', async () => {
    const base = join(
      tmpdir(),
      `intent-ingest-wt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    fixtures.push(base)
    const taskId = 'wt-task'
    const runSlug = 'run-worktree-ingest'
    const worktree = join(base, 'wt-task')
    const reportsDir = join(worktree, '.takt', 'runs', runSlug, 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(
      join(reportsDir, INTENT_LEDGER_DECISIONS_REPORT_FILE),
      JSON.stringify({
        version: 1,
        decisions: [
          {
            decisionId: 'wt-choice',
            statement: 'Prefer worktree-local reports',
            authority: 'designed',
          },
        ],
      }),
      'utf8',
    )
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: ${taskId}
    run_slug: ${runSlug}
    worktree_path: ${worktree}
    workflow: spec-driven
    status: completed
`,
      'utf8',
    )
    const sidecarRoot = join(base, '.planetz', 'orbit')
    await mkdir(sidecarRoot, { recursive: true })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 1 })
    const rows = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rows[0]?.sourceRun).toBe(runSlug)
    expect(rows[0]?.decisionId).toBe('wt-choice')
  })

  it('prefers worktree decisions.json when main run only has markdown reports', async () => {
    const base = join(
      tmpdir(),
      `intent-ingest-wt-main-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    fixtures.push(base)
    const taskId = 'wt-main-task'
    const runSlug = 'run-wt-main-ingest'
    const worktree = join(base, 'wt-main-task')
    const worktreeReports = join(worktree, '.takt', 'runs', runSlug, 'reports')
    const mainReports = join(base, '.takt', 'runs', runSlug, 'reports')
    await mkdir(worktreeReports, { recursive: true })
    await mkdir(mainReports, { recursive: true })
    await writeFile(join(mainReports, 'coder-summary.md'), '# Summary\n\nMain only.', 'utf8')
    await writeFile(
      join(worktreeReports, INTENT_LEDGER_DECISIONS_REPORT_FILE),
      JSON.stringify({
        version: 1,
        decisions: [
          {
            decisionId: 'worktree-decision',
            statement: 'Decision recorded in worktree run',
            authority: 'assumed',
          },
        ],
      }),
      'utf8',
    )
    await mkdir(join(base, '.takt'), { recursive: true })
    await writeFile(
      join(base, '.takt', 'tasks.yaml'),
      `tasks:
  - name: ${taskId}
    run_slug: ${runSlug}
    worktree_path: ${worktree}
    workflow: spec-driven
    status: completed
`,
      'utf8',
    )
    const sidecarRoot = join(base, '.planetz', 'orbit')
    await mkdir(sidecarRoot, { recursive: true })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: base,
      workspacePath: base,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 1 })
    const rows = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rows[0]?.decisionId).toBe('worktree-decision')
  })

  it('skips when decisions.json fails schema validation', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      decisionsJson: JSON.stringify({ version: 1, decisions: [{ bad: true }] }),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'skip', reason: 'invalid_report' })
  })

  it('ingests observation.json as observed authority rows', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      omitDecisions: true,
      observationJson: JSON.stringify({
        version: 1,
        STATUS: 'NO-GO',
        observations: [
          {
            statement: 'Auth handler lacks REQ trace',
            evidence: 'src/auth.ts:42',
            relatedReqIds: ['REQ-auth-1'],
            unanchored: true,
          },
        ],
      }),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 1 })
    const rows = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.authority).toBe('observed')
    expect(rows[0]?.sourceDoc).toBe('src/auth.ts:42')
    expect(rows[0]?.satisfies).toEqual(['REQ-auth-1'])
  })

  it('persists observed unanchored flag when evidence is present', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      omitDecisions: true,
      observationJson: JSON.stringify({
        version: 1,
        STATUS: 'NO-GO',
        observations: [
          {
            observationId: 'drift-auth',
            statement: 'Auth handler lacks REQ trace',
            evidence: 'src/auth.ts:42',
            unanchored: true,
          },
        ],
      }),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    const pending = await new IntentLedgerStore().listPending(paths, {})
    expect(pending).toHaveLength(1)
    expect(pending[0]?.decisionId).toBe('drift-auth')
    expect(pending[0]?.unanchored).toBe(true)
  })

  it('uses stable content hash decisionId when observationId is omitted', async () => {
    const payload = {
      version: 1,
      STATUS: 'GO',
      observations: [
        {
          statement: 'Stable row',
          evidence: 'src/foo.ts:1',
          unanchored: false,
        },
      ],
    }
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      omitDecisions: true,
      observationJson: JSON.stringify(payload),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    const rows = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rows[0]?.decisionId).toMatch(/^obs-[a-f0-9]{12}$/)

    await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })
    const rowsAfterReingest = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rowsAfterReingest).toHaveLength(1)
    expect(rowsAfterReingest[0]?.decisionId).toBe(rows[0]?.decisionId)
  })

  it('drops observation rows without evidence before ingest', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      omitDecisions: true,
      observationJson: JSON.stringify({
        version: 1,
        STATUS: 'GO',
        observations: [
          {
            statement: 'Missing evidence',
            evidence: '   ',
            unanchored: false,
          },
          {
            statement: 'Valid row',
            evidence: 'design.md §Auth',
            unanchored: false,
          },
        ],
      }),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 1 })
    const rows = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.statement).toBe('Valid row')
  })

  it('ingests both decisions.json and observation.json in one task', async () => {
    const { taktRepo, taskId, sidecarRoot } = await writeRunFixture({
      observationJson: JSON.stringify({
        version: 1,
        STATUS: 'GO',
        observations: [
          {
            statement: 'Observed drift',
            evidence: 'src/foo.ts:1',
            unanchored: false,
          },
        ],
      }),
    })
    const paths = mockSidecarPaths(sidecarRoot)
    const service = new IntentLedgerIngestService(new IntentLedgerStore())

    const outcome = await service.ingestCompletedTask(paths, {
      taktRepoPath: taktRepo,
      workspacePath: taktRepo,
      config,
      taskId,
      readWorkflowYaml: async () => null,
    })

    expect(outcome).toEqual({ status: 'ok', ingested: 2 })
    const rows = await new IntentLedgerStore().listByTaskId(paths, taskId)
    expect(rows.map((row) => row.authority).sort()).toEqual(['assumed', 'observed'])
  })
})
