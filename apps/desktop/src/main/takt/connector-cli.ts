import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EnqueueTaskInput, UiConfig } from '@planetz/shared'
import { extractWorkflowExecutionDefaults, resolveExecutionProfile } from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { buildTaktTaskPrompt } from '../lib/build-takt-task-prompt.js'
import { isGitBranchFormatValid, rejectInvalidGitBranchName } from '../lib/git-branch-exists.js'
import { withTasksYamlLock } from '../lib/tasks-yaml-lock.js'
import { sanitizeTasksYamlForTakt } from '../lib/tasks-yaml-takt-compat.js'
import type { ExecutionProfileContext } from '../planetz/execution-profile-context.js'
import {
  appendTaktAgentOverrides,
  taktAddCommand,
  taktMergeCommand,
  taktRunAllCommand,
} from './commands.js'
import type { TaktConnector } from './connector.js'
import { isEnqueuePackageFallbackAllowed, resolveEnqueueMode } from './enqueue-mode.js'
import { outputText, runTaktCli } from './exec-cli.js'
import {
  formatTaktAddEnqueueFailureMessage,
  TaktAddEnqueueError,
} from './takt-add-enqueue-error.js'
import { type TaskPackageResult, TaskPackageWriter } from './task-package-writer.js'

interface TasksYamlRoot {
  tasks?: Array<Record<string, unknown>>
}

function isEnqueueTraceEnabled(): boolean {
  if (process.env.PLANETZ_TRACE_ENQUEUE === '1') return true
  if (process.env.PLANETZ_TRACE_ENQUEUE === '0') return false
  return process.env.NODE_ENV_ELECTRON_VITE === 'development'
}

const ENQUEUE_TRACE_ENABLED = isEnqueueTraceEnabled()

/** How long to wait for an immediate `takt run` failure before returning to the UI. */
const RUN_TASK_NOW_FAST_FAIL_MS = 3_000

function traceEnqueue(step: string, fields?: Record<string, unknown>): void {
  if (!ENQUEUE_TRACE_ENABLED) return
  const at = new Date().toISOString()
  if (fields) {
    console.info(`[enqueue][${at}] ${step}`, fields)
    return
  }
  console.info(`[enqueue][${at}] ${step}`)
}

function summarizeDetail(detail: string): string | null {
  const firstLine = detail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return null
  return firstLine.slice(0, 240)
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return 'unknown error'
}

function resultDetail(result: { stderr?: unknown; stdout?: unknown }): string {
  return (outputText(result.stderr) || outputText(result.stdout)).trim()
}

/** True when bundled takt routed to interactive mode instead of the `add` subcommand. */
export function isMisroutedTaktAddResult(result: {
  exitCode?: number | null
  stderr?: unknown
  stdout?: unknown
}): boolean {
  if (result.exitCode !== 0) return false
  const detail = resultDetail(result)
  return /Select interactive mode/i.test(detail)
}

function isCursorAutoOnlyPlanError(detail: string): boolean {
  return /named models unavailable/i.test(detail) && /free plans can only use auto/i.test(detail)
}

function shouldRetryWithCursorAuto(
  provider: string | undefined,
  model: string | undefined,
  detail: string,
): boolean {
  return provider === 'cursor' && !!model && model !== 'auto' && isCursorAutoOnlyPlanError(detail)
}

async function annotateTaskIssueNumber(
  workspacePath: string,
  config: UiConfig,
  taskId: string,
  issueNumber?: number,
): Promise<void> {
  const normalizedIssueNumber =
    typeof issueNumber === 'number' && Number.isInteger(issueNumber) && issueNumber > 0
      ? issueNumber
      : undefined
  if (normalizedIssueNumber === undefined) return
  const tasksYamlPath = join(workspacePath, config.tasksYamlPath)
  await withTasksYamlLock(tasksYamlPath, async () => {
    let root: TasksYamlRoot
    try {
      root = parseYaml(await readFile(tasksYamlPath, 'utf8')) as TasksYamlRoot
    } catch {
      return
    }
    if (!Array.isArray(root.tasks)) return
    const row = root.tasks.find((candidate) => candidate.name === taskId)
    if (!row || row.issue === normalizedIssueNumber) return
    row.issue = normalizedIssueNumber
    await writeFile(tasksYamlPath, stringifyYaml(root), 'utf8')
  })
}

