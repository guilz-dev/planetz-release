import type { DecidedIntent, IntentLedgerEntry, TaskSupplyTraceItem } from '@planetz/shared'
import { useEffect } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { IntentRail } from '../spec-studio/intent-rail'
import { useSpecStudioChrome } from '../spec-studio/spec-studio-chrome'

export const MOCK_INTENT_THREAD_ID = 'thread-auth-spec'

export const MOCK_INTENT: DecidedIntent = {
  id: `${MOCK_INTENT_THREAD_ID}#v2`,
  threadId: MOCK_INTENT_THREAD_ID,
  version: 2,
  what: 'Implement OAuth2 login with session cookies only',
  why: 'Replace the password flow without exposing long-lived tokens in the browser',
  outOfScope: ['Social login', 'Magic links', 'Client-side refresh tokens'],
  reason: 'Tighten token storage after security review',
  createdAt: '2026-06-01T12:00:00.000Z',
}

export const MOCK_ENTRIES: IntentLedgerEntry[] = [
  {
    id: 'entry-ratified-cookies',
    taskId: 'task-auth-core',
    sourceRun: 'run-3',
    decisionId: 'use-session-cookies',
    statement: 'Store auth tokens in HttpOnly session cookies',
    authority: 'ratified',
    scopeHint: 'auth/session',
    sourceDoc: 'decisions.json',
    sourceRunDoc: 'run-3/decisions.json',
    createdAt: '2026-06-10T09:00:00.000Z',
    ratifiedAt: '2026-06-10T09:30:00.000Z',
    reversibility: 'cheap',
    satisfies: ['session cookies only', 'no localStorage tokens'],
    deviates: null,
    unanchored: false,
    scopeConflict: false,
    adjudicationKind: null,
    adjudicationReason: null,
    promotedReqId: 'REQ-AUTH-12',
  },
  {
    id: 'entry-drift-localstorage',
    taskId: 'task-auth-core',
    sourceRun: 'run-4',
    decisionId: 'refresh-localstorage',
    statement: 'Persist refresh token in localStorage for silent renew',
    authority: 'observed',
    scopeHint: 'auth/session',
    sourceDoc: 'observations.json',
    sourceRunDoc: 'run-4/observations.json',
    createdAt: '2026-06-12T14:00:00.000Z',
    ratifiedAt: null,
    reversibility: 'expensive',
    satisfies: null,
    deviates: ['session cookies only', 'no localStorage tokens'],
    unanchored: true,
    scopeConflict: false,
    adjudicationKind: null,
    adjudicationReason: null,
    promotedReqId: null,
  },
  {
    id: 'entry-assumed-middleware',
    taskId: 'task-auth-core',
    sourceRun: 'run-4',
    decisionId: 'csrf-middleware',
    statement: 'Add CSRF middleware on all auth routes',
    authority: 'assumed',
    scopeHint: 'auth/session',
    sourceDoc: null,
    sourceRunDoc: null,
    createdAt: '2026-06-12T14:05:00.000Z',
    ratifiedAt: null,
    reversibility: 'cheap',
    satisfies: ['session cookies only'],
    deviates: null,
    unanchored: false,
    scopeConflict: false,
    adjudicationKind: null,
    adjudicationReason: null,
    promotedReqId: null,
  },
]

export const MOCK_TRACE: TaskSupplyTraceItem[] = [
  {
    taskId: 'task-auth-core',
    snapshot: {
      entryIds: ['entry-ratified-cookies', 'entry-drift-localstorage'],
      capturedAt: '2026-06-12T14:10:00.000Z',
      matchBasis: 'scope_hint_recompute',
    },
    suppliedEntries: MOCK_ENTRIES.filter((entry) =>
      ['entry-ratified-cookies', 'entry-drift-localstorage'].includes(entry.id),
    ),
  },
]

const noopAsync = async () => {}

export function createMockIntentRailModel() {
  return {
    intent: MOCK_INTENT,
    intentDraft: null,
    versions: [MOCK_INTENT],
    entries: MOCK_ENTRIES,
    taskIds: ['task-auth-core'],
    trace: MOCK_TRACE,
    loading: false,
    draftGenerating: false,
    refresh: noopAsync,
    ratify: noopAsync,
    reverse: noopAsync,
    adopt: noopAsync,
    fix: noopAsync,
    saveIntent: noopAsync,
    saveIntentDraft: noopAsync,
    generateIntentDraft: async () => null,
    clearIntentDraft: noopAsync,
  }
}

export function MockIntentRailPreview() {
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])

  const c = useSpecStudioChrome()
  const rail = createMockIntentRailModel()

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <div className="flex min-h-screen justify-end">
        <div className="flex w-[min(100%,22rem)] min-h-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
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
        </div>
      </div>
    </div>
  )
}
