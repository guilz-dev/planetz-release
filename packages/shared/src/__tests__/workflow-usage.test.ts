import { describe, expect, it } from 'vitest'
import { CHAT_INVESTIGATION_WORKFLOW_NAME } from '../constants.js'
import {
  filterTaskUsableWorkflowNames,
  isChatOnlyWorkflowName,
  isTaskUsableWorkflowName,
} from '../workflow-usage.js'

describe('workflow-usage', () => {
  it('treats chat-investigation as chat-only', () => {
    expect(isChatOnlyWorkflowName(CHAT_INVESTIGATION_WORKFLOW_NAME)).toBe(true)
    expect(isTaskUsableWorkflowName(CHAT_INVESTIGATION_WORKFLOW_NAME)).toBe(false)
  })

  it('filters chat-only workflows from task lists', () => {
    expect(
      filterTaskUsableWorkflowNames(['default', CHAT_INVESTIGATION_WORKFLOW_NAME, 'minimal']),
    ).toEqual(['default', 'minimal'])
  })
})
