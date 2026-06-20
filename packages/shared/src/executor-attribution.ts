import type { AgentOverrides } from './agent-overrides-schema.js'
import { resolveAgentRoleExecution } from './agent-role-execution.js'
import type { EngineConfig } from './engine-config-schema.js'
import type { ExecutionProfile } from './execution-profile.js'
import { resolvePersonaForAttribution } from './persona-attribution.js'
import type {
  RunEvent,
  TaskExecutionAttribution,
  WorkflowStepSummary,
  WorkflowSummary,
} from './types.js'

export { personaForWorkflowStep } from './persona-attribution.js'

/** Canonical executor IDs for external providers (matches integrations ADAPTER_META). */
export const EXECUTOR_ID_CURSOR = 'agent-external-cursor'
export const EXECUTOR_ID_CODEX = 'agent-external-codex'
export const EXECUTOR_ID_CLAUDE = 'agent-external-claude'

const PROVIDER_ALIASES: Record<string, string> = {
  cursor: 'cursor',
  'cursor-cli': 'cursor',
  codex: 'codex',
  'openai-codex': 'codex',
  claude: 'claude',
  'claude-code': 'claude',
  anthropic: 'claude',
}

const EXECUTOR_BY_PROVIDER: Record<string, string> = {
  cursor: EXECUTOR_ID_CURSOR,
  codex: EXECUTOR_ID_CODEX,
  claude: EXECUTOR_ID_CLAUDE,
}

export function normalizeProviderId(provider: string | undefined): string | undefined {
  const raw = provider?.trim().toLowerCase()
  if (!raw) return undefined
  return PROVIDER_ALIASES[raw] ?? raw
}

export function providerToExecutorId(provider: string | undefined): string | undefined {
  const normalized = normalizeProviderId(provider)
  if (!normalized) return undefined
  return EXECUTOR_BY_PROVIDER[normalized]
}

export interface ResolveTaskExecutionAttributionInput {
  taskId: string
  status: string
  activeStep?: string
  activeRunId?: string
  workflow?: WorkflowSummary
  assignedAgentId?: string
  taskAssignmentExecutorId?: string
  executionProfile?: ExecutionProfile
  engine: EngineConfig
  agentOverrides: AgentOverrides
  /** Chronological run events for the workspace (optional; enables runtime persona). */
  runEvents?: RunEvent[]
}

function attribution(
  partial: Omit<TaskExecutionAttribution, 'taskId'> & { taskId: string },
): TaskExecutionAttribution {
  return { ...partial }
}

function noneAttribution(
  taskId: string,
  activeStep?: string,
  activeRunId?: string,
): TaskExecutionAttribution {
  return attribution({
    taskId,
    activeStep,
    runId: activeRunId,
    source: 'unknown',
    confidence: 'none',
  })
}

export function resolveTaskExecutionAttribution(
  input: ResolveTaskExecutionAttributionInput,
): TaskExecutionAttribution {
  const { taskId, activeStep, activeRunId, workflow, engine, agentOverrides } = input

  if (input.status !== 'running') {
    return noneAttribution(taskId, activeStep, activeRunId)
  }

  const explicitId = input.taskAssignmentExecutorId ?? input.assignedAgentId
  if (explicitId?.trim()) {
    return attribution({
      taskId,
      activeStep,
      runId: activeRunId,
      executorId: explicitId.trim(),
      source: 'explicit-assignment',
      confidence: 'high',
    })
  }

  const resolvedPersona = resolvePersonaForAttribution({
    activeStep,
    workflow,
    runEvents: input.runEvents,
    activeRunId,
  })
  const stepPersona = resolvedPersona?.persona
  if (activeStep && stepPersona) {
    const resolved = resolveAgentRoleExecution(stepPersona, engine, agentOverrides)
    const executorId = providerToExecutorId(resolved.provider)
    if (executorId) {
      // `source: workflow-step` = executor from persona_providers routing, not YAML-only.
      return attribution({
        taskId,
        activeStep,
        runId: activeRunId,
        persona: stepPersona,
        personaSource: resolvedPersona.source,
        executorId,
        source: 'workflow-step',
        confidence: 'medium',
      })
    }
  }

  const profileExecutor = providerToExecutorId(input.executionProfile?.provider)
  if (profileExecutor) {
    return attribution({
      taskId,
      activeStep,
      runId: activeRunId,
      persona: stepPersona,
      ...(resolvedPersona ? { personaSource: resolvedPersona.source } : {}),
      executorId: profileExecutor,
      source: 'profile-provider',
      confidence: 'medium',
    })
  }

  return noneAttribution(taskId, activeStep, activeRunId)
}

export function buildWorkflowStepsFromLegacy(summary: {
  stepNames: string[]
  agentRoles: string[]
}): WorkflowStepSummary[] {
  return summary.stepNames.map((name, i) => ({
    name,
    ...(summary.agentRoles[i] ? { persona: summary.agentRoles[i] } : {}),
  }))
}
