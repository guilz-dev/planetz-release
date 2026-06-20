/** Dot-separated path through a nested message object (leaf values are strings). */
export type MessageKey<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
    }[keyof T & string]

export type MessageParams = Readonly<Record<string, string | number>>

function formatTemplate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name]
    return value === undefined ? `{${name}}` : String(value)
  })
}

/** Resolves a dot-separated key against a nested message tree. */
export function resolveMessage<T extends object>(
  tree: T,
  key: string,
  params?: MessageParams,
): string {
  const parts = key.split('.')
  let node: unknown = tree
  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      return key
    }
    node = (node as Record<string, unknown>)[part]
  }
  if (typeof node !== 'string') return key
  return formatTemplate(node, params)
}

/** Flattens nested message trees to dot keys for parity tests. */
export function flattenMessageKeys(tree: object, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      keys.push(path)
    } else if (value && typeof value === 'object') {
      keys.push(...flattenMessageKeys(value as object, path))
    }
  }
  return keys.sort()
}
