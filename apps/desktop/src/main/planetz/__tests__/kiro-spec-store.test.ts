import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { KiroSpecStore } from '../kiro-spec-store.js'

const dirs: string[] = []

afterEach(async () => {
  dirs.length = 0
})

async function writeFixture(specs: Record<string, string | null>): Promise<string> {
  const root = join(
    tmpdir(),
    `planetz-kiro-spec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  dirs.push(root)
  for (const [featureId, json] of Object.entries(specs)) {
    const featureDir = join(root, '.kiro', 'specs', featureId)
    await mkdir(featureDir, { recursive: true })
    if (json !== null) {
      await writeFile(join(featureDir, 'spec.json'), json, 'utf8')
    }
  }
  return root
}

describe('KiroSpecStore', () => {
  const store = new KiroSpecStore()

  it('returns empty list when .kiro/specs is missing', async () => {
    const root = join(tmpdir(), `planetz-kiro-empty-${Date.now()}`)
    dirs.push(root)
    await mkdir(root, { recursive: true })
    await expect(store.listSpecs(root)).resolves.toEqual([])
  })

  it('lists features and parses approval state', async () => {
    const root = await writeFixture({
      auth: JSON.stringify({
        version: 1,
        approvals: {
          requirements: { approved: true },
          design: { approved: false },
          tasks: { approved: false },
        },
      }),
    })

    const specs = await store.listSpecs(root)
    expect(specs).toHaveLength(1)
    expect(specs[0]?.featureId).toBe('auth')
    expect(specs[0]?.parseStatus).toBe('ok')
    expect(specs[0]?.approvals?.requirements?.approved).toBe(true)
  })

  it('gracefully degrades invalid spec.json', async () => {
    const root = await writeFixture({ broken: '{invalid' })
    const spec = await store.getSpec(root, 'broken')
    expect(spec.parseStatus).toBe('invalid')
  })
})
