/**
 * Heuristics for classifying GitHub CLI failure output.
 * Callers should pass stderr and stdout joined and lowercased.
 */
export function ghCliOutputLooksLikeAuthRequired(combinedLowerCase: string): boolean {
  if (combinedLowerCase.includes('unknown flag')) return false
  return (
    combinedLowerCase.includes('not logged in') ||
    combinedLowerCase.includes('not logged into') ||
    combinedLowerCase.includes('authentication required') ||
    combinedLowerCase.includes('failed to authenticate') ||
    combinedLowerCase.includes('to authenticate') ||
    combinedLowerCase.includes('gh auth login') ||
    combinedLowerCase.includes('run gh auth') ||
    combinedLowerCase.includes('bad credentials') ||
    combinedLowerCase.includes('http 401')
  )
}

export function ghCliOutputLooksLikePermissionDenied(combinedLowerCase: string): boolean {
  return (
    combinedLowerCase.includes('permission') ||
    combinedLowerCase.includes('403') ||
    combinedLowerCase.includes('forbidden')
  )
}
