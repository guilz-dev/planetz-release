import type { TaskResultDiffLine } from '@planetz/shared'

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const encoded = Buffer.from(text, 'utf8')
  if (encoded.length <= maxBytes) return { text, truncated: false }
  return { text: encoded.subarray(0, maxBytes).toString('utf8'), truncated: true }
}

function normalizeLineNo(value: number): number | undefined {
  return value >= 1 ? value : undefined
}

export function parseGitUnifiedDiff(
  rawDiff: string,
  maxBytes: number,
): { lines: TaskResultDiffLine[]; truncated: boolean } {
  const limited = truncateUtf8(rawDiff, maxBytes)
  const lines: TaskResultDiffLine[] = []
  const sourceLines = limited.text.split('\n')
  let inHunk = false
  let oldCursor = 0
  let newCursor = 0

  for (const line of sourceLines) {
    if (line.startsWith('@@ ')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      oldCursor = match ? Number(match[1]) : 0
      newCursor = match ? Number(match[2]) : 0
      inHunk = true
      lines.push({ kind: 'hunk', text: line })
      continue
    }

    if (inHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        lines.push({
          kind: 'add',
          newNo: normalizeLineNo(newCursor),
          text: line.slice(1),
        })
        newCursor += 1
        continue
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        lines.push({
          kind: 'del',
          oldNo: normalizeLineNo(oldCursor),
          text: line.slice(1),
        })
        oldCursor += 1
        continue
      }
      if (line.startsWith(' ')) {
        lines.push({
          kind: 'context',
          oldNo: normalizeLineNo(oldCursor),
          newNo: normalizeLineNo(newCursor),
          text: line.slice(1),
        })
        oldCursor += 1
        newCursor += 1
        continue
      }
      if (line.startsWith('\\ ')) {
        lines.push({ kind: 'meta', text: line })
        continue
      }
    }

    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('rename from ') ||
      line.startsWith('rename to ') ||
      line.startsWith('new file mode ') ||
      line.startsWith('deleted file mode ') ||
      line.startsWith('similarity index ') ||
      line.startsWith('dissimilarity index ') ||
      line.startsWith('Binary files ')
    ) {
      lines.push({ kind: 'meta', text: line })
    }
  }

  return { lines, truncated: limited.truncated }
}
