import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveWorkspaceSidecarRoot } from '../sidecar/sidecar-paths.js'

/** Scaffold main-workspace `.planetz/orbit` only. Takt project dirs live on the isolated execution repo. */
export async function initializeWorkspace(
  mainWorkspacePath: string,
  createTaktDir: boolean,
  isolatedRepoPath?: string,
): Promise<void> {
  const sidecarRoot = await resolveWorkspaceSidecarRoot(mainWorkspacePath)
  await mkdir(sidecarRoot, { recursive: true })

  if (createTaktDir && isolatedRepoPath) {
    const taktRoot = join(isolatedRepoPath, '.takt')
    await mkdir(join(taktRoot, 'workflows'), { recursive: true })
    await mkdir(join(taktRoot, 'tasks'), { recursive: true })
    await mkdir(join(taktRoot, 'runs'), { recursive: true })
    try {
      await writeFile(join(taktRoot, 'tasks.yaml'), 'tasks: []\n', { flag: 'wx' })
    } catch {
      // already exists
    }
  }
}
