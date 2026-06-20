import type { RoutingGroup } from '@planetz/shared'

/** Maps builtin workflow category labels to Auto routing groups. */
export function categoriesToRoutingGroups(categories?: string[]): RoutingGroup[] {
  if (!categories?.length) return ['general']
  const groups = new Set<RoutingGroup>()
  for (const category of categories) {
    const lower = category.toLowerCase()
    if (/(bug|fix|hotfix|defect)/.test(lower)) groups.add('bugfix')
    else if (/(feature|implement|product)/.test(lower)) groups.add('feature')
    else if (/refactor/.test(lower)) groups.add('refactor')
    else if (/(doc|documentation|readme)/.test(lower)) groups.add('docs')
    else if (/(ops|deploy|infra|ci|release|terraform|pulumi|iac)/.test(lower)) groups.add('ops')
    else if (/(research|spike|explore)/.test(lower)) groups.add('research')
    else if (/(review|audit)/.test(lower)) groups.add('review')
    else groups.add('general')
  }
  if (groups.size === 0) return ['general']
  return [...groups]
}

/** Infers routing groups from a workflow name when category metadata is missing or generic. */
export function routingGroupsFromWorkflowName(name: string): RoutingGroup[] {
  const lower = name.trim().toLowerCase()
  if (!lower) return []

  if (
    /(terraform|terragrunt|pulumi|cloudformation|cdktf|ansible|helmfile|packer)/.test(lower) ||
    /(^|[/_-])(infra|iac|k8s|kubernetes|helm)([/_-]|$)/.test(lower)
  ) {
    return ['ops']
  }
  if (/(^|[/_-])(audit|review)([/_-]|$)/.test(lower)) return ['review']
  if (/(^|[/_-])(research|spike)([/_-]|$)/.test(lower)) return ['research']
  if (/(^|[/_-])(bugfix|hotfix)([/_-]|$)/.test(lower)) return ['bugfix']
  // Fallback when catalog metadata is absent; explicit rows use workflow-routing-metadata.ts.
  if (/(^|[/_-])spec-driven([/_-]|$)/.test(lower)) return ['feature']
  return []
}

function isGeneralOnly(groups: RoutingGroup[]): boolean {
  return groups.length === 1 && groups[0] === 'general'
}

/** Resolves catalog routing groups from workflow categories and name hints. */
export function routingGroupsForWorkflow(name: string, categories?: string[]): RoutingGroup[] {
  const fromCategories = categoriesToRoutingGroups(categories)
  const fromName = routingGroupsFromWorkflowName(name)
  if (fromName.length === 0) return fromCategories
  if (isGeneralOnly(fromCategories)) return fromName

  const merged = new Set<RoutingGroup>([...fromCategories, ...fromName])
  return [...merged]
}
