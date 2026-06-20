/** Prefer workflow abort `reason`, then `message`, when both may be present on JSONL rows. */
export function firstNonEmptyAbortMessage(
  reason: string | undefined,
  message: string | undefined,
): string | undefined {
  const trimmedReason = reason?.trim()
  if (trimmedReason && trimmedReason.length > 0) return trimmedReason
  const trimmedMessage = message?.trim()
  if (trimmedMessage && trimmedMessage.length > 0) return trimmedMessage
  return undefined
}
