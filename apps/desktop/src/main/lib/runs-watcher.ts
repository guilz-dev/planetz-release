import { type FSWatcher, watch } from 'node:fs'
import { join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { STATE_BROADCAST_THROTTLE_MS } from '@planetz/shared'
import { isolatedTaktWorktreesRoot } from '../planetz/isolated-workspace-paths.js'

interface RunsWatcherOptions {
  watchTasksYaml?: boolean
  additionalRoots?: readonly string[]
  fallbackPollMs?: number
  shouldFallbackPoll?: () => boolean
}

/** Parent worktree dir plus per-task `.takt/runs` paths from tasks.yaml. */
export function resolveRunsWatcherAdditionalRoots(
  isolatedRepoPath: string,
  additionalRunRoots: readonly string[],
): string[] {
  const defaultWorktreeRoot = isolatedTaktWorktreesRoot(isolatedRepoPath)
  return Array.from(new Set([defaultWorktreeRoot, ...additionalRunRoots]))
}

export function startRunsWatcher(
  workspacePath: string,
  config: UiConfig,
  onChange: () => void,
  options?: RunsWatcherOptions,
): () => void {
  const runsRoot = join(workspacePath, config.runsDir)
  const tasksYamlPath = join(workspacePath, config.tasksYamlPath)
  const roots = new Set<string>([runsRoot, ...(options?.additionalRoots ?? [])])
  let timer: ReturnType<typeof setTimeout> | null = null
  let fallbackPollTimer: ReturnType<typeof setInterval> | null = null
  const watchers: FSWatcher[] = []

  const schedule = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, STATE_BROADCAST_THROTTLE_MS)
  }

  for (const root of roots) {
    try {
      watchers.push(watch(root, { recursive: true }, schedule))
    } catch {
      // missing directory is expected before first run
    }
  }
  if (options?.watchTasksYaml) {
    try {
      watchers.push(watch(tasksYamlPath, schedule))
    } catch {
      // tasks.yaml may not exist yet during initial bootstrap
    }
  }
  const shouldFallbackPoll = options?.shouldFallbackPoll ?? (() => true)
  if (options?.fallbackPollMs && options.fallbackPollMs > 0) {
    fallbackPollTimer = setInterval(() => {
      if (!shouldFallbackPoll()) return
      schedule()
    }, options.fallbackPollMs)
  }
  if (watchers.length === 0) {
    return () => {
      if (timer) clearTimeout(timer)
      if (fallbackPollTimer) clearInterval(fallbackPollTimer)
    }
  }

  return () => {
    if (timer) clearTimeout(timer)
    if (fallbackPollTimer) clearInterval(fallbackPollTimer)
    for (const watcher of watchers) watcher.close()
  }
}
