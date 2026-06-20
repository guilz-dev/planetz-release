import { cn } from './ui/cn'

/**
 * `compact` is the dense report/preview sizing; `comfortable` is the larger,
 * more readable sizing used for chat answers.
 */
type MarkdownSize = 'compact' | 'comfortable'

interface ReportMarkdownContentProps {
  content: string
  className?: string
  /** When set, only the first N source lines are rendered (preview mode). */
  maxSourceLines?: number
  /** Controls the overall font scale. Defaults to `compact`. */
  size?: MarkdownSize
}

const SIZES = {
  compact: {
    root: 'text-[11.5px]',
    inlineCode: 'text-[10px]',
    code: 'text-[10.5px]',
    table: 'text-[11px]',
    h1: 'text-sm font-semibold',
    h2: 'text-xs font-semibold',
    h3: 'text-xs font-medium',
  },
  comfortable: {
    root: 'text-[14px]',
    inlineCode: 'text-[12px]',
    code: 'text-[12px]',
    table: 'text-[13px]',
    h1: 'text-[17px] font-semibold',
    h2: 'text-[15px] font-semibold',
    h3: 'text-[13px] font-medium',
  },
} as const

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }

/** A markdown table row: `| a | b |`. The leading/trailing pipes are optional. */
function isTableRow(line: string): boolean {
  return /\|/.test(line) && /^\s*\|?.*\|.*$/.test(line.trim())
}

/** The `|---|:--:|` delimiter line that separates a table header from its body. */
function isTableDelimiter(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line)
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const heading = line.match(/^(#{1,3})\s+(.+)/)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      })
      i += 1
      continue
    }
    if (line.trim().startsWith('```')) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        code.push(lines[i] ?? '')
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    // Table: a row line immediately followed by a `|---|` delimiter line.
    if (isTableRow(line) && isTableDelimiter(lines[i + 1] ?? '')) {
      const header = splitTableCells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i] ?? '') && (lines[i] ?? '').trim() !== '') {
        rows.push(splitTableCells(lines[i] ?? ''))
        i += 1
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        const item = (lines[i] ?? '').replace(/^\s*[-*]\s+/, '').trim()
        if (item) items.push(item)
        i += 1
      }
      if (items.length > 0) blocks.push({ kind: 'list', items })
      continue
    }
    if (line.trim() === '') {
      i += 1
      continue
    }
    const para: string[] = [line]
    i += 1
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,3})\s/.test(lines[i] ?? '')
    ) {
      if (/^\s*[-*]\s+/.test(lines[i] ?? '')) break
      if ((lines[i] ?? '').trim().startsWith('```')) break
      if (isTableRow(lines[i] ?? '') && isTableDelimiter(lines[i + 1] ?? '')) break
      para.push(lines[i] ?? '')
      i += 1
    }
    blocks.push({ kind: 'paragraph', text: para.join('\n') })
  }
  return blocks
}

function truncateSource(content: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = content.split('\n')
  if (lines.length <= maxLines) return { text: content, truncated: false }
  return { text: lines.slice(0, maxLines).join('\n'), truncated: true }
}

function InlineText({ text, inlineCodeSize }: { text: string; inlineCodeSize: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={`${index}-${part}`}
              className={cn(
                'break-all rounded bg-[var(--color-panel-strong)] px-1 py-0.5 font-mono',
                inlineCodeSize,
              )}
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        const boldSplit = part.split(/(\*\*[^*]+\*\*)/g)
        return boldSplit.map((segment, j) => {
          if (segment.startsWith('**') && segment.endsWith('**')) {
            return (
              <strong
                key={`${index}-${j}`}
                className="font-semibold text-[var(--color-text-strong)]"
              >
                {segment.slice(2, -2)}
              </strong>
            )
          }
          return <span key={`${index}-${j}`}>{segment}</span>
        })
      })}
    </>
  )
}

export function ReportMarkdownContent({
  content,
  className,
  maxSourceLines,
  size = 'compact',
}: ReportMarkdownContentProps) {
  const { text, truncated } =
    maxSourceLines != null
      ? truncateSource(content, maxSourceLines)
      : { text: content, truncated: false }
  const blocks = parseBlocks(text)
  const sizes = SIZES[size]

  return (
    <div className={cn('leading-relaxed text-[var(--color-text)]', sizes.root, className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
          const headingSize = block.level === 1 ? sizes.h1 : block.level === 2 ? sizes.h2 : sizes.h3
          return (
            <Tag
              key={index}
              className={cn('mt-2 first:mt-0 text-[var(--color-text-strong)]', headingSize)}
            >
              <InlineText text={block.text} inlineCodeSize={sizes.inlineCode} />
            </Tag>
          )
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="my-1.5 ml-4 list-disc space-y-0.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} inlineCodeSize={sizes.inlineCode} />
                </li>
              ))}
            </ul>
          )
        }
        if (block.kind === 'code') {
          return (
            <pre
              key={index}
              className={cn(
                'my-2 overflow-x-auto rounded border border-[var(--color-border)] bg-[var(--color-panel)]/50 p-2 font-mono whitespace-pre-wrap break-all',
                sizes.code,
              )}
            >
              {block.text}
            </pre>
          )
        }
        if (block.kind === 'table') {
          return (
            <div
              key={index}
              className="my-2 overflow-x-auto rounded border border-[var(--color-border)]"
            >
              <table className={cn('w-full border-collapse text-left', sizes.table)}>
                <thead>
                  <tr className="bg-[var(--color-panel)]/60">
                    {block.header.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="border-b border-[var(--color-border)] px-2 py-1 font-semibold text-[var(--color-text-strong)]"
                      >
                        <InlineText text={cell} inlineCodeSize={sizes.inlineCode} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-[var(--color-border)]/40 last:border-0"
                    >
                      {block.header.map((_, cellIndex) => (
                        <td key={cellIndex} className="px-2 py-1 align-top">
                          <InlineText
                            text={row[cellIndex] ?? ''}
                            inlineCodeSize={sizes.inlineCode}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p key={index} className="my-1.5 whitespace-pre-wrap break-words">
            <InlineText text={block.text} inlineCodeSize={sizes.inlineCode} />
          </p>
        )
      })}
      {truncated ? (
        <p aria-hidden className="mt-1 text-[var(--color-muted)] select-none">
          …
        </p>
      ) : null}
    </div>
  )
}
