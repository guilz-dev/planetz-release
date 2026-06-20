import type { WorkflowSummary } from '@planetz/shared'
import {
  BUILTIN_DEFAULT_WORKFLOW_YAML,
  BUILTIN_MINIMAL_WORKFLOW_YAML,
} from '../takt/builtin-workflow-yaml.js'

export const DEFAULT_WORKFLOW_YAML = BUILTIN_DEFAULT_WORKFLOW_YAML

export const MINIMAL_WORKFLOW_YAML = BUILTIN_MINIMAL_WORKFLOW_YAML

export const TEST_FIRST_WORKFLOW_YAML = `name: test-first
initial_step: red
max_steps: 12
steps:
  - name: red
    persona: tester
    edit: true
    rules:
      - condition: Failing test added
        next: green
  - name: green
    persona: coder
    edit: true
    rules:
      - condition: Tests pass
        next: refactor
  - name: refactor
    persona: reviewer
    edit: true
    rules:
      - condition: Approved
        next: COMPLETE
`

export interface WorkflowFixture {
  summary: WorkflowSummary
  yaml: string
}

export const WORKFLOW_FIXTURES: WorkflowFixture[] = [
  {
    summary: {
      name: 'default',
      source: 'builtin',
      description: 'Plan → implement → review; questions → answer (builtin)',
      stepNames: ['plan', 'answer', 'implement', 'review'],
      agentRoles: ['planner', 'coder', 'reviewer'],
      steps: [
        { name: 'plan', persona: 'planner' },
        { name: 'answer', persona: 'planner' },
        { name: 'implement', persona: 'coder' },
        { name: 'review', persona: 'reviewer' },
      ],
      isOverridden: false,
      diagnostics: [],
    },
    yaml: DEFAULT_WORKFLOW_YAML,
  },
  {
    summary: {
      name: 'minimal',
      source: 'project',
      path: '.takt/workflows/minimal.yaml',
      description: 'Single coder pass (project override)',
      stepNames: ['run'],
      agentRoles: ['coder'],
      steps: [{ name: 'run', persona: 'coder' }],
      isOverridden: false,
      diagnostics: [],
    },
    yaml: MINIMAL_WORKFLOW_YAML,
  },
  {
    summary: {
      name: 'test-first',
      source: 'user',
      path: '~/.takt/workflows/test-first.yaml',
      description: 'TDD-style red → green → refactor (user-level)',
      stepNames: ['red', 'green', 'refactor'],
      agentRoles: ['tester', 'coder', 'reviewer'],
      steps: [
        { name: 'red', persona: 'tester' },
        { name: 'green', persona: 'coder' },
        { name: 'refactor', persona: 'reviewer' },
      ],
      isOverridden: false,
      diagnostics: [],
    },
    yaml: TEST_FIRST_WORKFLOW_YAML,
  },
]

export const MOCK_WORKFLOWS: WorkflowSummary[] = WORKFLOW_FIXTURES.map((f) => f.summary)

export function findWorkflowFixture(name: string): WorkflowFixture | undefined {
  return WORKFLOW_FIXTURES.find((f) => f.summary.name === name)
}
