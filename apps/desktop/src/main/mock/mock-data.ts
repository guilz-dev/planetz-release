import type { AgentState, ChainGroup, TaskViewModel } from '@planetz/shared'
import { activeRunIdFor, getMockRunSeeds } from './run-events-mock.js'

export { MOCK_WORKFLOWS } from './workflows-mock.js'

const NOW = new Date().toISOString()
const EARLIER = new Date(Date.now() - 12 * 60_000).toISOString()
const MUCH_EARLIER = new Date(Date.now() - 90 * 60_000).toISOString()

function mockRunSeedFor(taskId: string) {
  return getMockRunSeeds().find((r) => r.taskId === taskId)
}

const AUTH_RUN = mockRunSeedFor('implement-auth-core')
const FLAKY_RUN = mockRunSeedFor('fix-flaky-test')

export const MOCK_AGENTS: AgentState[] = [
  {
    id: 'agent-planner',
    displayName: 'Planner',
    runtime: 'takt',
    role: 'planner',
    status: 'idle',
    logTail: [],
    updatedAt: NOW,
  },
  {
    id: 'agent-coder',
    displayName: 'Coder',
    runtime: 'takt',
    role: 'coder',
    status: 'working',
    currentTaskId: 'implement-auth-core',
    currentRunId: AUTH_RUN ? activeRunIdFor(AUTH_RUN) : undefined,
    branch: 'feature/auth-core',
    logTail: [
      { at: EARLIER, level: 'info', message: 'plan step complete' },
      { at: NOW, level: 'info', message: 'implement step started' },
    ],
    updatedAt: NOW,
  },
  {
    id: 'agent-reviewer',
    displayName: 'Reviewer',
    runtime: 'takt',
    role: 'reviewer',
    status: 'waiting',
    logTail: [],
    updatedAt: NOW,
  },
  {
    id: 'agent-tester',
    displayName: 'Tester',
    runtime: 'takt',
    role: 'tester',
    status: 'reviewing',
    currentTaskId: 'fix-flaky-test',
    currentRunId: FLAKY_RUN ? activeRunIdFor(FLAKY_RUN) : undefined,
    logTail: [{ at: NOW, level: 'warn', message: 'flaky test reproduced once' }],
    updatedAt: NOW,
  },
  {
    id: 'agent-external-cursor',
    displayName: 'Cursor (external)',
    runtime: 'external',
    role: 'custom',
    status: 'idle',
    logTail: [{ at: NOW, level: 'info', message: 'awaiting /agents/push' }],
    updatedAt: NOW,
  },
  {
    id: 'agent-external-codex',
    displayName: 'Codex (external)',
    runtime: 'external',
    role: 'custom',
    status: 'idle',
    logTail: [{ at: NOW, level: 'info', message: 'awaiting /agents/push' }],
    updatedAt: NOW,
  },
  {
    id: 'agent-external-claude',
    displayName: 'Claude Code (external)',
    runtime: 'external',
    role: 'custom',
    status: 'idle',
    logTail: [{ at: NOW, level: 'info', message: 'awaiting /agents/push' }],
    updatedAt: NOW,
  },
]

export const MOCK_CHAINS: ChainGroup[] = [
  {
    id: 'chain-auth-flow',
    createdAt: EARLIER,
    taskIds: ['implement-auth-core', 'add-login-ui'],
    edges: [
      {
        fromTaskId: 'implement-auth-core',
        toTaskId: 'add-login-ui',
        mode: 'branch_handoff',
        status: 'waiting_for_dependency',
        sourceBranch: 'feature/auth-core',
        baseBranch: 'main',
      },
    ],
  },
]

export const MOCK_TASKS: TaskViewModel[] = [
  {
    id: 'implement-auth-core',
    title: 'Implement auth core',
    body: 'Add session handling, token validation, and refresh rotation. Cover edge cases for expired tokens.',
    workflow: 'default',
    priority: 'high',
    status: 'running',
    assignedAgentId: 'agent-coder',
    source: 'user',
    createdAt: EARLIER,
    updatedAt: NOW,
    activeRunId: AUTH_RUN ? activeRunIdFor(AUTH_RUN) : undefined,
    sourceBranch: 'feature/auth-core',
  },
  {
    id: 'add-login-ui',
    title: 'Add login UI',
    body: 'Build login page with email + password, hook up to auth core when available.',
    workflow: 'default',
    priority: 'normal',
    status: 'pending',
    source: 'user',
    dependsOnTaskId: 'implement-auth-core',
    sourceBranch: 'feature/auth-core',
    baseBranch: 'main',
    chainId: 'chain-auth-flow',
    createdAt: EARLIER,
    updatedAt: EARLIER,
  },
  {
    id: 'fix-flaky-test',
    title: 'Fix flaky test',
    body: 'auth.spec.ts intermittently fails on CI — narrow down race or fixture issue.',
    workflow: 'test-first',
    priority: 'normal',
    status: 'running',
    assignedAgentId: 'agent-tester',
    source: 'takt',
    createdAt: EARLIER,
    updatedAt: NOW,
    activeRunId: FLAKY_RUN ? activeRunIdFor(FLAKY_RUN) : undefined,
  },
  {
    id: 'cleanup-deprecated',
    title: 'Remove deprecated logger',
    workflow: 'minimal',
    priority: 'low',
    status: 'completed',
    source: 'user',
    createdAt: MUCH_EARLIER,
    updatedAt: EARLIER,
    sourceBranch: 'chore/remove-logger',
  },
  {
    id: 'broken-migration',
    title: 'Migrate orders table',
    body: 'Add NOT NULL constraint to orders.created_by. Failed during backfill.',
    workflow: 'default',
    priority: 'high',
    status: 'failed',
    source: 'user',
    createdAt: MUCH_EARLIER,
    updatedAt: EARLIER,
    sourceBranch: 'feature/orders-not-null',
  },
  {
    id: 'long-research',
    title: 'Research caching strategy',
    workflow: 'default',
    priority: 'low',
    status: 'exceeded',
    source: 'user',
    createdAt: MUCH_EARLIER,
    updatedAt: EARLIER,
  },
]
