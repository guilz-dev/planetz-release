/**
 * Branch-name rules aligned with `git check-ref-format --branch` (short ref component).
 * @see https://git-scm.com/docs/git-check-ref-format
 */
export function isValidGitBranchName(branch: string): boolean {
  const name = branch.trim()
  if (name.length === 0 || name.length > 255) return false
  if (name.startsWith('/') || name.endsWith('/') || name.endsWith('.')) return false
  if (name.endsWith('.lock')) return false
  if (name.startsWith('.') || name.startsWith('-')) return false
  if (name.includes('..') || name.includes('@{') || name.includes('//')) return false
  if (hasForbiddenGitBranchChars(name)) return false
  return true
}

function hasForbiddenGitBranchChars(name: string): boolean {
  for (const ch of name) {
    const code = ch.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f) return true
    if (' \t\n\r~^:?*#\\%'.includes(ch)) return true
  }
  return false
}
