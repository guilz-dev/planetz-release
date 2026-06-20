import { AlertTriangle, FileCheck2, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { IntentRail } from '../spec-studio/intent-rail'
import { useSpecStudioChrome } from '../spec-studio/spec-studio-chrome'
import { Badge } from '../ui/badge'
import { createMockIntentRailModel, MOCK_INTENT_THREAD_ID } from './mock-intent-rail-preview'

const CALLOUTS = [
  {
    title: 'Locked operator intent',
    body: 'Scope, non-goals, and the reason for change are frozen before the run starts.',
    icon: ShieldCheck,
    tone: 'running' as const,
  },
  {
    title: 'Deviation surfaced immediately',
    body: 'Observed decisions that break the intent show up beside the run instead of after merge.',
    icon: AlertTriangle,
    tone: 'failed' as const,
  },
  {
    title: 'Ratified choices stay reusable',
    body: 'Good decisions get promoted into durable requirements and future task context.',
    icon: FileCheck2,
    tone: 'completed' as const,
  },
]

export function MockIntroIntentScenePreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  const c = useSpecStudioChrome()
  const rail = createMockIntentRailModel()

  return (
    <div className="min-h-screen bg-[var(--color-background)] px-8 py-8 text-[var(--color-text)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)]/65 shadow-[0_24px_80px_rgba(8,12,24,0.35)]">
        <header className="border-b border-[var(--color-border)]/80 px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                Spec studio
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text-strong)]">
                Intent ledger
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted-strong)]">
                Human intent is anchored before execution. The rail on the right shows which agent
                decisions satisfy that intent and which ones drift out of bounds.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Thread
              </p>
              <p className="mt-2 font-mono text-sm text-[var(--color-text-strong)]">
                {MOCK_INTENT_THREAD_ID}
              </p>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="grid content-start gap-5 md:grid-cols-3">
            {CALLOUTS.map(({ title, body, icon: Icon, tone }) => (
              <article
                key={title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon size={18} className="text-[var(--color-accent)]" />
                  <Badge tone={tone}>{title.split(' ')[0]}</Badge>
                </div>
                <h2 className="mt-4 text-base font-semibold text-[var(--color-text-strong)]">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted-strong)]">{body}</p>
              </article>
            ))}

            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-5 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Why it matters
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--color-text-strong)]">
                Autonomous work without silent scope drift
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted-strong)]">
                Agents can still move quickly, but operators keep the right to decide what counts as
                success. Ratified decisions become reusable context. Unanchored changes become
                visible, actionable drift instead of invisible re-interpretation.
              </p>
            </article>

            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Trace outcome
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[var(--color-status-completed)]/30 bg-[var(--color-status-completed-soft)]/20 p-3">
                  <p className="text-xs font-semibold text-[var(--color-text-strong)]">Ratified</p>
                  <p className="mt-1 text-sm text-[var(--color-muted-strong)]">
                    Store auth tokens in HttpOnly session cookies
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-status-failed)]/30 bg-[var(--color-status-failed-soft)]/20 p-3">
                  <p className="text-xs font-semibold text-[var(--color-text-strong)]">
                    Observed drift
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted-strong)]">
                    Refresh tokens were persisted in localStorage for silent renew.
                  </p>
                </div>
              </div>
            </article>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <IntentRail
              c={c}
              threadId={MOCK_INTENT_THREAD_ID}
              rail={rail}
              workbenchPhase="trace"
              highlightedEntryId={null}
              onOpenTask={() => {}}
              onHighlightEntry={() => {}}
              onOpenAllDecisions={() => {}}
            />
          </aside>
        </main>
      </div>
    </div>
  )
}
