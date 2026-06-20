import type { GitHubIssueRepository } from '@planetz/shared'
import { execa } from 'execa'

/** Parses GitHub HTTPS/SSH remote URLs into owner/repo. */
export function parseGitHubRemoteUrl(url: string): GitHubIssueRepository | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
  if (sshMatch) {
    const owner = sshMatch[1]?.trim()
    const name = sshMatch[2]?.trim()
    if (owner && name) return { owner, name }
  }

  const scpMatch = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i)
  if (scpMatch) {
    const owner = scpMatch[1]?.trim()
    const name = scpMatch[2]?.trim()
    if (owner && name) return { owner, name }
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname.toLowerCase() !== 'github.com') return null
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 2) return null
    const owner = segments[0]?.trim()
    let name = segments[1]?.trim() ?? ''
    if (name.endsWith('.git')) name = name.slice(0, -'.git'.length)
    if (!owner || !name) return null
    return { owner, name }
  } catch {
    return null
  }
}

export async function readGitHubRepoFromWorkspaceOrigin(
  workspacePath: string,
): Promise<GitHubIssueRepository | null> {
  const result = await execa('git', ['-C', workspacePath, 'remote', 'get-url', 'origin'], {
    reject: false,
  })
  if (result.exitCode !== 0) return null
  const url =
    typeof result.stdout === 'string' ? result.stdout.trim() : String(result.stdout ?? '').trim()
  if (!url) return null
  return parseGitHubRemoteUrl(url)
}
