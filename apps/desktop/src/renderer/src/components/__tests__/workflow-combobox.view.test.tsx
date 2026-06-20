import type { WorkflowSummary } from '@planetz/shared'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { WorkflowCombobox } from '../workflow-combobox.js'

function workflowSummary(
  name: string,
  source: WorkflowSummary['source'] = 'project',
): WorkflowSummary {
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

const WORKFLOWS: WorkflowSummary[] = [
  workflowSummary('alpha'),
  workflowSummary('beta'),
  workflowSummary('gamma', 'builtin'),
]

function renderCombobox(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('WorkflowCombobox Recent group', () => {
  beforeEach(() => {
    vi.stubGlobal('orbit', {
      getSettings: vi.fn(async () => ({ workspacePath: null, config: null })),
      updateSettings: vi.fn(async () => ({ config: null, connection: null })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows Recent after Project when recentWorkflowNames is provided', () => {
    renderCombobox(
      <WorkflowCombobox
        workflows={WORKFLOWS}
        value="alpha"
        onChange={vi.fn()}
        recentWorkflowNames={['beta', 'alpha']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }))

    expect(screen.getByText('Recent')).toBeTruthy()
    expect(screen.getByText('Project')).toBeTruthy()

    const listbox = screen.getByRole('listbox', { name: 'Workflow options' })
    const options = within(listbox).getAllByRole('option')
    expect(options[0]?.textContent).toContain('alpha (project)')
    expect(options[1]?.textContent).toContain('beta (project)')
  })

  it('hides Recent when recentWorkflowNames is empty', () => {
    renderCombobox(
      <WorkflowCombobox
        workflows={WORKFLOWS}
        value="alpha"
        onChange={vi.fn()}
        recentWorkflowNames={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }))
    expect(screen.queryByText('Recent')).toBeNull()
  })

  it('filters Recent items when searching', () => {
    renderCombobox(
      <WorkflowCombobox
        workflows={WORKFLOWS}
        value="alpha"
        onChange={vi.fn()}
        recentWorkflowNames={['beta', 'alpha', 'gamma']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }))
    fireEvent.change(screen.getByLabelText('Filter workflows'), { target: { value: 'beta' } })

    const listbox = screen.getByRole('listbox', { name: 'Workflow options' })
    const options = within(listbox).getAllByRole('option')
    expect(options[0]?.textContent).toContain('beta (project)')
    expect(options.some((el) => el.textContent?.includes('gamma'))).toBe(false)
  })
})
