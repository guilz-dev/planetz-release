/**
 * Single seam for Conversation Mode data access.
 *
 * Container components call `useChatGateway()` and get a {@link ChatGateway}.
 * In normal runtime, `auto` resolves to {@link createOrbitChatGateway}. The
 * in-memory mock remains available only for explicit `mock` override and tests.
 */
import type { DesktopCapabilitiesResult } from '@planetz/shared'
import { useEffect, useState } from 'react'
import type { ChatGateway } from '../components/chat/chat-types'
import { createOrbitChatGateway } from '../gateways/orbit-chat-gateway'
import { createMockChatGateway } from '../mocks/chat-gateway-mock'
import {
  fetchDesktopCapabilities,
  resetDesktopCapabilitiesForTests,
} from './use-desktop-capabilities.js'

let singletonGateway: ChatGateway | null = null
let gatewayKind: 'mock' | 'orbit' | null = null
let singletonLazyGateway: ChatGateway | null = null
let resolveGatewayPromise: Promise<ChatGateway> | null = null

function resolveGatewayKind(capabilities: DesktopCapabilitiesResult): 'mock' | 'orbit' {
  if (capabilities.chatGateway === 'mock') return 'mock'
  if (capabilities.chatGateway === 'orbit') return 'orbit'
  return 'orbit'
}

function ensureGateway(capabilities: DesktopCapabilitiesResult): ChatGateway {
  const kind = resolveGatewayKind(capabilities)
  if (!singletonGateway || gatewayKind !== kind) {
    singletonGateway = kind === 'orbit' ? createOrbitChatGateway() : createMockChatGateway()
    gatewayKind = kind
  }
  return singletonGateway
}

function resolveRuntimeGateway(): Promise<ChatGateway> {
  if (resolveGatewayPromise) return resolveGatewayPromise
  resolveGatewayPromise = fetchDesktopCapabilities().then((capabilities) =>
    ensureGateway(capabilities),
  )
  return resolveGatewayPromise
}

function createLazyGateway(): ChatGateway {
  return {
    async listThreads(input) {
      const gateway = await resolveRuntimeGateway()
      return gateway.listThreads(input)
    },
    async searchThreads(input) {
      const gateway = await resolveRuntimeGateway()
      if (!gateway.searchThreads) return []
      return gateway.searchThreads(input)
    },
    async getThread(threadId) {
      const gateway = await resolveRuntimeGateway()
      return gateway.getThread(threadId)
    },
    async getActiveComposerSessionId(threadId) {
      const gateway = await resolveRuntimeGateway()
      return gateway.getActiveComposerSessionId(threadId)
    },
    async startThread(input) {
      const gateway = await resolveRuntimeGateway()
      return gateway.startThread(input)
    },
    async restartThreadSession(input) {
      const gateway = await resolveRuntimeGateway()
      if (!gateway.restartThreadSession) {
        throw new Error('Chat gateway does not support restartThreadSession')
      }
      return gateway.restartThreadSession(input)
    },
    async sendMessage(input) {
      const gateway = await resolveRuntimeGateway()
      return gateway.sendMessage(input)
    },
    async finalizeThread(input) {
      const gateway = await resolveRuntimeGateway()
      return gateway.finalizeThread(input)
    },
    async getFormOptions() {
      const gateway = await resolveRuntimeGateway()
      return gateway.getFormOptions()
    },
    async cancelSend(input) {
      const gateway = await resolveRuntimeGateway()
      if (!gateway.cancelSend) return
      return gateway.cancelSend(input)
    },
    async loadComposerDraft() {
      const gateway = await resolveRuntimeGateway()
      if (!gateway.loadComposerDraft) return null
      return gateway.loadComposerDraft()
    },
    async saveComposerDraft(snapshot) {
      const gateway = await resolveRuntimeGateway()
      if (!gateway.saveComposerDraft) return
      return gateway.saveComposerDraft(snapshot)
    },
  }
}

export function createChatGateway(): ChatGateway {
  return createMockChatGateway()
}

/** @internal Resets singleton for tests. */
export function resetChatGatewayForTests(): void {
  singletonGateway = null
  gatewayKind = null
  singletonLazyGateway = null
  resolveGatewayPromise = null
  resetDesktopCapabilitiesForTests()
}

export function useChatGateway(): ChatGateway {
  const [gateway] = useState<ChatGateway>(() => {
    if (singletonLazyGateway) return singletonLazyGateway
    singletonLazyGateway = createLazyGateway()
    return singletonLazyGateway
  })

  useEffect(() => {
    void resolveRuntimeGateway()
    return undefined
  }, [])

  return gateway
}
