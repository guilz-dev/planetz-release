import type { RoutingTargetSurface } from './workflow-structure-routing-schema.js'

/** Canonical surface keyword map for prompt fallback and workflow YAML feature extraction. */
export const ROUTING_SURFACE_HINTS: ReadonlyArray<
  readonly [RoutingTargetSurface, readonly string[]]
> = [
  ['frontend', ['frontend', 'ui', 'react', 'css', 'component', 'tailwind', '画面']],
  [
    'backend',
    ['backend', 'api', 'server', 'endpoint', 'rest', 'graphql', 'database', 'db', 'schema'],
  ],
  ['fullstack', ['fullstack', 'e2e', 'end to end', 'integration test']],
  ['infra', ['infra', 'deploy', 'ci', 'pipeline', 'terraform', 'kubernetes', 'k8s', 'docker']],
  ['security', ['security', 'auth', 'oauth', 'jwt', 'permission', '認証', 'authorization']],
  [
    'testing',
    [
      'test',
      'tests',
      'testing',
      'unit test',
      'unit-test',
      'playwright',
      'vitest',
      'jest',
      'テスト',
    ],
  ],
  ['cqrs', ['cqrs', 'command', 'query', 'event sourcing']],
]

/** Match a keyword against tokenized routing prompt text (avoids `latest` matching `test`). */
export function promptIncludesRoutingKeyword(normalizedPrompt: string, keyword: string): boolean {
  if (!keyword) return false
  if (keyword.includes(' ')) {
    return normalizedPrompt.includes(keyword)
  }
  for (const token of normalizedPrompt.split(/\s+/)) {
    if (token === keyword) return true
  }
  return false
}

/** True when the prompt mentions testing-related work. */
export function promptMentionsTesting(normalizedPrompt: string): boolean {
  const testingHints = ROUTING_SURFACE_HINTS.find(([surface]) => surface === 'testing')?.[1] ?? []
  return testingHints.some((hint) => promptIncludesRoutingKeyword(normalizedPrompt, hint))
}

/** Infer target surfaces from normalized routing prompt text. */
export function matchRoutingTargetSurfacesFromText(text: string): RoutingTargetSurface[] {
  if (text.length === 0) return ['general']

  const surfaces = new Set<RoutingTargetSurface>()
  for (const [surface, hints] of ROUTING_SURFACE_HINTS) {
    if (hints.some((hint) => promptIncludesRoutingKeyword(text, hint))) {
      surfaces.add(surface)
    }
  }

  if (surfaces.size === 0) return ['general']
  return [...surfaces].sort((a, b) => a.localeCompare(b))
}
