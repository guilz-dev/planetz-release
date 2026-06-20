import {
  CHAT_HISTORY_REMOTE_SEARCH_MIN_CHARS,
  CHAT_HISTORY_SEARCH_DEBOUNCE_MS,
} from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatGateway, ChatThreadSummary } from '../components/chat/chat-types'
import { filterChatThreadsByTitle, mergeChatThreadSearchResults } from '../lib/chat-thread-search'

export type UseChatThreadQueryOptions = {
  gateway: ChatGateway
  workspacePath?: string
}

export function useChatThreadQuery({ gateway, workspacePath }: UseChatThreadQueryOptions) {
  const [allThreads, setAllThreads] = useState<ChatThreadSummary[]>([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [remoteSearchThreads, setRemoteSearchThreads] = useState<ChatThreadSummary[] | null>(null)
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false)
  const searchRequestRef = useRef(0)

  const refreshThreads = useCallback(async () => {
    setThreadsLoading(true)
    try {
      const list = await gateway.listThreads()
      setAllThreads(list)
    } finally {
      setThreadsLoading(false)
    }
  }, [gateway])

  useEffect(() => {
    void refreshThreads()
  }, [refreshThreads])

  useEffect(() => {
    const query = search.trim()
    if (query.length < CHAT_HISTORY_REMOTE_SEARCH_MIN_CHARS || !gateway.searchThreads) {
      searchRequestRef.current += 1
      setRemoteSearchThreads(null)
      setRemoteSearchLoading(false)
      return
    }

    const requestId = ++searchRequestRef.current
    setRemoteSearchThreads(null)
    setRemoteSearchLoading(true)

    const handle = window.setTimeout(() => {
      void gateway
        .searchThreads?.({
          query,
          ...(workspacePath ? { workspacePath } : {}),
        })
        .then((results) => {
          if (searchRequestRef.current !== requestId) return
          setRemoteSearchThreads(results)
        })
        .catch(() => {
          if (searchRequestRef.current !== requestId) return
          setRemoteSearchThreads(null)
        })
        .finally(() => {
          if (searchRequestRef.current !== requestId) return
          setRemoteSearchLoading(false)
        })
    }, CHAT_HISTORY_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(handle)
    }
  }, [search, gateway, workspacePath])

  const displayThreads = useMemo(() => {
    const query = search.trim()
    const localMatches = filterChatThreadsByTitle(allThreads, query)
    if (remoteSearchThreads === null) return localMatches
    return mergeChatThreadSearchResults(remoteSearchThreads, localMatches)
  }, [allThreads, search, remoteSearchThreads])

  return {
    allThreads,
    threads: displayThreads,
    threadsLoading: threadsLoading || remoteSearchLoading,
    search,
    setSearch,
    refreshThreads,
  }
}
