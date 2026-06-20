import type {
  StepActivityEntry,
  TaskViewModel,
  WorkflowStepActivityView,
  WorkflowSummary,
} from '@planetz/shared'
import { ArrowLeft, ExternalLink, Hash, Sparkles, Timer } from 'lucide-react'
import { useEffect } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { TaskCard } from '../task-card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { StatusDot } from '../ui/status-dot'
import { WorkflowStepList } from '../workflow-step-list'

interface MockStep {
  name: string
  persona?: string
  latestActivity?: StepActivityEntry
  history?: StepActivityEntry[]
  summary?: string
}

interface ScenarioConfig {
  id: string
  title: string
  description: string
  task: TaskViewModel
  workflow: WorkflowSummary
  detailSteps: MockStep[]
  detailActiveIdx: number
  detailLive: boolean
  elapsedLabel: string
  executorLabel: string | null
}

const DEFAULT_WORKFLOW_BASE: Omit<WorkflowSummary, 'name' | 'stepNames' | 'steps' | 'agentRoles'> =
  {
    source: 'project',
    isOverridden: false,
    diagnostics: [],
    formEditable: true,
  }

function mockStepsToActivities(steps: MockStep[]): WorkflowStepActivityView[] {
  return steps.map((step) => ({
    stepName: step.name,
    history: step.history ?? [],
    ...(step.latestActivity ? { latest: step.latestActivity } : {}),
    ...(step.summary ? { summary: step.summary } : {}),
  }))
}

function buildWorkflow(name: string, steps: MockStep[]): WorkflowSummary {
  return {
    ...DEFAULT_WORKFLOW_BASE,
    name,
    stepNames: steps.map((s) => s.name),
    agentRoles: steps.map((s) => s.persona).filter((p): p is string => Boolean(p)),
    steps: steps.map((s) => ({ name: s.name, ...(s.persona ? { persona: s.persona } : {}) })),
  }
}

