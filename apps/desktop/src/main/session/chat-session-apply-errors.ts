import { CHAT_SESSION_MISMATCH_CODE, CHAT_SESSION_NOT_APPLICABLE_CODE } from '@planetz/shared'

export class ChatSessionApplyNotFoundError extends Error {
  readonly code = 'not_found'

  constructor(message: string) {
    super(message)
    this.name = 'ChatSessionApplyNotFoundError'
  }
}

export class ChatSessionApplyMismatchError extends Error {
  readonly code = CHAT_SESSION_MISMATCH_CODE

  constructor(message: string) {
    super(message)
    this.name = 'ChatSessionApplyMismatchError'
  }
}

export class ChatSessionApplyPolicyError extends Error {
  readonly code = CHAT_SESSION_NOT_APPLICABLE_CODE

  constructor(message: string) {
    super(message)
    this.name = 'ChatSessionApplyPolicyError'
  }
}
