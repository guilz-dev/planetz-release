/**
 * Child-process runner: headless orbit interactive session (JSON stdin/stdout).
 * Env: PLANETZ_ORBIT_MODULE_ROOT — orbit root with built dist/ and node_modules.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CONTRACT_VERSION = 1

const HEADLESS_TOOLS_PROFILES = new Set([
  'readonly',
  'orbit-default',
  'planetz-readonly',
  'planetz-investigate',
  'planetz-agent-edit',
  'planetz-orbit-default',
])

function normalizeToolsProfile(raw) {
  if (typeof raw === 'string' && HEADLESS_TOOLS_PROFILES.has(raw)) {
    return raw
  }
  return 'readonly'
}

const orbitRoot = process.env.PLANETZ_ORBIT_MODULE_ROOT?.trim()
if (!orbitRoot) {
  process.stderr.write('PLANETZ_ORBIT_MODULE_ROOT is required\n')
  process.exit(1)
}

const {
  headlessInteractiveStart,
  headlessInteractiveTurn,
  headlessInteractiveFinalize,
  headlessInteractiveAccept,
  headlessInteractivePlay,
  headlessInteractiveCancel,
} = await import(
  pathToFileURL(join(orbitRoot, 'dist/features/interactive/headlessSession.js')).href
)

const raw = readFileSync(0, 'utf8')
/** @type {{ contractVersion: number; op: string; snapshot: object | null; payload?: Record<string, unknown> }} */
const request = JSON.parse(raw)

function writeResponse(body) {
  process.stdout.write(JSON.stringify({ contractVersion: CONTRACT_VERSION, ...body }))
}

if (request.contractVersion !== CONTRACT_VERSION) {
  writeResponse({
    ok: false,
    error: `Unsupported contract version: ${request.contractVersion}`,
    nextSnapshot: request.snapshot ?? null,
  })
  process.exit(0)
}

try {
  const op = request.op
  const payload = request.payload ?? {}

  if (op === 'start') {
    const { snapshot, result } = await headlessInteractiveStart({
      cwd: String(payload.cwd ?? ''),
      workflow: String(payload.workflow ?? ''),
      planetzSessionId: String(payload.planetzSessionId ?? ''),
      provider: payload.provider != null ? String(payload.provider) : undefined,
      model: payload.model != null ? String(payload.model) : undefined,
      effort: payload.effort != null ? String(payload.effort) : undefined,
      seed:
        payload.seedBody || payload.sourceContext
          ? {
              ...(payload.seedBody ? { userMessage: String(payload.seedBody) } : {}),
              ...(payload.sourceContext
                ? { sourceContext: String(payload.sourceContext) }
                : {}),
            }
          : undefined,
      toolsProfile: normalizeToolsProfile(payload.toolsProfile),
      sessionPolicy:
        typeof payload.sessionPolicy === 'string' ? payload.sessionPolicy : undefined,
      ...(payload.mcpServers && typeof payload.mcpServers === 'object'
        ? { mcpServers: payload.mcpServers }
        : {}),
      ...(Array.isArray(payload.allowedToolsOverride)
        ? { allowedToolsOverride: payload.allowedToolsOverride.map((tool) => String(tool)) }
        : {}),
    })
    writeResponse({ ok: result.kind !== 'error', result, nextSnapshot: snapshot })
    process.exit(0)
  }

  const snapshot = request.snapshot
  if (!snapshot) {
    writeResponse({ ok: false, error: 'snapshot is required for this operation', nextSnapshot: null })
    process.exit(0)
  }

  if (op === 'turn') {
    const { snapshot: nextSnapshot, result } = await headlessInteractiveTurn(snapshot, {
      message: String(payload.message ?? ''),
    })
    writeResponse({
      ok: result.kind !== 'error',
      result,
      nextSnapshot,
      error: result.kind === 'error' ? result.error : undefined,
    })
    process.exit(0)
  }

  if (op === 'finalize') {
    const { snapshot: nextSnapshot, result } = await headlessInteractiveFinalize(snapshot, {
      note: payload.note != null ? String(payload.note) : undefined,
    })
    writeResponse({
      ok: result.kind !== 'error',
      result,
      nextSnapshot,
      error: result.kind === 'error' ? result.error : undefined,
    })
    process.exit(0)
  }

  if (op === 'accept') {
    const { snapshot: nextSnapshot, result } = headlessInteractiveAccept(snapshot)
    writeResponse({
      ok: result.kind !== 'error',
      result,
      nextSnapshot,
      error: result.kind === 'error' ? result.error : undefined,
    })
    process.exit(0)
  }

  if (op === 'play') {
    const { snapshot: nextSnapshot, result } = headlessInteractivePlay(snapshot, {
      task: String(payload.task ?? ''),
    })
    writeResponse({
      ok: result.kind !== 'error',
      result,
      nextSnapshot,
      error: result.kind === 'error' ? result.error : undefined,
    })
    process.exit(0)
  }

  if (op === 'cancel') {
    const nextSnapshot = headlessInteractiveCancel(snapshot)
    writeResponse({ ok: true, result: { kind: 'assistant_message', assistantMessage: '' }, nextSnapshot })
    process.exit(0)
  }

  writeResponse({ ok: false, error: `Unknown op: ${op}`, nextSnapshot: snapshot })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  writeResponse({
    ok: false,
    error: message,
    nextSnapshot: request.snapshot ?? null,
  })
  process.exit(1)
}
