import { CHAT_TRANSCRIPT_NEAR_END_PX, CHAT_TRANSCRIPT_VIRTUALIZE_MIN_TURNS } from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type ListChildComponentProps, VariableSizeList } from 'react-window'
import { useI18n } from '../../i18n'
import type { ChatInFlightPresentation } from '../../lib/in-flight-chat-status'
import { ChatInFlightAssistantRow } from './chat-in-flight-assistant-row'
import { ChatMessageActions } from './chat-message-actions'
import { ChatTurnContent } from './chat-turn-content'
import type { ChatTurn } from './chat-types'

const DEFAULT_ROW_HEIGHT = 88

export function shouldVirtualizeChatTranscript(turnCount: number): boolean {
  return turnCount >= CHAT_TRANSCRIPT_VIRTUALIZE_MIN_TURNS
}

type RowData = {
  turns: ChatTurn[]
  inFlightAssistant: ChatInFlightPresentation | null
  youLabel: string
  latestAssistantTurnId: string | null
  addToTaskLabel?: string
  addToTaskAriaLabel?: string
  onAddToTaskTurn?: (turn: ChatTurn) => void
  setRowHeight: (index: number, size: number) => void
}

function MeasuredRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const { turns, youLabel, setRowHeight } = data

  useEffect(() => {
    const node = rowRef.current
    if (!node) return
    const measure = () => {
      const height = node.getBoundingClientRect().height
      if (height > 0) setRowHeight(index, height)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [index, setRowHeight])

  if (index === turns.length && data.inFlightAssistant) {
    const inFlight = data.inFlightAssistant
    return (
      <div ref={rowRef} style={style} className="px-4 py-2">
        <ChatInFlightAssistantRow
          streamingTurn={inFlight.streamingTurn}
          inFlightStatus={inFlight.status}
        />
      </div>
    )
  }

  if (index >= turns.length) {
    return <div ref={rowRef} style={style} className="px-4 py-2" />
  }

  const turn = turns[index]
  const showAddToTask = Boolean(
    turn &&
      turn.role === 'assistant' &&
      data.latestAssistantTurnId &&
      turn.id === data.latestAssistantTurnId &&
      data.onAddToTaskTurn &&
      data.addToTaskLabel,
  )
  return (
    <div ref={rowRef} style={style} className="px-4 py-2">
      <div className="group flex flex-col gap-1">
        <ChatTurnContent turn={turn} youLabel={youLabel} />
        <ChatMessageActions
          turn={turn}
          align={turn.role === 'user' ? 'end' : 'start'}
          showAddToTask={showAddToTask}
          addToTaskLabel={data.addToTaskLabel}
          addToTaskAriaLabel={data.addToTaskAriaLabel}
          onAddToTaskTurn={data.onAddToTaskTurn}
        />
      </div>
    </div>
  )
}

export function ChatTranscriptVirtual({
  turns,
  inFlightAssistant = null,
  latestAssistantTurnId,
  addToTaskLabel,
  addToTaskAriaLabel,
  onAddToTaskTurn,
}: {
  turns: ChatTurn[]
  inFlightAssistant?: ChatInFlightPresentation | null
  latestAssistantTurnId: string | null
  addToTaskLabel?: string
  addToTaskAriaLabel?: string
  onAddToTaskTurn?: (turn: ChatTurn) => void
}) {
  const { t } = useI18n()
  const listRef = useRef<VariableSizeList<RowData>>(null)
  const outerRef = useRef<HTMLDivElement | null>(null)
  const rowHeights = useRef<Map<number, number>>(new Map())
  const stickToEndRef = useRef(true)
  const hadInFlightAssistantRef = useRef(false)
  const [listHeight, setListHeight] = useState(400)
  const itemCount = turns.length + (inFlightAssistant ? 1 : 0)

  const setRowHeight = useCallback((index: number, size: number) => {
    if (rowHeights.current.get(index) === size) return
    rowHeights.current.set(index, size)
    listRef.current?.resetAfterIndex(index)
  }, [])

  const getItemSize = useCallback(
    (index: number) => rowHeights.current.get(index) ?? DEFAULT_ROW_HEIGHT,
    [],
  )

  const youLabel = t('chat.you')
  const itemData = useMemo<RowData>(
    () => ({
      turns,
      inFlightAssistant: inFlightAssistant ?? null,
      youLabel,
      latestAssistantTurnId,
      addToTaskLabel,
      addToTaskAriaLabel,
      onAddToTaskTurn,
      setRowHeight,
    }),
    [
      turns,
      inFlightAssistant,
      youLabel,
      latestAssistantTurnId,
      addToTaskLabel,
      addToTaskAriaLabel,
      onAddToTaskTurn,
      setRowHeight,
    ],
  )

  const totalListHeight = useCallback(() => {
    let sum = 0
    for (let index = 0; index < itemCount; index += 1) {
      sum += getItemSize(index)
    }
    return sum
  }, [itemCount, getItemSize])

  useEffect(() => {
    const element = outerRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setListHeight(entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const inFlightStarted = Boolean(inFlightAssistant) && !hadInFlightAssistantRef.current
    hadInFlightAssistantRef.current = Boolean(inFlightAssistant)

    if (inFlightStarted) {
      stickToEndRef.current = true
    }

    if (stickToEndRef.current || inFlightStarted) {
      listRef.current?.scrollToItem(Math.max(0, itemCount - 1), 'end')
    }
  }, [itemCount, inFlightAssistant])

  useEffect(() => {
    if (!inFlightAssistant) return
    listRef.current?.resetAfterIndex(turns.length)
  }, [
    inFlightAssistant?.streamingTurn?.text,
    inFlightAssistant?.streamingTurn?.activities.length,
    turns.length,
    inFlightAssistant,
    inFlightAssistant?.status,
  ])

  const handleScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      const total = totalListHeight()
      stickToEndRef.current = scrollOffset + listHeight >= total - CHAT_TRANSCRIPT_NEAR_END_PX
    },
    [listHeight, totalListHeight],
  )

  return (
    <div ref={outerRef} className="h-full min-h-0 w-full">
      <VariableSizeList<RowData>
        ref={listRef}
        height={listHeight}
        width="100%"
        itemCount={itemCount}
        itemSize={getItemSize}
        itemData={itemData}
        overscanCount={6}
        onScroll={handleScroll}
      >
        {MeasuredRow}
      </VariableSizeList>
    </div>
  )
}
