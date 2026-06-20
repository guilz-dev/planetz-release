import type { TaskViewModel, WorkflowStepActivityView, WorkflowSummary } from '@planetz/shared'
import { Fingerprint, ShieldCheck, Timer, Waypoints } from 'lucide-react'
import { useEffect } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { TaskCard } from '../task-card'
import { Badge } from '../ui/badge'
import { StatusDot } from '../ui/status-dot'
import { WorkflowStepList } from '../workflow-step-list'

const WORKFLOW: WorkflowSummary = {
  name: 'safe-deploy',
  source: 'project',
  isOverridden: false,
  diagnostics: [],
  formEditable: true,
  stepNames: ['plan', 'implement', 'review', 'approve-deploy', 'deploy'],
  agentRoles: ['planner', 'coder', 'reviewer', 'operator'],
  steps: [
    { name: 'plan', persona: 'planner' },
    { name: 'implement', persona: 'coder' },
    { name: 'review', persona: 'reviewer' },
    { name: 'approve-deploy', persona: 'operator' },
    { name: 'deploy' },
  ],
}

const STEP_ACTIVITIES: WorkflowStepActivityView[] = [
  {
    stepName: 'plan',
    history: [{ at: '2026-06-20T08:40:05.000Z', kind: 'message', text: 'step complete: plan' }],
    summary: 'Completed in 31s',
  },
  {
    stepName: 'implement',
    history: [
      { at: '2026-06-20T08:40:20.000Z', kind: 'message', text: 'step complete: implement' },
    ],
    summary: 'Completed in 2m 14s',
  },
  {
    stepName: 'review',
    history: [{ at: '2026-06-20T08:42:52.000Z', kind: 'message', text: 'step complete: review' }],
    summary: 'Completed in 44s',
  },
  {
    stepName: 'approve-deploy',
    history: [
      {
        at: '2026-06-20T08:43:01.000Z',
        kind: 'message',
        text: 'waiting for human approval before deploy',
      },
    ],
    latest: {
      at: '2026-06-20T08:43:01.000Z',
      kind: 'message',
      text: 'waiting for human approval before deploy',
    },
  },
  { stepName: 'deploy', history: [] },
]

const TASK: TaskViewModel = {
  id: 'deploy-auth-session-refresh',
  title: 'Ship session refresh hardening',
  status: 'running',
  priority: 'high',
  source: 'takt',
  createdAt: '2026-06-20T08:39:33.000Z',
  updatedAt: '2026-06-20T08:43:01.000Z',
  workflow: 'safe-deploy',
  activeStep: 'approve-deploy',
  assignedAgentId: 'agent-coder',
  sourceBranch: 'release/session-hardening',
  workflowStepActivities: STEP_ACTIVITIES,
}

const APPROVAL_GATES = [
  'Before deploy to production',
  'Before destructive schema changes',
  'Before expanding scope beyond the ratified intent',
]

const MANTA_STATES = [
  {
    label: 'Working',
    tone: 'running' as const,
    detail: 'Agent finished review and requested deploy approval.',
  },
  {
    label: 'Waiting',
    tone: 'completed' as const,
    detail: 'Manta surfaces the approval request on the desk display.',
  },
  {
    label: 'Approved',
    tone: 'accent' as const,
    detail: 'A single physical confirmation releases the deploy step.',
  },
]

export function MockIntroHarnessPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-background)] px-8 py-8 text-[var(--color-text)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)]/65 shadow-[0_24px_80px_rgba(8,12,24,0.35)]">
        <header className="border-b border-[var(--color-border)]/80 px-8 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Workflow control
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text-strong)]">
            Approval harness
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted-strong)]">
            Agents can run in parallel, but risky steps stay gated. Operators approve only the
            moments that matter and Manta surfaces the request in the physical world.
          </p>
        </header>

        <main className="grid flex-1 gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="grid content-start gap-5">
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    Live task
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">
                    {TASK.title}
                  </h2>
                </div>
                <Badge tone="running" leading={<StatusDot tone="running" pulse />}>
                  awaiting approval
                </Badge>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section
                  aria-label="workflow progress"
                  className="rounded-xl border border-[var(--color-status-running)]/30 bg-[var(--color-status-running-soft)]/20 p-4"
                >
                  <WorkflowStepList
                    workflow={WORKFLOW}
                    activeStep={TASK.activeStep}
                    live
                    stepActivities={STEP_ACTIVITIES}
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)]/60 pt-3 text-[11px] text-[var(--color-muted-strong)]">
                    <span className="inline-flex items-center gap-1 font-mono text-[var(--color-text)]">
                      <Timer size={11} className="text-[var(--color-status-running)]" />
                      3m 28s total
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Waypoints size={11} className="text-[var(--color-accent)]" />
                      next: deploy
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck size={11} className="text-[var(--color-status-completed)]" />
                      gate armed
                    </span>
                  </div>
                </section>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    Task card
                  </p>
                  <TaskCard
                    task={TASK}
                    selected
                    skin={defaultSkin}
                    workflow={WORKFLOW}
                    now={Date.now()}
                    onSelect={() => {}}
                  />
                </div>
              </div>
            </article>
          </section>

          <aside className="grid content-start gap-5">
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[var(--color-status-completed)]" />
                <h2 className="text-base font-semibold text-[var(--color-text-strong)]">
                  Human approval gates
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {APPROVAL_GATES.map((gate) => (
                  <div
                    key={gate}
                    className="rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-panel)]/80 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[var(--color-text-strong)]">{gate}</p>
                      <Badge tone="accent">required</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5">
              <div className="flex items-center gap-2">
                <Fingerprint size={16} className="text-[var(--color-accent)]" />
                <h2 className="text-base font-semibold text-[var(--color-text-strong)]">
                  Manta companion
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {MANTA_STATES.map((state) => (
                  <div
                    key={state.label}
                    className="rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-panel)]/80 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                        {state.label}
                      </p>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted-strong)]">
                      {state.detail}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </main>
      </div>
    </div>
  )
}
