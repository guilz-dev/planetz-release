import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../../__tests__/orbit-mock.js'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { useWorkflowEditorActions } from '../use-workflow-editor-actions.js'
import type { WorkflowDraft } from '../workflow-draft-types.js'
import { parseWorkflowYaml } from '../workflow-parse.js'

const DISK_YAML = `name: test-wf
initial_step: step-1
steps:
  - name: step-1
    rules: []
`

function minimalParams(overrides: Partial<Parameters<typeof useWorkflowEditorActions>[0]> = {}) {
  const draft = parseWorkflowYaml(DISK_YAML)
  const setDraft = vi.fn() as (next: WorkflowDraft | null) => void
  return {
    workflows: [],
    onRefresh: vi.fn(async () => {}),
    draft,
    setDraft,
    currentYaml: DISK_YAML,
    dirty: false,
    setOriginalYaml: vi.fn(),
    setOriginalFacetFingerprint: vi.fn(),
    setDiagnostics: vi.fn(),
    setSelected: vi.fn(),
    setView: vi.fn(),
    setTab: vi.fn(),
    setYamlDrawerOpen: vi.fn(),
    setYamlDrawerText: vi.fn(),
    setSaveDiffOpen: vi.fn(),
    yamlDrawerText: DISK_YAML,
    requestConfirm: vi.fn(async () => true),
    ...overrides,
  }
}

describe('useWorkflowEditorActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('handleCopyToProject writes yaml and opens editor', async () => {
    const readWorkflow = vi.fn(async () => ({ yaml: DISK_YAML, source: 'project' as const }))
    const onRefresh = vi.fn(async () => {})
    const orbit = installOrbitMock({ readWorkflow })

    const params = minimalParams({ onRefresh })
    const { result } = renderHook(() => useWorkflowEditorActions(params), {
      wrapper: ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>,
    })

    await act(async () => {
      await result.current.handleCopyToProject('test-wf')
    })

    expect(orbit.writeProjectWorkflow).toHaveBeenCalledWith({ name: 'test-wf', yaml: DISK_YAML })
    expect(onRefresh).toHaveBeenCalled()
    expect(readWorkflow).toHaveBeenCalledTimes(2)
  })
})
