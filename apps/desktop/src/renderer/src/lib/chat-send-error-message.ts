import { toErrorMessage } from './to-error-message.js'

const REMOTE_METHOD_PREFIX = /^Error invoking remote method '[^']+':\s*/i
const ORBIT_INTERACTIVE_PREFIX = /^OrbitInteractiveClientError:\s*/i
const OLLAMA_CHAT_UNSUPPORTED_RE = /"([^"]+)"\s+does not support chat/i

/**
 * Turns low-level IPC/provider errors into concise Chat composer send errors.
 */
export function chatSendErrorMessage(error: unknown): string {
  const base = toErrorMessage(error, 'Send failed')
  const normalized = base
    .replace(REMOTE_METHOD_PREFIX, '')
    .replace(ORBIT_INTERACTIVE_PREFIX, '')
    .trim()

  const ollamaUnsupported = normalized.match(OLLAMA_CHAT_UNSUPPORTED_RE)
  if (ollamaUnsupported?.[1]) {
    return `${ollamaUnsupported[1]} does not support chat in Ollama. Choose a chat-capable model and retry.`
  }

  return normalized || 'Send failed'
}
