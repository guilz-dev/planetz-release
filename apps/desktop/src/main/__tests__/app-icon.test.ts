import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAppIconCandidates, resolveAppIconPath } from '../lib/app-icon.js'

describe('app icon paths', () => {
  it('lists packaged, cwd, and monorepo resource locations', () => {
    const candidates = buildAppIconCandidates('icon.png', '/fake/out/main')
    expect(candidates).toEqual([
      '/fake/resources/icon.png',
      join(process.cwd(), 'resources/icon.png'),
      join(process.cwd(), 'apps/desktop/resources/icon.png'),
    ])
  })

  it('resolves the first existing icon file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'planetz-icon-'))
    const resources = join(dir, 'resources')
    await mkdir(resources, { recursive: true })
    const iconPath = join(resources, 'icon.png')
    await writeFile(iconPath, 'png', 'utf8')
    expect(resolveAppIconPath('icon.png', join(dir, 'out/main'))).toBe(iconPath)
  })
})
