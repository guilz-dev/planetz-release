import {
  type OllamaWorkflowCompatIssue,
  scanWorkflowOllamaCompatibility,
} from './ollama-workflow-compat.js'
import type { OllamaToolsGuardMode } from './ui-ollama-settings.js'

export type OllamaExecutionGuardAction = 'allow' | 'warn' | 'block'

export interface OllamaExecutionGuardResult {
  action: OllamaExecutionGuardAction
  issues: OllamaWorkflowCompatIssue[]
}

/** Composer / IPC preview: same explicit guard outcome used by enqueue/run. */
export interface OllamaExecutionGuardPreviewResult extends OllamaExecutionGuardResult {}

export class OllamaExecutionBlockedError extends Error {
  readonly issues: OllamaWorkflowCompatIssue[]

  constructor(issues: OllamaWorkflowCompatIssue[]) {
    super(formatOllamaExecutionBlockedMessage(issues))
    this.name = 'OllamaExecutionBlockedError'
    this.issues = issues
  }
}

export function formatOllamaExecutionBlockedMessage(issues: OllamaWorkflowCompatIssue[]): string {
  if (issues.length === 0) {
    return 'This workflow is not compatible with Ollama execution.'
  }
  const lines = issues.map((issue) => `${issue.stepName}: ${issue.kind}`)
  return `Ollama cannot run this workflow (tools/edit required). Steps: ${lines.join('; ')}`
}

/** Evaluate guard for resolved provider + workflow YAML. */
function issuesForMissingWorkflowYaml(workflowName: string): OllamaWorkflowCompatIssue[] {
  return [{ stepName: workflowName, kind: 'workflow_unavailable' }]
}

export function evaluateOllamaExecutionGuard(input: {
  provider: string | undefined
  workflowYaml: string | null | undefined
  guardMode: OllamaToolsGuardMode
  workflowName?: string
}): OllamaExecutionGuardResult {
  if (input.guardMode === 'off') {
    return { action: 'allow', issues: [] }
  }
  if (input.provider?.trim() !== 'ollama') {
    return { action: 'allow', issues: [] }
  }
  const workflowName = input.workflowName?.trim() ?? ''
  const yaml = input.workflowYaml?.trim() ?? ''
  if (workflowName.length > 0 && yaml.length === 0) {
    const issues = issuesForMissingWorkflowYaml(workflowName)
    if (input.guardMode === 'warn') {
      return { action: 'warn', issues }
    }
    return { action: 'block', issues }
  }
  if (yaml.length === 0) {
    return { action: 'allow', issues: [] }
  }
  const scan = scanWorkflowOllamaCompatibility(yaml)
  if (scan.compatible) {
    return { action: 'allow', issues: [] }
  }
  if (input.guardMode === 'warn') {
    return { action: 'warn', issues: scan.issues }
  }
  return { action: 'block', issues: scan.issues }
}

/** Throws {@link OllamaExecutionBlockedError} when guard mode is block and workflow is incompatible. */
export function assertOllamaExecutionAllowed(input: {
  provider: string | undefined
  workflowYaml: string | null | undefined
  guardMode: OllamaToolsGuardMode
  workflowName?: string
}): OllamaExecutionGuardResult {
  const result = evaluateOllamaExecutionGuard(input)
  if (result.action === 'block') {
    throw new OllamaExecutionBlockedError(result.issues)
  }
  return result
}
