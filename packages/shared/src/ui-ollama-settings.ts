export const OLLAMA_TOOLS_GUARD_MODES = ['block', 'warn', 'off'] as const

export type OllamaToolsGuardMode = (typeof OLLAMA_TOOLS_GUARD_MODES)[number]

export const DEFAULT_OLLAMA_TOOLS_GUARD: OllamaToolsGuardMode = 'block'

export type UiOllamaSettings = {
  toolsGuard: OllamaToolsGuardMode
}

function parseToolsGuard(value: unknown): OllamaToolsGuardMode | undefined {
  if (value === 'block' || value === 'warn' || value === 'off') return value
  return undefined
}

/** Parse `ui.ollama` from persisted config (defaults tools guard to block). */
export function normalizeUiOllamaSettings(raw: unknown): UiOllamaSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { toolsGuard: DEFAULT_OLLAMA_TOOLS_GUARD }
  }
  const record = raw as Record<string, unknown>
  return {
    toolsGuard: parseToolsGuard(record.toolsGuard) ?? DEFAULT_OLLAMA_TOOLS_GUARD,
  }
}

export function ollamaToolsGuardFromUi(
  ui: { ollama?: UiOllamaSettings } | undefined | null,
): OllamaToolsGuardMode {
  return ui?.ollama?.toolsGuard ?? DEFAULT_OLLAMA_TOOLS_GUARD
}
