/** Normalized Ollama client failure codes for UI recovery hints. */
export const OLLAMA_ERROR_CODES = [
  'connection_refused',
  'timeout',
  'http_error',
  'model_not_found',
  'unknown',
] as const

export type OllamaErrorCode = (typeof OLLAMA_ERROR_CODES)[number]

export type OllamaErrorRecoveryKey =
  | 'check_daemon'
  | 'check_url'
  | 'pull_model'
  | 'retry'
  | 'generic'

export interface ClassifiedOllamaError {
  code: OllamaErrorCode
  recoveryKey: OllamaErrorRecoveryKey
}

function messageLooksLikeConnectionRefused(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('econnrefused') ||
    lower.includes('connection refused') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch')
  )
}

function messageLooksLikeTimeout(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')
}

function messageLooksLikeModelNotFound(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('model') && (lower.includes('not found') || lower.includes('missing'))
}

/** Map fetch/status/cause into a stable code + recovery hint key for i18n. */
export function classifyOllamaError(input: {
  message?: string
  status?: number
  cause?: unknown
}): ClassifiedOllamaError {
  const parts: string[] = []
  if (input.message?.trim()) parts.push(input.message.trim())
  if (input.cause instanceof Error && input.cause.message.trim()) {
    parts.push(input.cause.message.trim())
  }
  const combined = parts.join(' ')

  if (input.status === 404 && messageLooksLikeModelNotFound(combined)) {
    return { code: 'model_not_found', recoveryKey: 'pull_model' }
  }
  if (input.status !== undefined && input.status >= 400) {
    return { code: 'http_error', recoveryKey: input.status === 404 ? 'pull_model' : 'check_url' }
  }
  if (messageLooksLikeConnectionRefused(combined)) {
    return { code: 'connection_refused', recoveryKey: 'check_daemon' }
  }
  if (messageLooksLikeTimeout(combined)) {
    return { code: 'timeout', recoveryKey: 'retry' }
  }
  if (messageLooksLikeModelNotFound(combined)) {
    return { code: 'model_not_found', recoveryKey: 'pull_model' }
  }
  return { code: 'unknown', recoveryKey: 'generic' }
}
