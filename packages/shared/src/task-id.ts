export function slugifyTaskId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return base || 'task'
}

export function uniqueTaskId(title: string, existing: Set<string>): string {
  const base = slugifyTaskId(title)
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
