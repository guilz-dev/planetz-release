import { describe, expect, it } from 'vitest'
import {
  authorizeBearer,
  createHookServerApp,
  HOOK_MESSAGE_MAX_LENGTH,
  HookServer,
} from '../integrations/hook-server.js'

function authJsonHeaders(secret: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  }
}

async function injectHook(
  secret: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ statusCode: number }> {
  const app = createHookServerApp(secret, {
    onAgentPush: () => {},
    onAgentLog: () => {},
  })
  const headers = authJsonHeaders(secret)
  try {
    const response: { statusCode: number } =
      body === undefined
        ? await app.inject({
            method: 'POST',
            url: path,
            headers: { Authorization: headers.Authorization },
          })
        : await app.inject({
            method: 'POST',
            url: path,
            headers,
            payload: body,
          })
    return response
  } finally {
    await app.close()
  }
}

describe('authorizeBearer', () => {
  it('rejects missing or wrong tokens', () => {
    const secret = 'a'.repeat(64)
    expect(authorizeBearer(secret, undefined)).toBe(false)
    expect(authorizeBearer(secret, 'Bearer wrong')).toBe(false)
    expect(authorizeBearer(secret, `Bearer ${secret}`)).toBe(true)
  })
})

describe('HookServer', () => {
  it('requires Bearer on /health and accepts valid token', async () => {
    let pushed = false
    const secret = 'a'.repeat(64)
    const app = createHookServerApp(secret, {
      onAgentPush: () => {
        pushed = true
      },
      onAgentLog: () => {},
    })
    try {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(401)

      const health = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { Authorization: `Bearer ${secret}` },
      })
      expect(health.statusCode).toBe(200)

      const push = await app.inject({
        method: 'POST',
        url: '/agents/push',
        headers: authJsonHeaders(secret),
        payload: {
          adapterId: 'cursor',
          status: 'working',
        },
      })
      expect(push.statusCode).toBe(200)
      expect(pushed).toBe(true)

      expect((await app.inject({ method: 'POST', url: '/tasks/external' })).statusCode).toBe(401)
      expect((await injectHook(secret, '/tasks/external')).statusCode).toBe(501)
    } finally {
      await app.close()
    }
  })

  it('accepts /agents/log with valid body and rejects invalid payloads', async () => {
    let logged: { adapterId?: string; message: string } | null = null
    const secret = 'b'.repeat(64)
    const app = createHookServerApp(secret, {
      onAgentPush: () => {},
      onAgentLog: (input) => {
        logged = input
      },
    })
    try {
      const ok = await app.inject({
        method: 'POST',
        url: '/agents/log',
        headers: authJsonHeaders(secret),
        payload: {
          adapterId: 'codex',
          message: 'hello',
        },
      })
      expect(ok.statusCode).toBe(200)
      expect(logged).toEqual({ adapterId: 'codex', message: 'hello' })

      expect((await injectHook(secret, '/agents/log', { adapterId: 'cursor' })).statusCode).toBe(
        400,
      )
      expect(
        (
          await injectHook(secret, '/agents/log', {
            adapterId: 'not-a-provider',
            message: 'x',
          })
        ).statusCode,
      ).toBe(400)

      expect(
        (
          await injectHook(secret, '/agents/push', {
            adapterId: 'cursor',
            agentId: 'a'.repeat(257),
          })
        ).statusCode,
      ).toBe(400)

      const overMax = 'x'.repeat(HOOK_MESSAGE_MAX_LENGTH + 1)
      expect((await injectHook(secret, '/agents/log', { message: overMax })).statusCode).toBe(400)
      expect(
        (await injectHook(secret, '/agents/push', { adapterId: 'cursor', message: overMax }))
          .statusCode,
      ).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('returns 413 when JSON body exceeds bodyLimit', async () => {
    const secret = 'c'.repeat(64)
    const app = createHookServerApp(secret, {
      onAgentPush: () => {},
      onAgentLog: () => {},
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/agents/log',
        headers: authJsonHeaders(secret),
        payload: {
          message: 'x'.repeat(25_000),
        },
      })
      expect(res.statusCode).toBe(413)
    } finally {
      await app.close()
    }
  })

  it('starts on an ephemeral port and can restart cleanly', async () => {
    const server = new HookServer()
    const handlers = {
      onAgentPush: () => {},
      onAgentLog: () => {},
    }
    try {
      const first = await server.start(0, handlers)
      expect(server.isRunning()).toBe(true)
      expect(server.getPort()).toBe(first.port)
      expect(server.getSecret()).toBe(first.secret)
      expect(first.port).toBeGreaterThan(0)

      const firstHealth = await fetch(`http://127.0.0.1:${first.port}/health`, {
        headers: { Authorization: `Bearer ${first.secret}` },
      })
      expect(firstHealth.status).toBe(200)

      await server.stop()
      expect(server.isRunning()).toBe(false)
      expect(server.getPort()).toBeNull()
      expect(server.getSecret()).toBeNull()

      const second = await server.start(0, handlers)
      expect(server.isRunning()).toBe(true)
      expect(server.getPort()).toBe(second.port)
      expect(server.getSecret()).toBe(second.secret)
      expect(second.port).toBeGreaterThan(0)
      expect(second.secret).not.toBe(first.secret)

      const secondHealth = await fetch(`http://127.0.0.1:${second.port}/health`, {
        headers: { Authorization: `Bearer ${second.secret}` },
      })
      expect(secondHealth.status).toBe(200)
    } finally {
      await server.stop()
    }
  })
})
