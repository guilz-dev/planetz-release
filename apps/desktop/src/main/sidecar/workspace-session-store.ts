import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  normalizeUiPreferences,
  type RecentWorkspace,
  type UiPreferences,
} from '@planetz/shared'
import { app } from 'electron'

const MAX_RECENT_WORKSPACES = 10
const SESSION_FILE = 'workspace-session.json'

type GlobalUiPreferences = Pick<UiPreferences, 'theme' | 'counterPackEnabled' | 'language'>

interface WorkspaceSessionState {
  lastOpenedWorkspacePath?: string
  recentWorkspaces: RecentWorkspace[]
  globalUiPreferences?: GlobalUiPreferences
}

const EMPTY_STATE: WorkspaceSessionState = { recentWorkspaces: [] }
const DEFAULT_GLOBAL_UI_PREFERENCES: GlobalUiPreferences = {
  theme: DEFAULT_CONFIG.ui.theme,
  counterPackEnabled: DEFAULT_CONFIG.ui.counterPackEnabled,
  language: DEFAULT_CONFIG.ui.language,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeGlobalUiPreferences(raw: unknown): GlobalUiPreferences | null {
  if (!isRecord(raw)) return null
  const normalized = normalizeUiPreferences(raw)
  return {
    theme: normalized.theme,
    counterPackEnabled: normalized.counterPackEnabled,
    language: normalized.language,
  }
}

function normalizeRecent(list: RecentWorkspace[]): RecentWorkspace[] {
  const seen = new Set<string>()
  const out: RecentWorkspace[] = []
  for (const item of list) {
    const path = item.path.trim()
    if (path.length === 0 || seen.has(path)) continue
    seen.add(path)
    out.push({ path, lastOpenedAt: item.lastOpenedAt })
    if (out.length >= MAX_RECENT_WORKSPACES) break
  }
  return out
}

export class WorkspaceSessionStore {
  private filePath(): string {
    return join(app.getPath('userData'), SESSION_FILE)
  }

  private async load(): Promise<WorkspaceSessionState> {
    try {
      const raw = await readFile(this.filePath(), 'utf8')
      const parsed = JSON.parse(raw) as Partial<WorkspaceSessionState>
      return {
        lastOpenedWorkspacePath: parsed.lastOpenedWorkspacePath,
        recentWorkspaces: normalizeRecent(
          Array.isArray(parsed.recentWorkspaces) ? parsed.recentWorkspaces : [],
        ),
        globalUiPreferences: normalizeGlobalUiPreferences(parsed.globalUiPreferences) ?? undefined,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[planetz][sidecar] Failed to parse workspace session JSON', {
        path: this.filePath(),
        error: message,
      })
      return { ...EMPTY_STATE }
    }
  }

  private async save(state: WorkspaceSessionState): Promise<void> {
    const next: WorkspaceSessionState = {
      lastOpenedWorkspacePath: state.lastOpenedWorkspacePath,
      recentWorkspaces: normalizeRecent(state.recentWorkspaces),
      globalUiPreferences: state.globalUiPreferences,
    }
    await writeFile(this.filePath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  }

  async markOpened(path: string): Promise<void> {
    const trimmed = path.trim()
    if (trimmed.length === 0) return
    const current = await this.load()
    const now = new Date().toISOString()
    const nextRecent = [
      { path: trimmed, lastOpenedAt: now },
      ...current.recentWorkspaces.filter((w) => w.path !== trimmed),
    ]
    await this.save({
      lastOpenedWorkspacePath: trimmed,
      recentWorkspaces: nextRecent,
    })
  }

  async listRecent(): Promise<RecentWorkspace[]> {
    const current = await this.load()
    return current.recentWorkspaces
  }

  async getLastOpenedPath(): Promise<string | null> {
    const current = await this.load()
    const path = current.lastOpenedWorkspacePath?.trim()
    return path ? path : null
  }

  async remove(path: string): Promise<RecentWorkspace[]> {
    const current = await this.load()
    const next = current.recentWorkspaces.filter((w) => w.path !== path)
    const last =
      current.lastOpenedWorkspacePath === path ? undefined : current.lastOpenedWorkspacePath
    await this.save({ lastOpenedWorkspacePath: last, recentWorkspaces: next })
    return next
  }

  async clearLastOpened(path?: string): Promise<void> {
    const current = await this.load()
    if (path && current.lastOpenedWorkspacePath !== path) return
    await this.save({ ...current, lastOpenedWorkspacePath: undefined })
  }

  async pathExists(path: string): Promise<boolean> {
    try {
      const entry = await stat(path)
      return entry.isDirectory()
    } catch {
      return false
    }
  }

  async getGlobalUiPreferences(): Promise<GlobalUiPreferences | null> {
    const current = await this.load()
    return current.globalUiPreferences ?? null
  }

  async initializeGlobalUiPreferences(initial: GlobalUiPreferences): Promise<GlobalUiPreferences> {
    const current = await this.load()
    if (current.globalUiPreferences) return current.globalUiPreferences
    const normalized = normalizeGlobalUiPreferences(initial) ?? DEFAULT_GLOBAL_UI_PREFERENCES
    await this.save({ ...current, globalUiPreferences: normalized })
    return normalized
  }

  async setGlobalUiPreferences(patch: Partial<GlobalUiPreferences>): Promise<GlobalUiPreferences> {
    const current = await this.load()
    const base = current.globalUiPreferences ?? DEFAULT_GLOBAL_UI_PREFERENCES
    // Drop undefined keys so a partial patch (e.g. toggling manta mode alone)
    // doesn't clobber unrelated prefs like `theme` back to the default.
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<GlobalUiPreferences>
    const merged = normalizeGlobalUiPreferences({ ...base, ...definedPatch }) ?? base
    await this.save({ ...current, globalUiPreferences: merged })
    return merged
  }
}
