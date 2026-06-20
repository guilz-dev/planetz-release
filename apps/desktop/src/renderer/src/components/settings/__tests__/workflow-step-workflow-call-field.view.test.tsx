import type { WorkflowSummary } from '@planetz/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import type { StepDraft } from '../workflow-draft-types.js'
import { WorkflowStepWorkflowCallField } from '../workflow-step-workflow-call-field.js'

function wf(name: string, source: WorkflowSummary['source'] = 'builtin'): WorkflowSummary {
  return {
    name,
    source,
    stepNames: [],
    agentRoles: [],
    steps: [],
    isOverridden: false,
    diagnostics: [],
  }
}

function workflowCallStep(call = ''): StepDraft {
  return {
    id: 'step-1',
    name: 'invoke',
    special: 'workflow_call',
    rules: [],
    raw: {
      name: 'invoke',
      kind: 'workflow_call',
      call,
      rules: [],
    },
  }
}

function renderField(onChange = vi.fn()) {
  render(
    <I18nProvider>
      <WorkflowStepWorkflowCallField
        step={workflowCallStep()}
        stepNames={['invoke']}
        workflows={[wf('minimal'), wf('terraform'), wf('custom', 'project')]}
        draft={{
          name: 'parent',
          initialStep: 'invoke',
          steps: [workflowCallStep()],
          personas: [],
          policies: [],
          knowledge: [],
          instructions: [],
          reportFormats: [],
          unsupportedKeys: [],
        }}
        onChange={onChange}
      />
    </I18nProvider>,
  )
  return onChange
}

describe('WorkflowStepWorkflowCallField', () => {
  afterEach(() => {
    cleanup()
  })

  it('lists library workflows in the searchable picker dialog', () => {
    renderField()
    fireEvent.click(screen.getByRole('button', { name: /change|変更/i }))
    expect(screen.getByRole('button', { name: /terraform/i })).toBeTruthy()
  })

  it('persists canonical workflow name on select', () => {
    const onChange = renderField()
    fireEvent.click(screen.getByRole('button', { name: /change|変更/i }))
    fireEvent.change(screen.getByPlaceholderText(/search workflows|workflow を検索/i), {
      target: { value: 'terraform' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /select|選択/i })[0])
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        raw: expect.objectContaining({ call: 'terraform' }),
      }),
    )
  })
})
