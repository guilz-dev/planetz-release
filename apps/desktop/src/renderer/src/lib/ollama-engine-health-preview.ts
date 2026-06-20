import { type EngineConfig, readOllamaBaseUrl } from '@planetz/shared'

/** True when unsaved engine form state can change Ollama health probe targets. */
export function engineConfigDiffersForOllamaHealth(
  preview: EngineConfig,
  saved: EngineConfig,
): boolean {
  if (readOllamaBaseUrl(preview) !== readOllamaBaseUrl(saved)) return true
  const previewProvider = preview.provider?.trim() ?? ''
  const savedProvider = saved.provider?.trim() ?? ''
  return previewProvider !== savedProvider
}