function buildRunningTask(
  partial: Pick<TaskViewModel, 'id' | 'title' | 'workflow'> & {
    activeStep?: string
    stepActivities: WorkflowStepActivityView[]
    assignedAgentId?: string
    sourceBranch?: string
  },
): TaskViewModel {
  return {
    id: partial.id,
    title: partial.title,
    status: 'running',
    priority: 'normal',
    source: 'takt',
    createdAt: '2026-05-27T13:00:00.000Z',
    updatedAt: '2026-05-27T13:02:00.000Z',
    workflow: partial.workflow,
    assignedAgentId: partial.assignedAgentId,
    sourceBranch: partial.sourceBranch,
    activeStep: partial.activeStep,
    workflowStepActivities: partial.stepActivities,
  }
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'default-3step',
    title: 'Default workflow · 3 steps',
    description: 'Most common case: plan → implement → review. Card uses dot tracker.',
    detailSteps: [
      {
        name: 'plan',
        persona: 'planner',
        summary: 'Completed in 48s',
        history: [
          { at: '2026-05-27T14:30:02.000Z', kind: 'message', text: 'step started: plan' },
          { at: '2026-05-27T14:30:18.000Z', kind: 'read', text: 'read order.md' },
          { at: '2026-05-27T14:30:50.000Z', kind: 'message', text: 'step complete: plan' },
        ],
      },
      {
        name: 'implement',
        persona: 'coder',
        latestActivity: {
          at: '2026-05-27T14:32:14.000Z',
          kind: 'edit',
          text: 'writing src/auth/session.ts',
        },
        history: [
          { at: '2026-05-27T14:30:51.000Z', kind: 'message', text: 'step started: implement' },
          { at: '2026-05-27T14:32:14.000Z', kind: 'edit', text: 'writing src/auth/session.ts' },
        ],
      },
      { name: 'review', persona: 'reviewer' },
    ],
    detailActiveIdx: 1,
    detailLive: true,
    elapsedLabel: '2m 14s',
    executorLabel: 'Cursor',
    workflow: buildWorkflow('default', [
      { name: 'plan', persona: 'planner' },
      { name: 'implement', persona: 'coder' },
      { name: 'review', persona: 'reviewer' },
    ]),
    task: buildRunningTask({
      id: 'implement-auth-core',
      title: 'Implement auth core',
      workflow: 'default',
      activeStep: 'implement',
      assignedAgentId: 'agent-coder',
      sourceBranch: 'feature/auth-core',
      stepActivities: mockStepsToActivities([
        {
          name: 'plan',
          summary: 'Completed in 48s',
          history: [
            { at: '2026-05-27T14:30:02.000Z', kind: 'message', text: 'step started: plan' },
            { at: '2026-05-27T14:30:50.000Z', kind: 'message', text: 'step complete: plan' },
          ],
        },
        {
          name: 'implement',
          latestActivity: {
            at: '2026-05-27T14:32:14.000Z',
            kind: 'edit',
            text: 'writing src/auth/session.ts',
          },
          history: [
            { at: '2026-05-27T14:30:51.000Z', kind: 'message', text: 'step started: implement' },
            { at: '2026-05-27T14:32:14.000Z', kind: 'edit', text: 'writing src/auth/session.ts' },
          ],
        },
        { name: 'review' },
      ]),
    }),
  },
  {
    id: 'takt-9step',
    title: 'Takt workflow · 9 steps',
    description: 'Long workflow. Card switches to progress bar (≥ 5 steps).',
    detailSteps: [
      { name: 'spec', summary: 'Completed in 1m 12s' },
      { name: 'plan', summary: 'Completed in 2m 03s' },
      { name: 'scaffold', summary: 'Completed in 54s' },
      {
        name: 'implement',
        persona: 'coder',
        latestActivity: {
          at: '2026-05-27T14:29:51.000Z',
          kind: 'tool',
          text: 'running pnpm test --filter @billing/core',
        },
        history: [
          { at: '2026-05-27T14:24:10.000Z', kind: 'message', text: 'step started: implement' },
          { at: '2026-05-27T14:29:51.000Z', kind: 'tool', text: 'running pnpm test' },
        ],
      },
      { name: 'self-review' },
      { name: 'test' },
      { name: 'docs' },
      { name: 'review' },
      { name: 'merge' },
    ],
    detailActiveIdx: 3,
    detailLive: true,
    elapsedLabel: '11m',
    executorLabel: 'Claude',
    workflow: buildWorkflow(
      'takt-default',
      [
        'spec',
        'plan',
        'scaffold',
        'implement',
        'self-review',
        'test',
        'docs',
        'review',
        'merge',
      ].map((name) => ({ name })),
    ),
    task: buildRunningTask({
      id: 'billing-migration',
      title: 'Migrate billing pipeline',
      workflow: 'takt-default',
      activeStep: 'implement',
      assignedAgentId: 'agent-orchestrator',
      sourceBranch: 'feature/billing-migration',
      stepActivities: mockStepsToActivities([
        { name: 'spec', summary: 'Completed in 1m 12s' },
        { name: 'plan', summary: 'Completed in 2m 03s' },
        { name: 'scaffold', summary: 'Completed in 54s' },
        {
          name: 'implement',
          latestActivity: {
            at: '2026-05-27T14:29:51.000Z',
            kind: 'tool',
            text: 'running pnpm test --filter @billing/core',
          },
          history: [{ at: '2026-05-27T14:29:51.000Z', kind: 'tool', text: 'running pnpm test' }],
        },
        { name: 'self-review' },
        { name: 'test' },
        { name: 'docs' },
        { name: 'review' },
        { name: 'merge' },
      ]),
    }),
  },
  {
    id: 'unknown-step',
    title: 'Unknown active step',
    description: 'When activeStep is unresolved, no spinner is shown (do not lie).',
    detailSteps: [{ name: 'plan' }, { name: 'implement' }, { name: 'review' }],
    detailActiveIdx: -1,
    detailLive: true,
    elapsedLabel: '4m',
    executorLabel: 'Cursor (inferred)',
    workflow: buildWorkflow('default', [
      { name: 'plan' },
      { name: 'implement' },
      { name: 'review' },
    ]),
    task: buildRunningTask({
      id: 'audit-cursor',
      title: 'Audit external cursor integration',
      workflow: 'default',
      stepActivities: mockStepsToActivities([
        { name: 'plan' },
        { name: 'implement' },
        { name: 'review' },
      ]),
      assignedAgentId: 'agent-external-cursor',
    }),
  },
]

