import type {
  DecidedIntent,
  IntentDraft,
  IntentLedgerEntry,
  TaskSupplyTraceItem,
} from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'

export interface SaveIntentInput {
  what: string
  why: string
  outOfScope?: string[]
  reason?: string
}

function createDefaultIntentDraft(threadId: string, intent: DecidedIntent | null): IntentDraft {
  return {
    threadId,
    autoGenerate: intent === null,
    what: intent?.what ?? '',
    why: intent?.why ?? '',
    outOfScopeText: intent?.outOfScope.join(', ') ?? '',
    touchedByUser: false,
    basedOnIntentVersion: intent?.version ?? null,
  }
}

/**
 * Loads the Intent & Decision Rail data for a Spec Thread: the current Decided
 * Intent (+ version history) and the intent-ledger decisions across its tasks.
 * Exposes adjudication and intent-save actions that refresh on success.
 */
export function useSpecThreadRail(threadId: string | null) {
  const [intent, setIntent] = useState<DecidedIntent | null>(null)
  const [intentDraft, setIntentDraft] = useState<IntentDraft | null>(null)
  const [versions, setVersions] = useState<DecidedIntent[]>([])
  const [entries, setEntries] = useState<IntentLedgerEntry[]>([])
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [trace, setTrace] = useState<TaskSupplyTraceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [draftGenerating, setDraftGenerating] = useState(false)

  const refresh = useCallback(async () => {
    if (!threadId) {
      setIntent(null)
      setVersions([])
      setEntries([])
      setTaskIds([])
      setTrace([])
      setIntentDraft(null)
      return
    }
    const orbit = window.orbit
    if (!orbit) return
    setLoading(true)
    try {
      const [intentResult, versionsResult, ledgerResult, draftResult] = await Promise.all([
        orbit.getCurrentDecidedIntent?.({ threadId }) ?? Promise.resolve({ intent: null }),
        orbit.listDecidedIntentVersions?.({ threadId }) ?? Promise.resolve({ versions: [] }),
        orbit.listIntentLedgerByThread?.({ threadId }) ??
          Promise.resolve({ entries: [], taskIds: [] }),
        orbit.getIntentDraft?.({ threadId }) ?? Promise.resolve({ draft: null }),
      ])
      setIntent(intentResult.intent)
      setVersions(versionsResult.versions)
      setEntries(ledgerResult.entries)
      setTaskIds('taskIds' in ledgerResult ? ledgerResult.taskIds : [])
      setTrace('trace' in ledgerResult && ledgerResult.trace ? ledgerResult.trace : [])
      setIntentDraft(draftResult.draft ?? createDefaultIntentDraft(threadId, intentResult.intent))
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ratify = useCallback(
    async (entryId: string) => {
      await window.orbit?.ratifyIntentLedgerEntry?.({ entryId })
      await refresh()
    },
    [refresh],
  )

  const reverse = useCallback(
    async (entryId: string) => {
      await window.orbit?.reverseIntentLedgerEntry?.({ entryId })
      await refresh()
    },
    [refresh],
  )

  const adopt = useCallback(
    async (entryId: string) => {
      await window.orbit?.adoptIntentLedgerEntry?.({ entryId })
      await refresh()
    },
    [refresh],
  )

  const fix = useCallback(
    async (entryId: string) => {
      await window.orbit?.fixIntentLedgerEntry?.({ entryId })
      await refresh()
    },
    [refresh],
  )

  const saveIntent = useCallback(
    async (input: SaveIntentInput) => {
      if (!threadId) return
      await window.orbit?.saveDecidedIntent?.({ threadId, ...input })
      await window.orbit?.clearIntentDraft?.({ threadId })
      await refresh()
    },
    [threadId, refresh],
  )

  const saveIntentDraft = useCallback(async (draft: IntentDraft) => {
    setIntentDraft(draft)
    await window.orbit?.saveIntentDraft?.(draft)
  }, [])

  const generateIntentDraft = useCallback(
    async (input?: { sourceTurnId?: string }) => {
      if (!threadId) return null
      setDraftGenerating(true)
      try {
        const result =
          (await window.orbit?.generateIntentDraft?.({
            threadId,
            ...(input?.sourceTurnId ? { sourceTurnId: input.sourceTurnId } : {}),
          })) ?? null
        const nextDraft = result?.draft ?? intentDraft ?? createDefaultIntentDraft(threadId, intent)
        setIntentDraft(nextDraft)
        return nextDraft
      } catch {
        return null
      } finally {
        setDraftGenerating(false)
      }
    },
    [threadId, intent, intentDraft],
  )

  const clearIntentDraft = useCallback(async () => {
    if (!threadId) return
    await window.orbit?.clearIntentDraft?.({ threadId })
    setIntentDraft(createDefaultIntentDraft(threadId, intent))
  }, [threadId, intent])

  return {
    intent,
    intentDraft,
    versions,
    entries,
    taskIds,
    trace,
    loading,
    draftGenerating,
    refresh,
    ratify,
    reverse,
    adopt,
    fix,
    saveIntent,
    saveIntentDraft,
    generateIntentDraft,
    clearIntentDraft,
  }
}
