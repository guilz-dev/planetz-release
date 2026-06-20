/** Max entries kept in the Add Task workflow Recent group. */
import { MAX_RECENT_WORKFLOWS } from '@planetz/shared'

export { MAX_RECENT_WORKFLOWS }

/** Parse and normalize workflow names from localStorage JSON (trim, dedupe, cap). */
export function parseStoredRecentWorkflowNames(
  parsed: unknown,
  max: number = MAX_RECENT_WORKFLOWS,
): string[] {
  if (!Array.isArray(parsed) || max < 1) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of parsed) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

/** Move `name` to the front of `current`, dedupe, and cap at `max`. */
export function pushRecentWorkflowNames(current: string[], name: string, max: number): string[] {
  const trimmed = name.trim()
  if (!trimmed || max < 1) return current
  const without = current.filter((entry) => entry !== trimmed)
  return [trimmed, ...without].slice(0, max)
}
