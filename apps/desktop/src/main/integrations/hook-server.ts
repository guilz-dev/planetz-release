import { randomBytes, timingSafeEqual } from 'node:crypto'
import { integrationAdapterIdSchema } from '@planetz/shared'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'

/** Max length for hook agent log/push message fields (DoS mitigation). */
export const HOOK_MESSAGE_MAX_LENGTH = 16_384

/** JSON body overhead above message field. */
const HOOK_BODY_LIMIT_OVERHEAD_BYTES = 4096

/** Max length for optional agent id on hook push payloads. */
const HOOK_AGENT_ID_MAX_LENGTH = 256

const HOOK_AGENT_STATUSES = ['idle', 'working', 'reviewing', 'waiting', 'error'] as const

const hookAdapterFields = {
  adapterId: integrationAdapterIdSchema.optional(),
}

const hookMessageOptional = z.string().max(HOOK_MESSAGE_MAX_LENGTH).optional()
const hookMessageRequired = z.string().min(1).max(HOOK_MESSAGE_MAX_LENGTH)

const agentPushBodySchema = z.object({
  ...hookAdapterFields,
  agentId: z.string().max(HOOK_AGENT_ID_MAX_LENGTH).optional(),
  status: z.enum(HOOK_AGENT_STATUSES).optional(),
  message: hookMessageOptional,
})

const agentLogBodySchema = z.object({
  ...hookAdapterFields,
  message: hookMessageRequired,
})

export interface HookServerHandlers {
  onAgentPush: (input: z.infer<typeof agentPushBodySchema>) => void
  onAgentLog: (input: z.infer<typeof agentLogBodySchema>) => void
}

export function authorizeBearer(secret: string, authorization: string | undefined): boolean {
  if (!authorization?.startsWith('Bearer ')) return false
  const token = authorization.slice('Bearer '.length)
  if (token.length !== secret.length) return false
  try {
    return timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'))
  } catch {
    return false
  }
}

function sendInvalidBody(reply: FastifyReply): void {
  void reply.code(400).send({ error: 'invalid_body' })
}

function registerJsonRoute<T>(
  app: FastifyInstance,
  path: string,
  schema: z.ZodType<T>,
  handle: (data: T) => void,
): void {
  app.post(path, async (request, reply) => {
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      sendInvalidBody(reply)
      return
    }
    handle(parsed.data)
    return reply.send({ ok: true })
  })
}

export function createHookServerApp(secret: string, handlers: HookServerHandlers): FastifyInstance {
  const app = Fastify({
    logger: false,
    bodyLimit: HOOK_MESSAGE_MAX_LENGTH + HOOK_BODY_LIMIT_OVERHEAD_BYTES,
  })

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!authorizeBearer(secret, request.headers.authorization)) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
  })

  app.get('/health', async () => ({ ok: true }))

  registerJsonRoute(app, '/agents/push', agentPushBodySchema, (data) => {
    handlers.onAgentPush(data)
  })

  registerJsonRoute(app, '/agents/log', agentLogBodySchema, (data) => {
    handlers.onAgentLog(data)
  })

  app.post('/tasks/external', async (_request, reply) => {
    return reply.code(501).send({ error: 'not_implemented' })
  })

  return app
}

export class HookServer {
  private app: FastifyInstance | null = null
  private bearerSecret: string | null = null
  private listeningPort: number | null = null

  getSecret(): string | null {
    return this.bearerSecret
  }

  getPort(): number | null {
    return this.listeningPort
  }

  isRunning(): boolean {
    return this.app !== null
  }

  async start(
    port: number,
    handlers: HookServerHandlers,
  ): Promise<{ secret: string; port: number }> {
    await this.stop()
    const secret = randomBytes(32).toString('hex')
    const app = createHookServerApp(secret, handlers)
    await app.listen({ host: '127.0.0.1', port })
    this.app = app
    this.bearerSecret = secret
    const addr = app.server.address()
    const boundPort =
      typeof addr === 'object' && addr && 'port' in addr ? (addr.port as number) : port
    this.listeningPort = boundPort
    return { secret, port: boundPort }
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.close()
    }
    this.app = null
    this.bearerSecret = null
    this.listeningPort = null
  }
}
