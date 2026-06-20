/** Detect Apple desktop/mobile platforms for keyboard shortcut hints. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false

  const platformHint = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform
  if (platformHint) {
    return /macOS|iOS/i.test(platformHint)
  }

  const userAgent = navigator.userAgent
  if (/Mac|iPhone|iPad|iPod/.test(userAgent)) return true

  const legacyPlatform = navigator.platform
  return legacyPlatform ? /Mac|iPhone|iPad|iPod/.test(legacyPlatform) : false
}
