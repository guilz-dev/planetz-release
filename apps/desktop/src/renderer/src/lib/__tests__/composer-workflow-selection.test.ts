import { COMPOSER_DEFAULT_WORKFLOW_NAME } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { resolveComposerWorkflowName } from '../composer-workflow-selection.js'

describe('resolveComposerWorkflowName', () => {
  const workflows = [{ name: 'default' }, { name: 'minimal' }, { name: 'review' }]

  it('keeps preferred when listed', () => {
    expect(resolveComposerWorkflowName(workflows, 'review')).toBe('review')
  })

  it('falls back to composer default when preferred is missing', () => {
    expect(resolveComposerWorkflowName(workflows, 'missing')).toBe(COMPOSER_DEFAULT_WORKFLOW_NAME)
  })

  it('falls back to first workflow when composer default is absent', () => {
    expect(resolveComposerWorkflowName([{ name: 'default' }], 'missing')).toBe('default')
  })
})
