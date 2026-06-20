/** Providers that can surface partial assistant output during chat sends. */
export function supportsLiveComposerStream(provider: string): boolean {
  const normalized = provider.trim().toLowerCase()
  if (!normalized) return true

  // Mock provider replies appear only after the in-memory gateway resolves.
  if (normalized === 'mock') return false

  return true
}