export class TaktConnectorCli implements TaktConnector {
  constructor(
    private readonly workspacePath: string,
    private readonly config: UiConfig,
    private readonly executionProfile: ExecutionProfileContext,
  ) {}

  private async resolveRuntimeForInput(input: EnqueueTaskInput) {
    const engine = await this.executionProfile.loadEngineConfig()
    const runtimeWorkflow = await this.executionProfile.resolveWorkflowForRuntime(
      engine,
      input.workflow,
    )
    const workflowDefaults = extractWorkflowExecutionDefaults(runtimeWorkflow.yaml)
    const profile = resolveExecutionProfile(engine, input, workflowDefaults)
    const env = await this.executionProfile.buildRuntimeEnv(engine)
    return { runtimeWorkflow, profile, env }
  }

  async enqueueTask(input: EnqueueTaskInput, existingIds: Set<string>): Promise<TaskPackageResult> {
    const startedAt = Date.now()
    traceEnqueue('connector.enqueueTask:start', {
      workflow: input.workflow ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      titleLength: input.title.length,
      bodyLength: input.body?.length ?? 0,
      existingCount: existingIds.size,
    })
    try {
      const sanitizeStartedAt = Date.now()
      await sanitizeTasksYamlForTakt(this.workspacePath, this.config)
      traceEnqueue('connector.enqueueTask:sanitizedTasksYaml', {
        elapsedMs: Date.now() - sanitizeStartedAt,
      })
      const runtime = await this.resolveRuntimeForInput(input)
      const enqueueMode = resolveEnqueueMode()
      traceEnqueue('connector.enqueueTask:modeSelected', {
        mode: enqueueMode,
        workflow: runtime.runtimeWorkflow.workflow,
      })
      if (enqueueMode === 'package_writer') {
        const inputForPackage: EnqueueTaskInput = {
          ...input,
          workflow: runtime.runtimeWorkflow.workflow,
        }
        const packageStartedAt = Date.now()
        const result = await new TaskPackageWriter(this.workspacePath, this.config).createPackage(
          inputForPackage,
          existingIds,
        )
        traceEnqueue('connector.enqueueTask:done', {
          taskId: result.taskId,
          strategy: 'task_package_writer',
          packageElapsedMs: Date.now() - packageStartedAt,
          elapsedMs: Date.now() - startedAt,
        })
        return result
      }
      const prompt = buildTaktTaskPrompt(input)
      const cliOverrides = {
        ...(runtime.profile.provider ? { provider: runtime.profile.provider } : {}),
        ...(runtime.profile.model ? { model: runtime.profile.model } : {}),
      }
      const addArgs = appendTaktAgentOverrides(
        taktAddCommand(prompt, runtime.runtimeWorkflow.workflow),
        cliOverrides,
      )
      traceEnqueue('connector.enqueueTask:cliPrepared', {
        workflow: runtime.runtimeWorkflow.workflow,
        provider: runtime.profile.provider ?? null,
        model: runtime.profile.model ?? null,
      })
      return this.enqueueViaTaktAdd(
        input,
        existingIds,
        runtime.runtimeWorkflow.workflow,
        addArgs,
        runtime.env,
        startedAt,
      )
    } catch (error: unknown) {
      traceEnqueue('connector.enqueueTask:error', {
        elapsedMs: Date.now() - startedAt,
        message: summarizeError(error),
      })
      throw error
    }
  }

