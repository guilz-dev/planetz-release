import type { WorkflowDiagnostic, WorkflowSummary } from '@planetz/shared'
import { planetzWorkflowRelPath } from '@planetz/shared'
import {
  validateYamlLocally,
  workflowError,
  workflowFormFieldsFromYaml,
  workflowStepSummaryFields,
} from '../lib/workflow-yaml-utils.js'
import { PLANETZ_FALLBACK_BUILTIN_NAMES } from '../takt/builtin-workflow-yaml.js'
import { type BuiltinFacetCatalog, listBuiltinFacetCatalog } from '../takt/facet-resolver.js'
import { findWorkflowFixture, WORKFLOW_FIXTURES, type WorkflowFixture } from './workflows-mock.js'

const BUILTIN_NAMES = new Set<string>(PLANETZ_FALLBACK_BUILTIN_NAMES)

export class WorkflowMockManager {
  private fixtures: WorkflowFixture[] = WORKFLOW_FIXTURES.map((f) => ({ ...f }))

  list(): WorkflowSummary[] {
    return this.fixtures.map((f) => {
      const diagnostics = this.validateYaml(f.summary.name, f.yaml)
      const { formEditable, formMode } = workflowFormFieldsFromYaml(f.yaml)
      return {
        ...f.summary,
        isOverridden:
          f.summary.source === 'project' && BUILTIN_NAMES.has(f.summary.name)
            ? true
            : f.summary.isOverridden,
        diagnostics: diagnostics.filter((d) => d.level !== 'error'),
        formEditable: formEditable && !diagnostics.some((d) => d.level === 'error'),
        formMode,
      }
    })
  }

  read(
    nameOrPath: string,
    preferredSource?: WorkflowSummary['source'],
  ): { source: WorkflowSummary['source']; path?: string; yaml: string } {
    const byName = this.fixtures.filter((f) => f.summary.name === nameOrPath)
    const fixture =
      (preferredSource ? byName.find((f) => f.summary.source === preferredSource) : undefined) ??
      findWorkflowFixture(nameOrPath) ??
      this.findByPath(nameOrPath)
    if (!fixture) {
      throw workflowError('cli_failed', `workflow not found: ${nameOrPath}`, nameOrPath)
    }
    return { source: fixture.summary.source, path: fixture.summary.path, yaml: fixture.yaml }
  }

  writeProject(name: string, yaml: string, _facetFiles?: Record<string, string>): { path: string } {
    const trimmed = name.trim()
    if (!trimmed) {
      throw workflowError('yaml_parse_error', 'workflow name is empty', name)
    }
    const diagnostics = this.validateYaml(trimmed, yaml)
    const errors = diagnostics.filter((d) => d.level === 'error')
    if (errors.length > 0) {
      throw workflowError(
        errors[0].code ?? 'doctor_validation_error',
        errors[0].message,
        errors[0].path,
        diagnostics,
      )
    }
    const path = planetzWorkflowRelPath(trimmed)
    const existingIdx = this.fixtures.findIndex((f) => f.summary.name === trimmed)
    const { steps, stepNames, agentRoles } = workflowStepSummaryFields(yaml)
    const summary: WorkflowSummary = {
      name: trimmed,
      source: 'project',
      path,
      description: 'Updated via UI (mock)',
      stepNames,
      agentRoles,
      steps,
      isOverridden: existingIdx >= 0 && this.fixtures[existingIdx].summary.source !== 'project',
      diagnostics: diagnostics.filter((d) => d.level !== 'error'),
    }
    const next = { summary, yaml }
    if (existingIdx >= 0) {
      this.fixtures = this.fixtures.map((f, i) => (i === existingIdx ? next : f))
    } else {
      this.fixtures = [...this.fixtures, next]
    }
    return { path }
  }

  readFacets(managedPaths: string[]): Array<{
    managedPath: string
    source: 'missing'
    content: null
  }> {
    return managedPaths.map((managedPath) => ({
      managedPath,
      source: 'missing' as const,
      content: null,
    }))
  }

  async listBuiltinFacets(): Promise<BuiltinFacetCatalog> {
    return listBuiltinFacetCatalog()
  }

  validate(nameOrPath: string, yaml?: string): WorkflowDiagnostic[] {
    const text = yaml ?? findWorkflowFixture(nameOrPath)?.yaml ?? ''
    return this.validateYaml(nameOrPath, text)
  }

  private findByPath(value: string): WorkflowFixture | undefined {
    return this.fixtures.find((f) => f.summary.path === value)
  }

  private validateYaml(name: string, yaml: string): WorkflowDiagnostic[] {
    const diagnostics = validateYamlLocally(name, yaml)
    if (diagnostics.some((d) => d.level === 'error')) return diagnostics
    if (!/^\s*initial_step\s*:/m.test(yaml)) {
      diagnostics.push({
        level: 'warn',
        message: '`initial_step:` is not set — first step will be used',
        code: 'doctor_validation_error',
      })
    }
    if (yaml.includes('\t')) {
      diagnostics.push({
        level: 'warn',
        message: 'tabs detected — YAML prefers spaces',
        code: 'yaml_parse_error',
      })
    }
    const nameMatch = yaml.match(/^\s*name\s*:\s*([^\s#]+)/m)
    if (nameMatch && nameMatch[1] !== name) {
      diagnostics.push({
        level: 'info',
        message: `file name "${name}" differs from workflow name "${nameMatch[1]}"`,
      })
    }
    return diagnostics
  }
}
