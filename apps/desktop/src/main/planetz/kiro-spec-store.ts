import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildKiroSpecSummary,
  KIRO_SPEC_JSON_FILE,
  KIRO_SPECS_DIR,
  type KiroSpecSummary,
} from '@planetz/shared'

async function pathIsDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

export class KiroSpecStore {
  async listSpecs(workspacePath: string): Promise<KiroSpecSummary[]> {
    const specsRoot = join(workspacePath, KIRO_SPECS_DIR)
    if (!(await pathIsDirectory(specsRoot))) return []

    let entries: string[]
    try {
      entries = await readdir(specsRoot)
    } catch {
      return []
    }

    const specs: KiroSpecSummary[] = []
    for (const featureId of entries.sort()) {
      const featureDir = join(specsRoot, featureId)
      if (!(await pathIsDirectory(featureDir))) continue
      const specDirRel = `${KIRO_SPECS_DIR}/${featureId}`
      const specJsonPath = join(featureDir, KIRO_SPEC_JSON_FILE)
      let rawJson: string | null = null
      try {
        rawJson = await readFile(specJsonPath, 'utf8')
      } catch {
        rawJson = null
      }
      specs.push(
        buildKiroSpecSummary({
          featureId,
          specDirRel,
          rawJson,
        }),
      )
    }
    return specs
  }

  async getSpec(workspacePath: string, featureId: string): Promise<KiroSpecSummary> {
    const specDirRel = `${KIRO_SPECS_DIR}/${featureId}`
    const specJsonPath = join(workspacePath, specDirRel, KIRO_SPEC_JSON_FILE)
    let rawJson: string | null = null
    try {
      rawJson = await readFile(specJsonPath, 'utf8')
    } catch {
      rawJson = null
    }
    return buildKiroSpecSummary({ featureId, specDirRel, rawJson })
  }
}