  private async enqueueViaTaktAdd(
    input: EnqueueTaskInput,
    existingIds: Set<string>,
    runtimeWorkflow: string,
    addArgs: string[],
    runtimeEnv: Record<string, string>,
    startedAt: number,
  ): Promise<TaskPackageResult> {
    const before = new Set(existingIds)
    const addStartedAt = Date.now()
    const addResult = await runTaktCli(this.config, addArgs, {
      cwd: this.workspacePath,
      reject: false,
      env: runtimeEnv,
    })
    const detail = resultDetail(addResult)
    traceEnqueue('connector.enqueueTask:taktAddDone', {
      elapsedMs: Date.now() - addStartedAt,
      exitCode: addResult.exitCode,
      detail: summarizeDetail(detail),
    })
    if (addResult.exitCode === 0 && !isMisroutedTaktAddResult(addResult)) {
      const listStartedAt = Date.now()
      const listed = await this.listTaskIds()
      const newId = listed.find((id) => !before.has(id))
      traceEnqueue('connector.enqueueTask:listTaskIdsDone', {
        elapsedMs: Date.now() - listStartedAt,
        listedCount: listed.length,
        discoveredTaskId: newId ?? null,
      })
      if (newId) {
        const postAddSanitizeStartedAt = Date.now()
        await sanitizeTasksYamlForTakt(this.workspacePath, this.config)
        await annotateTaskIssueNumber(this.workspacePath, this.config, newId, input.issueNumber)
        traceEnqueue('connector.enqueueTask:sanitizedAfterAdd', {
          elapsedMs: Date.now() - postAddSanitizeStartedAt,
        })
        traceEnqueue('connector.enqueueTask:done', {
          taskId: newId,
          strategy: 'takt_add',
          elapsedMs: Date.now() - startedAt,
        })
        return { taskId: newId, taskDir: '' }
      }
      return this.finishTaktAddWithPackageFallback(
        input,
        existingIds,
        runtimeWorkflow,
        startedAt,
        addResult,
        'takt add exited successfully but no new task row appeared in tasks.yaml',
      )
    }
    if (isMisroutedTaktAddResult(addResult)) {
      traceEnqueue('connector.enqueueTask:misroutedInteractive', {
        detail: summarizeDetail(resultDetail(addResult)),
      })
      return this.finishTaktAddWithPackageFallback(
        input,
        existingIds,
        runtimeWorkflow,
        startedAt,
        addResult,
        'takt add misrouted to interactive mode',
      )
    }
    const exitCode = addResult.exitCode ?? 'unknown'
    return this.finishTaktAddWithPackageFallback(
      input,
      existingIds,
      runtimeWorkflow,
      startedAt,
      addResult,
      `takt add exited with code ${exitCode}`,
    )
  }

  private async finishTaktAddWithPackageFallback(
    input: EnqueueTaskInput,
    existingIds: Set<string>,
    runtimeWorkflow: string,
    startedAt: number,
    addResult: { stderr?: unknown; stdout?: unknown },
    failureReason: string,
  ): Promise<TaskPackageResult> {
    const detail = resultDetail(addResult)
    if (!isEnqueuePackageFallbackAllowed()) {
      traceEnqueue('connector.enqueueTask:taktAddRejected', {
        reason: failureReason,
        detail: summarizeDetail(detail),
      })
      throw new TaktAddEnqueueError(
        formatTaktAddEnqueueFailureMessage(failureReason, detail),
        detail,
      )
    }
    const inputForFallback: EnqueueTaskInput = {
      ...input,
      workflow: runtimeWorkflow,
    }
    const fallbackStartedAt = Date.now()
    const fallback = await new TaskPackageWriter(this.workspacePath, this.config).createPackage(
      inputForFallback,
      existingIds,
    )
    traceEnqueue('connector.enqueueTask:done', {
      taskId: fallback.taskId,
      strategy: 'task_package_fallback',
      fallbackReason: failureReason,
      fallbackElapsedMs: Date.now() - fallbackStartedAt,
      elapsedMs: Date.now() - startedAt,
    })
    return fallback
  }

