import { describe, expect, it } from 'vitest'
import { chatSendErrorMessage } from '../chat-send-error-message.js'

describe('chatSendErrorMessage', () => {
  it('normalizes electron invoke wrappers', () => {
    const error = new Error(
      "Error invoking remote method 'composerSession:message': OrbitInteractiveClientError: boom",
    )

    expect(chatSendErrorMessage(error)).toBe('boom')
  })

  it('maps ollama non-chat model error to actionable guidance', () => {
    const error = new Error(
      'Error invoking remote method \'composerSession:message\': OrbitInteractiveClientError: "llama3.1:8b" does not support chat',
    )

    expect(chatSendErrorMessage(error)).toContain('llama3.1:8b does not support chat in Ollama')
  })

  it('keeps generic failures readable', () => {
    expect(chatSendErrorMessage(new Error('network down'))).toBe('network down')
  })
})
