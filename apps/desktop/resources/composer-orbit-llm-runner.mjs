/**
 * Child-process runner: calls bundled orbit provider with JSON stdin/stdout.
 * Env: PLANETZ_ORBIT_MODULE_ROOT — orbit root with node_modules (e.g. third_party/orbit).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const orbitRoot = process.env.PLANETZ_ORBIT_MODULE_ROOT?.trim()
if (!orbitRoot) {
  process.stderr.write('PLANETZ_ORBIT_MODULE_ROOT is required\n')
  process.exit(1)
}

/** @typedef {{ provider: string; systemPrompt: string; prompt: string; cwd: string; model?: string; timeoutMs?: number }} RunnerInput */

const raw = readFileSync(0, 'utf8')
/** @type {RunnerInput} */
const input = JSON.parse(raw)

const { getProvider } = await import(
  pathToFileURL(join(orbitRoot, 'dist/infra/providers/index.js')).href
)

const provider = getProvider(input.provider)
const agent = provider.setup({ name: 'composer-assistant', systemPrompt: input.systemPrompt })
const timeoutMs = input.timeoutMs ?? 15_000
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), timeoutMs)

try {
  const result = await agent.call(input.prompt, {
    cwd: input.cwd,
    model: input.model,
    allowedTools: [],
    abortSignal: controller.signal,
  })
  process.stdout.write(
    JSON.stringify({
      status: result.status,
      content: result.content ?? '',
    }),
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(message)
  process.exit(1)
} finally {
  clearTimeout(timer)
}
