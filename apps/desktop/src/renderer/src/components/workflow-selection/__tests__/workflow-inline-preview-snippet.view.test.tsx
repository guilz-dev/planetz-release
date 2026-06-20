import type { WorkflowPreviewResult } from '@planetz/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../i18n/i18n-provider.js'
import { WorkflowInlinePreviewSnippet } from '../workflow-inline-preview-snippet.js'

const PREVIEW: WorkflowPreviewResult = {
  name: 'default',
  source: 'builtin',
  description: 'Standard workflow',
  steps: [{ name: 'implement', edit: true }],
  initialStep: 'implement',
  features: {
    workflowName: 'default',
    source: 'builtin',
    canCompleteWithoutEditing: false,
    canCompleteBeforeFirstEdit: false,
    forcesImplementationOnAllPaths: false,
    hasImplementationPath: true,
    forcesTestWriting: false,
    requiresClearSpec: false,
    changeMode: 'edit_heavy',
    primaryOutputs: ['code'],
    dominantModes: ['implement'],
    targetSurfaces: ['general'],
    hasWriteTestsStep: false,
    hasReviewLoop: false,
    hasFixLoop: false,
    hasParallelReview: false,
    hasWorkflowCall: false,
    hasLoopMonitor: false,
    personaKeys: [],
    policyKeys: [],
    knowledgeKeys: [],
    instructionKeys: [],
    reportFormatKeys: [],
    stepCount: 1,
    editStepCount: 1,
    reviewStepCount: 0,
    investigateStepCount: 0,
    auditStepCount: 0,
    evidence: [],
  },
  overridesAllowed: true,
  strictTier: false,
}

describe('WorkflowInlinePreviewSnippet', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows loading state', () => {
    render(
      <I18nProvider>
        <WorkflowInlinePreviewSnippet preview={null} loading loadError={false} />
      </I18nProvider>,
    )
    expect(screen.getByText('Loading workflow…')).toBeTruthy()
  })

  it('shows feature badges when preview is available', () => {
    render(
      <I18nProvider>
        <WorkflowInlinePreviewSnippet preview={PREVIEW} loading={false} loadError={false} />
      </I18nProvider>,
    )
    expect(screen.getByText('edit-heavy')).toBeTruthy()
    expect(screen.getByText('Steps (1)')).toBeTruthy()
  })
})
