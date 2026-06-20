import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../shared/spec-driven/spec-driven-workflow-yaml.js'

/** Planetz simplified builtin workflows (override bundled takt `default`; no bundled `minimal`). */
export const BUILTIN_DEFAULT_WORKFLOW_YAML = `name: default
initial_step: plan
max_steps: 10
personas:
  planner: ../facets/personas/planner.md
  coder: ../facets/personas/coder.md
  qa-reviewer: ../facets/personas/qa-reviewer.md
policies:
  coding: ../facets/policies/coding.md
knowledge:
  architecture: ../facets/knowledge/architecture.md
instructions:
  plan: ../facets/instructions/plan.md
  implement: ../facets/instructions/implement.md
  review-qa: ../facets/instructions/review-qa.md
  answer-inquiry: ../facets/instructions/answer-inquiry.md
report_formats:
  plan: ../facets/output-contracts/plan.md
  summary: ../facets/output-contracts/summary.md
  qa_review: ../facets/output-contracts/qa-review.md
  answer: ../facets/output-contracts/answer.md
steps:
  - name: plan
    persona: planner
    instruction: plan
    policy: coding
    knowledge: architecture
    edit: false
    output_contracts:
      report:
        - name: plan.md
          format: plan
    rules:
      - condition: Requirements are clear and implementable
        next: implement
      - condition: User is asking a question (not an implementation task)
        next: answer
      - condition: Requirements unclear or insufficient information
        next: ABORT
  - name: answer
    persona: planner
    instruction: answer-inquiry
    policy: coding
    knowledge: architecture
    edit: false
    output_contracts:
      report:
        - name: answer.md
          format: answer
    rules:
      - condition: Answer complete
        next: COMPLETE
  - name: implement
    persona: coder
    instruction: implement
    policy: coding
    knowledge: architecture
    edit: true
    required_permission_mode: edit
    output_contracts:
      report:
        - name: summary.md
          format: summary
    rules:
      - condition: Implementation complete
        next: review
  - name: review
    persona: qa-reviewer
    instruction: review-qa
    policy: coding
    knowledge: architecture
    edit: false
    output_contracts:
      report:
        - name: qa-review.md
          format: qa_review
    rules:
      - condition: Approved
        next: COMPLETE
      - condition: Needs fix
        next: implement
`

export const BUILTIN_MINIMAL_WORKFLOW_YAML = `name: minimal
initial_step: run
max_steps: 4
personas:
  coder: ../facets/personas/coder.md
policies:
  coding: ../facets/policies/coding.md
knowledge:
  architecture: ../facets/knowledge/architecture.md
instructions:
  implement: ../facets/instructions/implement.md
report_formats:
  summary: ../facets/output-contracts/summary.md
steps:
  - name: run
    persona: coder
    instruction: implement
    policy: coding
    knowledge: architecture
    edit: true
    output_contracts:
      report:
        - name: summary.md
          format: summary
    rules:
      - condition: Done
        next: COMPLETE
`

/** Single-step chat workflow without edit/tools requirements (for local Ollama). */
export const BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML = `name: ollama-chat
initial_step: chat
max_steps: 4
personas:
  coder: ../facets/personas/coder.md
policies:
  coding: ../facets/policies/coding.md
knowledge:
  architecture: ../facets/knowledge/architecture.md
instructions:
  implement: ../facets/instructions/implement.md
steps:
  - name: chat
    persona: coder
    instruction: implement
    policy: coding
    knowledge: architecture
    edit: false
    rules:
      - condition: Done
        next: COMPLETE
`

/** Investigation-only chat workflow: gather context and hand off execution to Add Task. */
export const BUILTIN_CHAT_INVESTIGATION_WORKFLOW_YAML = `name: chat-investigation
description: Investigative coding companion workflow (no edits)
initial_step: investigate
max_steps: 8
personas:
  investigator: ../facets/personas/chat-investigator.md
policies:
  investigation-boundary: ../facets/policies/chat-investigation-boundary.md
knowledge:
  architecture: ../facets/knowledge/architecture.md
instructions:
  investigate: ../facets/instructions/chat-investigation.md
steps:
  - name: investigate
    persona: investigator
    instruction: investigate
    policy: investigation-boundary
    knowledge: architecture
    edit: false
    rules:
      - condition: User asks to continue investigation
        next: investigate
      - condition: User asks to execute changes
        next: COMPLETE
      - condition: Investigation summary complete
        next: COMPLETE
`

export const PLANETZ_FALLBACK_BUILTIN_NAMES = [
  'default',
  'minimal',
  'ollama-chat',
  'chat-investigation',
  'spec-driven',
] as const

export type PlanetzFallbackBuiltinName = (typeof PLANETZ_FALLBACK_BUILTIN_NAMES)[number]

export const PLANETZ_FALLBACK_BUILTIN_META: Record<
  PlanetzFallbackBuiltinName,
  { description: string; yaml: string }
> = {
  default: {
    description: 'Plan → implement → review; questions → answer (builtin)',
    yaml: BUILTIN_DEFAULT_WORKFLOW_YAML,
  },
  minimal: {
    description: 'Single coder pass (builtin)',
    yaml: BUILTIN_MINIMAL_WORKFLOW_YAML,
  },
  'ollama-chat': {
    description: 'Local Ollama chat pass without edit/tools steps (builtin)',
    yaml: BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML,
  },
  'chat-investigation': {
    description: 'Investigation-only chat workflow with Task handoff boundary (builtin)',
    yaml: BUILTIN_CHAT_INVESTIGATION_WORKFLOW_YAML,
  },
  'spec-driven': {
    description:
      'Spec-driven: requirements → design → tagged tasks → core/UI implementation (builtin template)',
    yaml: SPEC_DRIVEN_WORKFLOW_YAML,
  },
}
