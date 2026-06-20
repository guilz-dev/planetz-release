import type { ChatThreadSummary } from '../components/chat/chat-types'

export function filterChatThreadsByTitle(
  threads: ChatThreadSummary[],
  query: string,
): ChatThreadSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return threads
  return threads.filter((thread) => thread.title.toLowerCase().includes(q))
}

/**
 * Merges canonical list threads with sidebar display rows (e.g. remote-only search hits)
 * for send guards and active-thread metadata without using the filtered sidebar list alone.
 */
export function mergeThreadsForSendLookup(
  allThreads: ChatThreadSummary[],
  displayThreads: ChatThreadSummary[],
): ChatThreadSummary[] {
  const byId = new Map(allThreads.map((thread) => [thread.id, thread]))
  for (const thread of displayThreads) {
    if (!byId.has(thread.id)) {
      byId.set(thread.id, thread)
    }
  }
  return [...byId.values()]
}

/** Remote hits first, then local title matches not already listed. */
export function mergeChatThreadSearchResults(
  remote: ChatThreadSummary[],
  localMatches: ChatThreadSummary[],
): ChatThreadSummary[] {
  const seen = new Set<string>()
  const merged: ChatThreadSummary[] = []
  for (const thread of [...remote, ...localMatches]) {
    if (seen.has(thread.id)) continue
    seen.add(thread.id)
    merged.push(thread)
  }
  return merged
}