  async runTaskNow(input: EnqueueTaskInput): Promise<void> {
    const startedAt = Date.now()
    traceEnqueue('connector.runTaskNow:start', {
      workflow: input.workflow ?? null,
      titleLength: input.title.length,
      bodyLength: input.body?.length ?? 0,
    })
    try {
      await sanitizeTasksYamlForTakt(this.workspacePath, this.config)
      const runtime = await this.resolveRuntimeForInput(input)
      const cliOverrides = {
        ...(runtime.profile.provider ? { provider: runtime.profile.provider } : {}),
        ...(runtime.profile.model ? { model: runtime.profile.model } : {}),
      }
      await this.spawnDetachedRunTaskNow(cliOverrides, runtime.env)
      traceEnqueue('connector.runTaskNow:spawned', { elapsedMs: Date.now() - startedAt })
    } catch (error: unknown) {
      traceEnqueue('connector.runTaskNow:error', {
        elapsedMs: Date.now() - startedAt,
        message: summarizeError(error),
      })
      throw error
    }
  }

  /**
   * Start `takt run` in the background. Rejects when the process fails within
   * `RUN_TASK_NOW_FAST_FAIL_MS` so the renderer can surface errors.
   */
  private async spawnDetachedRunTaskNow(
    cliOverrides: { provider?: string; model?: string },
    runtimeEnv: Record<string, string>,
  ): Promise<void> {
    const args = taktRunAllCommand(cliOverrides)
    const subprocess = runTaktCli(this.config, args, {
      cwd: this.workspacePath,
      reject: false,
      detached: true,
      stdio: 'ignore',
      env: runtimeEnv,
    })
    const earlyResult = await Promise.race([
      subprocess,
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), RUN_TASK_NOW_FAST_FAIL_MS)
      }),
    ])
    if (earlyResult !== undefined) {
      await this.handleRunTaskNowResult(earlyResult, cliOverrides, runtimeEnv)
      return
    }
    subprocess.unref()
    void this.observeDetachedRunTaskNow(subprocess, cliOverrides, runtimeEnv)
  }

  private async observeDetachedRunTaskNow(
    subprocess: ReturnType<typeof runTaktCli>,
    cliOverrides: { provider?: string; model?: string },
    runtimeEnv: Record<string, string>,
  ): Promise<void> {
    let result: Awaited<ReturnType<typeof runTaktCli>>
    try {
      result = await subprocess
    } catch (error: unknown) {
      console.error('[takt] runTaskNow subprocess failed:', summarizeError(error))
      return
    }
    try {
      await this.handleRunTaskNowResult(result, cliOverrides, runtimeEnv, { throwOnFailure: false })
    } catch (error: unknown) {
      console.error('[takt] runTaskNow failed:', summarizeError(error))
    }
  }

  private async handleRunTaskNowResult(
    result: Awaited<ReturnType<typeof runTaktCli>>,
    cliOverrides: { provider?: string; model?: string },
    runtimeEnv: Record<string, string>,
    options: { throwOnFailure?: boolean } = {},
  ): Promise<void> {
    const throwOnFailure = options.throwOnFailure ?? true
    const detail = resultDetail(result)
    if (
      result.exitCode !== 0 &&
      shouldRetryWithCursorAuto(cliOverrides.provider, cliOverrides.model, detail)
    ) {
      await this.spawnDetachedRunTaskNow({ ...cliOverrides, model: 'auto' }, runtimeEnv)
      return
    }
    if (result.exitCode !== 0) {
      const message =
        summarizeDetail(detail) ??
        `takt run failed${result.exitCode != null ? ` (exit ${result.exitCode})` : ''}`
      if (throwOnFailure) throw new Error(message)
    }
  }

  async mergeResult(branch: string): Promise<string> {
    const trimmed = rejectInvalidGitBranchName(branch)
    if (!(await isGitBranchFormatValid(this.workspacePath, trimmed))) {
      throw new Error('Invalid branch name')
    }
    const engine = await this.executionProfile.loadEngineConfig()
    const env = await this.executionProfile.buildRuntimeEnv(engine)
    const args = taktMergeCommand(trimmed)
    const result = await runTaktCli(this.config, args, {
      cwd: this.workspacePath,
      reject: false,
      env,
    })
    return outputText(result.stdout) || outputText(result.stderr) || ''
  }

  private async listTaskIds(): Promise<string[]> {
    const { readTasksFromYaml } = await import('../lib/tasks-yaml-reader.js')
    const tasks = await readTasksFromYaml(this.workspacePath, this.config)
    return tasks.map((t) => t.id)
  }
}
