import type { FinalSelectionCandidateSummary, TaskRoutingRequirements } from '@planetz/shared'

const TASK_REQUIREMENTS_SYSTEM_PROMPT = `You extract structured task routing requirements from a user task description.
Respond with JSON only. No markdown fences or preamble.
Do not select workflow names. Do not invent workflow metadata.
Required JSON fields:
- intent: array of investigate|implement|review|audit|refactor
- expectedOutput: array of report|code|tests|review-findings
- mayModifyCode: boolean
- implementationAlreadyDecided: boolean
- needsRootCauseAnalysis: boolean
- needsTestWriting: boolean
- needsDeepReview: boolean
- targetSurfaces: array of frontend|backend|fullstack|infra|security|testing|cqrs|general
- ambiguity: low|medium|high
- blockingUnknowns: string array`

const FINAL_SELECTION_SYSTEM_PROMPT = `You pick one workflow from a fixed candidate list for a user task.
Candidates are already deterministic-ranked from best to worst.
Treat rank-1 as the default choice. Override rank-1 only when another candidate has clearly fewer structural conflicts with task constraints.
If you override rank-1, explain the structural conflict that forced the override in one sentence.
Respond with JSON only. No markdown fences or preamble.
Required fields: selectedWorkflow (string, must match a candidate workflowName), confidence (high|medium|low), decisionReason (string), comparedDifferences (string array).
Do not pick a workflow that forces implementation when the task has not decided to implement yet.`

export function buildTaskRequirementsSystemPrompt(): string {
  return TASK_REQUIREMENTS_SYSTEM_PROMPT
}

export function buildTaskRequirementsUserPrompt(prompt: string): string {
  return ['Task:', prompt].join('\n')
}

export function buildFinalSelectionSystemPrompt(): string {
  return FINAL_SELECTION_SYSTEM_PROMPT
}

export function buildFinalSelectionUserPrompt(
  prompt: string,
  requirements: TaskRoutingRequirements,
  candidates: FinalSelectionCandidateSummary[],
): string {
  return [
    'Task:',
    prompt,
    '',
    'Task requirements JSON:',
    JSON.stringify(requirements),
    '',
    'Candidate workflow summaries JSON (already ordered by deterministic rank):',
    JSON.stringify(candidates),
  ].join('\n')
}
