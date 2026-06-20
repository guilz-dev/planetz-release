import { cp, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export function isIgnorableCopyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

/** Copy `*.yaml` / `*.yml` files from `srcDir` into `destDir` (non-recursive). */
export async function copyYamlDir(srcDir: string, destDir: string): Promise<void> {
  let files: string[]
  try {
    files = await readdir(srcDir)
  } catch {
    return
  }
  await mkdir(destDir, { recursive: true })
  for (const file of files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
    try {
      await cp(join(srcDir, file), join(destDir, file))
    } catch (error) {
      if (!isIgnorableCopyError(error)) throw error
    }
  }
}
