import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { UiConfig, WorkflowDiagnostic } from '@planetz/shared'
import { taktWorkflowDoctorCommand } from '../takt/commands.js'
import { outputText, runTaktCliInWorkspace } from '../takt/exec-cli.js'
import { materializeMissingFacetsForWorkflowYaml } from '../takt/facet-resolver.js'

function workflowBaseName(nameOrPath: string): string {
  const base = basename(nameOrPath)
  return base.replace(/\.(yaml|yml)$/i, '') || nameOrPath
}

function looksLikePath(value: string): boolean {
  return value.includes('/') || value.includes('\\') || /\.(yaml|yml)$/i.test(value)
}

function doctorDisplayTarget(nameOrPath: string): string {
  const base = workflowBaseName(nameOrPath)
  return `${base}.yaml`
}

function doctorTempFileName(nameOrPath: string): string {
  const safeName = workflowBaseName(nameOrPath).replace(/[^a-zA-Z0-9._-]/g, '_') || 'workflow'
  return `.planetz-wf-doctor-${safeName}.yaml`
}

function normalizeDoctorMessage(raw: string, doctorArg: string, nameOrPath: string): string {
  const display = doctorDisplayTarget(nameOrPath)
  const tempName = doctorTempFileName(nameOrPath)
  let out = raw.split(doctorArg).join(display)
  out = out.split(tempName).join(display)
  out = out.split(basename(doctorArg)).join(display)
  const pathPattern = new RegExp(
    `(?:[A-Za-z]:)?[/\\\\][^\\s:\\]\\"'\\n]+[/\\\\]${display.replace(/\./g, '\\.')}`,
    'g',
  )
  return out.replace(pathPattern, display)
}

function parseDoctorDiagnostics(
  raw: string,
  doctorArg: string,
  nameOrPath: string,
): WorkflowDiagnostic[] {
  const normalized = normalizeDoctorMessage(raw, doctorArg, nameOrPath)
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return [
      {
        level: 'error',
        message: 'workflow doctor failed',
        code: 'doctor_validation_error',
      },
    ]
  }

  return lines.map((line) => {
    if (line.startsWith('[WARN]')) {
      return {
        level: 'warn' as const,
        message: line.replace(/^\[WARN\]\s*/, ''),
        code: 'doctor_validation_error' as const,
      }
    }
    if (line.startsWith('[ERROR]')) {
      return {
        level: 'error' as const,
        message: line.replace(/^\[ERROR\]\s*/, ''),
        code: 'doctor_validation_error' as const,
      }
    }
    return {
      level: 'error' as const,
      message: line,
      code: 'doctor_validation_error' as const,
    }
  })
}

export interface RunWorkflowDoctorOptions {
  /**
   * Directory for temporary inline YAML. Must sit next to the facets root that takt doctor allows
   * (typically `<taktCwd>/.takt/workflows` so `../facets/...` resolves to `.takt/facets/...`).
   */
  inlineYamlBaseDir?: string
  /** Facets root populated before doctor (typically `<taktCwd>/.takt/facets`). */
  doctorFacetsDir?: string
  /** Optional `.planetz/orbit/facets` tree to copy from before bundled orbit fallback. */
  fallbackFacetsDir?: string
}

/** YAML passed to doctor: explicit inline body wins over a resolved workflow read. */
export function resolveDoctorInlineYaml(resolvedYaml: string, inlineYaml?: string): string {
  return inlineYaml ?? resolvedYaml
}

/** Run `takt workflow doctor` against a workflow name/path or inline YAML (materialized to a temp file). */
export async function runWorkflowDoctor(
  config: UiConfig,
  cwd: string,
  nameOrPath: string,
  yaml?: string,
  options?: RunWorkflowDoctorOptions,
): Promise<WorkflowDiagnostic[]> {
  let doctorArg = nameOrPath
  let tempFile: string | null = null

  if (yaml !== undefined) {
    if (options?.doctorFacetsDir) {
      await materializeMissingFacetsForWorkflowYaml(options.doctorFacetsDir, yaml, {
        fallbackFacetsRoot: options.fallbackFacetsDir,
      })
    }

    const pathBaseDir = looksLikePath(nameOrPath) ? dirname(nameOrPath) : null
    const preferredBaseDir = pathBaseDir || options?.inlineYamlBaseDir || tmpdir()
    await mkdir(preferredBaseDir, { recursive: true })

    tempFile = join(preferredBaseDir, doctorTempFileName(nameOrPath))
    await writeFile(tempFile, yaml, 'utf8')
    doctorArg = tempFile
  }

  try {
    const args = taktWorkflowDoctorCommand(doctorArg)
    const result = await runTaktCliInWorkspace(config, cwd, args, {
      cwd,
      reject: false,
    })
    if (result.exitCode === 0) return []
    const raw = outputText(result.stderr) || outputText(result.stdout) || 'workflow doctor failed'
    return parseDoctorDiagnostics(raw, doctorArg, nameOrPath)
  } catch {
    return []
  } finally {
    if (tempFile) {
      await rm(tempFile, { force: true }).catch(() => undefined)
    }
  }
}
