export interface ParsedCopilotModel {
  id: string
  label?: string
}

export interface CopilotListModelWireEntry {
  id?: unknown
  name?: unknown
  policy?: { state?: unknown } | null
  model_picker_enabled?: unknown
  modelPickerEnabled?: unknown
}

function isCopilotModelId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value)
}

function isPickerEnabled(entry: CopilotListModelWireEntry): boolean {
  const snake = entry.model_picker_enabled
  if (snake === false) return false
  const camel = entry.modelPickerEnabled
  if (camel === false) return false
  return true
}

function isPolicyDisabled(entry: CopilotListModelWireEntry): boolean {
  const state = entry.policy?.state
  return typeof state === 'string' && state.trim().toLowerCase() === 'disabled'
}

/** Normalize and filter Copilot CLI `models.list` entries for UI candidates. */
export function filterCopilotListModels(
  entries: readonly CopilotListModelWireEntry[],
): ParsedCopilotModel[] {
  const seen = new Set<string>()
  const results: ParsedCopilotModel[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    if (isPolicyDisabled(entry)) continue
    if (!isPickerEnabled(entry)) continue

    const rawId = entry.id
    if (typeof rawId !== 'string') continue
    const id = rawId.trim()
    if (!id || !isCopilotModelId(id) || seen.has(id)) continue
    seen.add(id)

    const rawName = entry.name
    const label = typeof rawName === 'string' ? rawName.trim() : ''
    results.push(label ? { id, label } : { id })
  }

  return results
}
