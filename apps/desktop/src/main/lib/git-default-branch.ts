import { execa } from 'execa'

/**
 * Resolve the repository default branch in a way compatible with bundled takt.
 * Falls back to `main` when refs cannot be resolved.
 */
export async function detectGitDefaultBranch(cwd: string): Promise<string> {
  const symbolicRef = await execa('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
    cwd,
    reject: false,
  })
  if (symbolicRef.exitCode === 0) {
    const ref = symbolicRef.stdout.trim()
    const prefix = 'refs/remotes/origin/'
    if (ref.startsWith(prefix) && ref.length > prefix.length) {
      return ref.slice(prefix.length)
    }
  }

  const main = await execa('git', ['rev-parse', '--verify', 'main'], {
    cwd,
    reject: false,
  })
  if (main.exitCode === 0) return 'main'

  const master = await execa('git', ['rev-parse', '--verify', 'master'], {
    cwd,
    reject: false,
  })
  if (master.exitCode === 0) return 'master'

  return 'main'
}
