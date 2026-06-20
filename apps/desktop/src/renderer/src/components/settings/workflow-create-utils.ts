import type { WorkflowDraft } from './workflow-draft-types.js'
import { parseWorkflowYaml } from './workflow-parse.js'
import { serializeWorkflowDraft } from './workflow-serialize.js'

export type WorkflowCreateTemplate = 'default' | 'minimal' | 'scaffold' | 'spec-driven'

/** Default loop cap for empty scaffold; matches workflow editor hint. */
export const DEFAULT_SCAFFOLD_MAX_STEPS = 10

let _stepCounter = 0
function newStepId(): string {
  _stepCounter += 1
  return `step-new-${_stepCounter}`
}

export function newEmptyScaffoldDraft(
  name: string,
  initialStep?: string,
  maxSteps: number = DEFAULT_SCAFFOLD_MAX_STEPS,
): WorkflowDraft {
  const trimmedInitial = initialStep?.trim()
  return {
    name,
    description: '',
    initialStep: trimmedInitial || undefined,
    maxSteps,
    personas: [
      { key: 'planner', path: '../facets/personas/planner.md' },
      { key: 'coder', path: '../facets/personas/coder.md' },
      { key: 'qa-reviewer', path: '../facets/personas/qa-reviewer.md' },
    ],
    policies: [],
    knowledge: [],
    instructions: [],
    reportFormats: [],
    steps: [
      {
        id: newStepId(),
        name: 'plan',
        persona: 'planner',
        instruction: 'Analyze the task and produce a plan.',
        rules: [
          { id: 'r-1', mode: 'tag', text: 'Planning complete', next: 'implement' },
          { id: 'r-2', mode: 'tag', text: 'Cannot proceed', next: 'ABORT' },
        ],
        raw: {},
      },
      {
        id: newStepId(),
        name: 'implement',
        persona: 'coder',
        edit: true,
        instruction: 'Implement the plan.',
        rules: [{ id: 'r-3', mode: 'tag', text: 'Implementation complete', next: 'review' }],
        raw: {},
      },
      {
        id: newStepId(),
        name: 'review',
        persona: 'qa-reviewer',
        instruction: 'Review the implementation.',
        rules: [
          { id: 'r-4', mode: 'ai', text: 'Implementation looks correct', next: 'COMPLETE' },
          { id: 'r-5', mode: 'tag', text: 'Needs fix', next: 'implement' },
        ],
        raw: {},
      },
    ],
    unsupportedKeys: [],
  }
}

export async function loadTemplateDraft(
  template: WorkflowCreateTemplate,
  workflowName: string,
  scaffoldInitialStep?: string,
  scaffoldMaxSteps?: number,
): Promise<WorkflowDraft> {
  const trimmed = workflowName.trim()
  if (template === 'scaffold') {
    return newEmptyScaffoldDraft(
      trimmed,
      scaffoldInitialStep,
      scaffoldMaxSteps ?? DEFAULT_SCAFFOLD_MAX_STEPS,
    )
  }
  const builtinName =
    template === 'minimal' ? 'minimal' : template === 'spec-driven' ? 'spec-driven' : 'default'
  const res = await window.orbit.readWorkflow({
    nameOrPath: builtinName,
    source: 'builtin',
  })
  const parsed = parseWorkflowYaml(res.yaml)
  parsed.name = trimmed
  return parsed
}

export function draftFromImportedYaml(yaml: string, workflowName: string): WorkflowDraft {
  const parsed = parseWorkflowYaml(yaml)
  parsed.name = workflowName.trim()
  return parsed
}

export function stepSummaryLine(draft: WorkflowDraft): string {
  if (draft.steps.length === 0) return '(no steps)'
  return draft.steps.map((s) => s.name || '?').join(' → ')
}

export function personasSummary(draft: WorkflowDraft): string {
  return [...new Set(draft.steps.map((s) => s.persona).filter(Boolean))].join(', ') || '—'
}

/** Preview draft for template/import selection without mutating the editor. */
export async function previewDraftForTemplate(
  template: WorkflowCreateTemplate,
  scaffoldInitialStep?: string,
  scaffoldMaxSteps?: number,
): Promise<WorkflowDraft> {
  return loadTemplateDraft(
    template,
    template === 'scaffold' ? 'scaffold' : template,
    template === 'scaffold' ? scaffoldInitialStep : undefined,
    template === 'scaffold' ? scaffoldMaxSteps : undefined,
  )
}

export async function previewDraftForImportYaml(yaml: string): Promise<WorkflowDraft> {
  const parsed = parseWorkflowYaml(yaml)
  const nameFromYaml = parsed.name.trim() || 'imported'
  parsed.name = nameFromYaml
  return parsed
}

export { serializeWorkflowDraft }
