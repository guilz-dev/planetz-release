import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveDoctorInlineYaml, runWorkflowDoctor } from '../lib/workflow-doctor-runner.js'

const { runTaktCliInWorkspaceMock } = vi.hoisted(() => ({
  runTaktCliInWorkspaceMock: vi.fn(),
}))

vi.mock('../takt/exec-cli.js', () => ({
  runTaktCliInWorkspace: runTaktCliInWorkspaceMock,
  outputText: (value: unknown) => (typeof value === 'string' ? value : ''),
}))

describe('resolveDoctorInlineYaml', () => {
  it('prefers explicit inline yaml over resolved workflow text', () => {
    expect(resolveDoctorInlineYaml('from-read', 'inline')).toBe('inline')
    expect(resolveDoctorInlineYaml('from-read')).toBe('from-read')
  })
})

describe('runWorkflowDoctor', () => {
  const cleanupDirs: string[] = []

  afterEach(async () => {
    runTaktCliInWorkspaceMock.mockReset()
    await Promise.all(cleanupDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('materializes inline yaml under takt workflows dir for facet resolution', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'planetz-wf-base-'))
    cleanupDirs.push(baseDir)
    const yaml = 'name: my-workflow\nsteps:\n  - name: start\n'
    runTaktCliInWorkspaceMock.mockImplementation(async (_config, _cwd, args) => {
      const doctorArg = args[3] as string
      expect(doctorArg).toBe(join(baseDir, '.planetz-wf-doctor-my-workflow.yaml'))
      const written = await readFile(doctorArg, 'utf8')
      expect(written).toBe(yaml)
      return { exitCode: 0, stdout: '', stderr: '' }
    })

    const diagnostics = await runWorkflowDoctor(DEFAULT_CONFIG, '/tmp/ws', 'my-workflow', yaml, {
      inlineYamlBaseDir: baseDir,
      doctorFacetsDir: join(baseDir, '.takt', 'facets'),
    })

    expect(diagnostics).toEqual([])
    expect(runTaktCliInWorkspaceMock).toHaveBeenCalledTimes(1)
    await expect(
      readFile(join(baseDir, '.planetz-wf-doctor-my-workflow.yaml'), 'utf8'),
    ).rejects.toThrow()
  })

  it('uses workflow name when inline yaml is omitted', async () => {
    runTaktCliInWorkspaceMock.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

    await runWorkflowDoctor(DEFAULT_CONFIG, '/tmp/ws', 'existing-workflow')

    expect(runTaktCliInWorkspaceMock.mock.calls[0]?.[2]).toEqual([
      'workflow',
      'doctor',
      '--',
      'existing-workflow',
    ])
  })

  it('normalizes temp doctor workflow names in error output', async () => {
    runTaktCliInWorkspaceMock.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr:
        'my-workflow.yaml: Workflow ".planetz-wf-doctor-my-workflow.yaml" failed to load: Persona prompt file path is not allowed',
    })

    const diagnostics = await runWorkflowDoctor(
      DEFAULT_CONFIG,
      '/tmp/ws',
      'my-workflow',
      'name: my-workflow\nsteps: []\n',
    )

    expect(diagnostics[0]?.message).toContain(
      'my-workflow.yaml: Workflow "my-workflow.yaml" failed to load',
    )
    expect(diagnostics[0]?.message).not.toContain('.planetz-wf-doctor-')
  })
})