export function MockRunningTaskPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  const now = Date.now()

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/60 px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-strong)]">
            UI Mock · planetz
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">
            Running task — production components
          </h1>
          <p className="mt-1 max-w-3xl text-[12px] text-[var(--color-muted-strong)]">
            Uses the same <span className="font-mono">WorkflowStepList</span>,{' '}
            <span className="font-mono">TaskCard</span>, and{' '}
            <span className="font-mono">StepActivityLog</span> as the live app. Append{' '}
            <span className="font-mono">#mock/running-task</span> to the URL.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        {SCENARIOS.map((scenario) => (
          <ScenarioSection key={scenario.id} scenario={scenario} now={now} />
        ))}
      </main>
    </div>
  )
}

function ScenarioSection({ scenario, now }: { scenario: ScenarioConfig; now: number }) {
  const activeStep =
    scenario.detailActiveIdx >= 0 ? scenario.detailSteps[scenario.detailActiveIdx]?.name : undefined
  const task = { ...scenario.task, activeStep }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/50 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">
            {scenario.title}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-muted-strong)]">
            {scenario.description}
          </p>
        </div>
        <Badge tone="accent">{scenario.id}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div>
          <SectionLabel>Detail panel (WorkflowStepList)</SectionLabel>
          <MockDetailPanel scenario={scenario} task={task} activeStep={activeStep} />
        </div>
        <div>
          <SectionLabel>Task card (production)</SectionLabel>
          <TaskCard
            task={task}
            selected
            skin={defaultSkin}
            workflow={scenario.workflow}
            now={now}
            onSelect={() => {}}
          />
        </div>
      </div>
    </section>
  )
}

function MockDetailPanel({
  scenario,
  task,
  activeStep,
}: {
  scenario: ScenarioConfig
  task: TaskViewModel
  activeStep: string | undefined
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 p-4">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)]/70 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-strong)]">
            Task detail
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-strong)]">
            {task.title}
          </h3>
        </div>
        <Button type="button" variant="ghost" size="sm" leading={<ArrowLeft size={12} />}>
          Back
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="running" leading={<StatusDot tone="running" pulse />}>
          running
        </Badge>
      </div>

      <section
        aria-label="workflow progress"
        className="flex flex-col gap-3 rounded-md border border-[var(--color-status-running)]/30 bg-[var(--color-status-running-soft)]/30 p-2.5"
      >
        <WorkflowStepList
          workflow={scenario.workflow}
          activeStep={activeStep}
          live={scenario.detailLive}
          stepActivities={task.workflowStepActivities}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)]/50 pt-2 text-[11px] text-[var(--color-muted-strong)]">
          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--color-text)]">
            <Timer size={11} className="text-[var(--color-status-running)]" />
            {scenario.elapsedLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-[var(--color-muted)]">on</span>
            <span className="font-mono text-[var(--color-text)]">{activeStep ?? '—'}</span>
          </span>
          {scenario.executorLabel ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles size={11} className="text-[var(--color-accent)]" />
              {scenario.executorLabel}
            </span>
          ) : null}
        </div>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="flex items-center gap-1 text-[var(--color-muted)]">
          <Hash size={11} />
          id
        </dt>
        <dd className="font-mono text-[var(--color-text)]">{task.id}</dd>
      </dl>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        leading={<ExternalLink size={12} />}
      >
        Open in Log
      </Button>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
      {children}
    </p>
  )
}
