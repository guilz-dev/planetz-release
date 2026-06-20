import type { OrbitInteractiveStreamLine } from '@planetz/shared'
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react'
import { applyComposerStreamLine, type ChatStreamingTurn } from '../lib/chat-stream-types'

export type UseComposerStreamSubscriptionResult = {
  streamingTurn: ChatStreamingTurn | null
  streamEpochRef: MutableRefObject<number>
  streamSessionIdRef: MutableRefObject<string | null>
  clearStreamingTurn: () => void
  /** Call when a send starts (after composer session id is known). */
  beginStreamForSend: (
    generation: number,
    composerSessionId: string,
    options?: { seedThinkingPlaceholder?: boolean; allowSessionRebind?: boolean },
  ) => void
}

function hasStreamingPayload(turn: ChatStreamingTurn | null): boolean {
  if (!turn) return false
  if (turn.text.trim().length > 0) return true
  return turn.activities.some((activity) => {
    if (activity.kind !== 'thinking') return true
    return activity.text.trim().length > 0
  })
}

/**
 * Subscribes to `composerSession:stream` and maintains in-flight assistant partial UI.
 * Send lifecycle (generation bump on cancel) stays in `use-chat-thread-send`.
 */
export function useComposerStreamSubscription(
  sendGenerationRef: MutableRefObject<number>,
): UseComposerStreamSubscriptionResult {
  const [streamingTurn, setStreamingTurn] = useState<ChatStreamingTurn | null>(null)
  const streamEpochRef = useRef(0)
  const streamSessionIdRef = useRef<string | null>(null)
  const streamRafRef = useRef<number | null>(null)
  const streamingTurnRef = useRef<ChatStreamingTurn | null>(null)
  const allowSessionRebindRef = useRef(false)

  useEffect(() => {
    streamingTurnRef.current = streamingTurn
  }, [streamingTurn])

  const clearStreamingTurn = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
    }
    streamingTurnRef.current = null
    streamSessionIdRef.current = null
    allowSessionRebindRef.current = false
    setStreamingTurn(null)
  }, [])

  const flushPendingStreamingTurn = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
    }
    const turn = streamingTurnRef.current
    if (turn) setStreamingTurn(turn)
  }, [])

  const beginStreamForSend = useCallback(
    (
      generation: number,
      composerSessionId: string,
      options?: { seedThinkingPlaceholder?: boolean; allowSessionRebind?: boolean },
    ) => {
      streamEpochRef.current = generation
      streamSessionIdRef.current = composerSessionId
      allowSessionRebindRef.current = Boolean(options?.allowSessionRebind)

      const seeded: ChatStreamingTurn = {
        id: `stream_${generation}`,
        role: 'assistant',
        text: '',
        activities: options?.seedThinkingPlaceholder ? [{ kind: 'thinking', text: '' }] : [],
      }
      streamingTurnRef.current = seeded
      setStreamingTurn(seeded)
    },
    [],
  )

  useEffect(() => {
    const subscribe = window.orbit?.onComposerSessionStream
    if (typeof subscribe !== 'function') {
      if (import.meta.env.DEV) {
        console.warn(
          '[planetz] onComposerSessionStream is missing on window.orbit; chat streaming is disabled. Fully restart Electron (stop make dev, then start again).',
        )
      }
      return
    }

    let droppedSessionMismatch = 0

    const unsubscribe = subscribe((line: OrbitInteractiveStreamLine) => {
      if (sendGenerationRef.current !== streamEpochRef.current) return
      const expectedSessionId = streamSessionIdRef.current
      if (!expectedSessionId) return

      if (line.sessionId !== expectedSessionId) {
        if (allowSessionRebindRef.current && !hasStreamingPayload(streamingTurnRef.current)) {
          streamSessionIdRef.current = line.sessionId
          allowSessionRebindRef.current = false
        } else {
          if (import.meta.env.DEV && expectedSessionId) {
            droppedSessionMismatch += 1
          }
          return
        }
      }

      const sessionId = streamSessionIdRef.current
      if (!sessionId || line.sessionId !== sessionId) {
        if (import.meta.env.DEV && sessionId && line.sessionId !== sessionId) {
          droppedSessionMismatch += 1
        }
        return
      }

      if (line.done) {
        flushPendingStreamingTurn()
        if (line.aborted) {
          clearStreamingTurn()
        }
        return
      }

      const base =
        streamingTurnRef.current ??
        ({
          id: `stream_${streamEpochRef.current}`,
          role: 'assistant',
          text: '',
          activities: [],
        } satisfies ChatStreamingTurn)

      const next = applyComposerStreamLine(base, line)
      streamingTurnRef.current = next

      if (streamRafRef.current !== null) return
      streamRafRef.current = requestAnimationFrame(() => {
        streamRafRef.current = null
        const turn = streamingTurnRef.current
        if (turn) setStreamingTurn(turn)
      })
    })

    return () => {
      if (import.meta.env.DEV && droppedSessionMismatch > 0) {
        console.warn(
          `[planetz] Ignored ${droppedSessionMismatch} composer stream line(s) due to sessionId mismatch.`,
        )
      }
      unsubscribe()
    }
  }, [clearStreamingTurn, flushPendingStreamingTurn, sendGenerationRef])

  return {
    streamingTurn,
    streamEpochRef,
    streamSessionIdRef,
    clearStreamingTurn,
    beginStreamForSend,
  }
}
