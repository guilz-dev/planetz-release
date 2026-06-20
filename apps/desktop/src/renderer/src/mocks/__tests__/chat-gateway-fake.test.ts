import { describe, expect, it } from 'vitest'
import { createFakeChatGateway } from '../chat-gateway-fake.js'

describe('createFakeChatGateway', () => {
  it('satisfies list/start/send/get contract', async () => {
    const gateway = createFakeChatGateway()

    expect(await gateway.listThreads()).toEqual([])

    const { threadId } = await gateway.startThread({
      seedBody: 'Investigate failing test',
      workspacePath: '/repo/main',
      mode: 'interactive',
    })
    expect(threadId).toBeTruthy()

    const threads = await gateway.listThreads()
    expect(threads).toHaveLength(1)
    expect(threads[0]?.id).toBe(threadId)

    await gateway.sendMessage({ threadId, message: 'Please summarize logs' })
    const loaded = await gateway.getThread(threadId)
    const turns = loaded.turns
    expect(turns.at(-1)?.role).toBe('assistant')
    expect(turns.at(-1)?.content).toContain('Please summarize logs')
  })

  it('returns deterministic form options', async () => {
    const gateway = createFakeChatGateway()
    const options = await gateway.getFormOptions()
    expect(options.workspaces[0]?.value).toBe('/repo/main')
    expect(options.branches[0]?.value).toBe('main')
    expect(options.providers[0]?.value).toBe('claude-sdk')
    expect(options.models[0]?.value).toBe('claude-sonnet-4')
  })
})
