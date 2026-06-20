import {
  classifyOllamaError,
  type EngineConfig,
  isOllamaLoopbackOrigin,
  OLLAMA_DELETE_FETCH_TIMEOUT_MS,
  OLLAMA_PULL_FETCH_TIMEOUT_MS,
  resolveOllamaFetchOrigin,
} from '@planetz/shared'
import { invalidateOllamaLiveModelsCache } from './ollama-model-discovery.js'

export class OllamaAdminRemoteDeleteError extends Error {
  constructor() {
    super('Delete is only allowed when Ollama base URL points to localhost.')
    this.name = 'OllamaAdminRemoteDeleteError'
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const detail = (await response.text()).trim()
  return detail || `Ollama request failed with status ${response.status}`
}

export async function pullOllamaModel(input: {
  model: string
  engineConfig?: EngineConfig | null
}): Promise<{ ok: true }> {
  const name = input.model.trim()
  if (name.length === 0) throw new Error('Model name is required')
  const origin = resolveOllamaFetchOrigin(input.engineConfig)
  const response = await fetch(`${origin}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
    signal: AbortSignal.timeout(OLLAMA_PULL_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response)
    const { code } = classifyOllamaError({ message, status: response.status })
    throw new Error(`${message} (${code})`)
  }
  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
  }
  invalidateOllamaLiveModelsCache()
  return { ok: true }
}

export async function deleteOllamaModel(input: {
  model: string
  engineConfig?: EngineConfig | null
}): Promise<{ ok: true }> {
  const name = input.model.trim()
  if (name.length === 0) throw new Error('Model name is required')
  const origin = resolveOllamaFetchOrigin(input.engineConfig)
  if (!isOllamaLoopbackOrigin(origin)) {
    throw new OllamaAdminRemoteDeleteError()
  }
  const response = await fetch(`${origin}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(OLLAMA_DELETE_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response)
    const { code } = classifyOllamaError({ message, status: response.status })
    throw new Error(`${message} (${code})`)
  }
  invalidateOllamaLiveModelsCache()
  return { ok: true }
}
