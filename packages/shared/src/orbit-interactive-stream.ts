import { z } from 'zod'

/** Adjunct protocol version (stderr NDJSON); separate from stdout contract v1. */
export const ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION = 1

const streamEventSchema = z
  .object({
    type: z.string(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough()

export const orbitInteractiveStreamLineSchema = z.object({
  v: z.literal(ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION),
  sessionId: z.string().trim().min(1),
  seq: z.number().int().positive(),
  event: streamEventSchema.optional(),
  done: z.boolean().optional(),
  aborted: z.boolean().optional(),
})

export type OrbitInteractiveStreamLine = z.infer<typeof orbitInteractiveStreamLineSchema>

export type OrbitInteractiveStreamEvent = OrbitInteractiveStreamLine['event']

export function createComposerStreamAbortedLine(sessionId: string): OrbitInteractiveStreamLine {
  return {
    v: ORBIT_INTERACTIVE_STREAM_PROTOCOL_VERSION,
    sessionId,
    seq: 1,
    done: true,
    aborted: true,
  }
}

export function parseOrbitInteractiveStreamLine(raw: string): OrbitInteractiveStreamLine | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let json: unknown
  try {
    json = JSON.parse(trimmed)
  } catch {
    return null
  }
  const parsed = orbitInteractiveStreamLineSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}
