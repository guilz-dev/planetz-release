/** True when an orbit/composer IPC error looks like a timeout. */
export function isConversationSessionTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.toLowerCase().includes('timed out') || error.message.includes('timeout')
}
