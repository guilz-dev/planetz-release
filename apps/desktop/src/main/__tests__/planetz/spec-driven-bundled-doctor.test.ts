import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { specDrivenFacetFilesForWriteProject } from '../../../shared/spec-driven/spec-driven-facet-files.js'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../../shared/spec-driven/spec-driven-workflow-yaml.js'
import {
  bundledOrbitDoctorAvailable,
  resolveBundledOrbitCliFixture,
} from '../bundled-orbit-test-utils.js'

const execFileAsync = promisify(execFile)

describe('spec-driven bundled orbit CLI doctor', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it.runIf(bundledOrbitDoctorAvailable())(
    'passes workflow doctor via bundled orbit CLI (not app wrapper)',
    async () => {
      workspace = await mkdtemp(join(tmpdir(), 'spec-driven-cli-doctor-'))
      const { cli, root: orbitRoot } = resolveBundledOrbitCliFixture()
      const workflowsDir = join(workspace, '.takt', 'workflows')
      const facetsDir = join(workspace, '.takt', 'facets')
      await mkdir(workflowsDir, { recursive: true })
      await mkdir(facetsDir, { recursive: true })
      await cp(join(orbitRoot, 'builtins', 'en', 'facets'), facetsDir, { recursive: true })

      for (const [rel, content] of Object.entries(specDrivenFacetFilesForWriteProject())) {
        const target = join(workspace, '.takt', rel.replace(/^facets\//, 'facets/'))
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, content, 'utf8')
      }

      const workflowPath = join(workflowsDir, 'spec-driven.yaml')
      await writeFile(workflowPath, SPEC_DRIVEN_WORKFLOW_YAML, 'utf8')

      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cli, 'workflow', 'doctor', '--', workflowPath],
        {
          cwd: workspace,
        },
      )

      expect(`${stdout}\n${stderr}`.toLowerCase()).not.toMatch(
        /\[error\]|failed to load|workflow not found/,
      )
    },
  )
})
