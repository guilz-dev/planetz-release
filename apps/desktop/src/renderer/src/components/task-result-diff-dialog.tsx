import type {
  DiffFileStatus,
  TaskResultDiffFile,
  TaskResultDiffLine,
  TaskResultDiffSummary,
} from '@planetz/shared'
import {
  AlertTriangle,
  ExternalLink,
  FileDiff,
  FileMinus,
  FilePen,
  FilePlus,
  FileX2,
  Search,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'

export type DiffLineKind = 'context' | 'add' | 'del' | 'hunk' | 'meta'

export type DiffViewMode = 'unified' | 'split'

/** Dim the directory (truncates first) and keep the basename always visible. */
function PathLabel({
  path,
  oldPath,
  strong,
}: {
  path: string
  oldPath?: string
  strong?: boolean
}) {
  const slash = path.lastIndexOf('/')
  const dir = slash >= 0 ? path.slice(0, slash + 1) : ''
  const base = slash >= 0 ? path.slice(slash + 1) : path
  const title = oldPath ? `${oldPath} → ${path}` : path
  return (
    <span className="flex min-w-0 items-baseline font-mono text-xs" title={title}>
      {oldPath ? (
        <span className="mr-1 shrink-0 text-[var(--color-muted)] line-through">{oldPath}</span>
      ) : null}
      {dir ? <span className="truncate text-[var(--color-muted)]">{dir}</span> : null}
      <span
        className={cn(
          'shrink-0',
          strong ? 'text-[var(--color-text-strong)]' : 'text-[var(--color-text)]',
        )}
      >
        {base}
      </span>
    </span>
  )
}

interface TaskResultDiffDialogProps {
  open: boolean
  onClose: () => void
  summary: TaskResultDiffSummary | null
  /** Currently loaded file body; undefined while the parent fetches it. */
  fileContent?: TaskResultDiffFile
  selectedPath?: string
  onSelectFile: (path: string) => void
  viewMode: DiffViewMode
  onViewModeChange: (mode: DiffViewMode) => void
  /** True while fileContent for selectedPath is being fetched. */
  loadingFile?: boolean
  /** Branch could not be resolved at all (root branch missing). */
  branchMissing?: boolean
  /** Invoked when the user opts to open the task worktree in the file manager. */
  onOpenWorktree?: () => void
}

const STATUS_META: Record<DiffFileStatus, { icon: typeof FilePen; tone: string; label: string }> = {
  added: { icon: FilePlus, tone: 'text-[var(--color-status-completed)]', label: 'Added' },
  modified: { icon: FilePen, tone: 'text-[var(--color-status-running)]', label: 'Modified' },
  deleted: { icon: FileMinus, tone: 'text-[var(--color-status-failed)]', label: 'Deleted' },
  renamed: { icon: FileDiff, tone: 'text-[var(--color-status-exceeded)]', label: 'Renamed' },
  binary: { icon: FileX2, tone: 'text-[var(--color-muted)]', label: 'Binary' },
}

const STATUS_BADGE_TONE: Record<DiffFileStatus, Parameters<typeof Badge>[0]['tone']> = {
  added: 'completed',
  modified: 'running',
  deleted: 'failed',
  renamed: 'exceeded',
  binary: 'neutral',
}

export function TaskResultDiffDialog({
  open,
  onClose,
  summary,
  fileContent,
  selectedPath,
  onSelectFile,
  viewMode,
  onViewModeChange,
  loadingFile = false,
  branchMissing = false,
  onOpenWorktree,
}: TaskResultDiffDialogProps) {
  const [query, setQuery] = useState('')

  const totals = useMemo(() => {
    const files = summary?.files ?? []
    return {
      count: files.length,
      additions: files.reduce((n, f) => n + f.additions, 0),
      deletions: files.reduce((n, f) => n + f.deletions, 0),
    }
  }, [summary])

  const visibleFiles = useMemo(() => {
    const files = summary?.files ?? []
    const q = query.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => f.path.toLowerCase().includes(q))
  }, [summary, query])

  const maxBar = useMemo(
    () => Math.max(1, ...(summary?.files ?? []).map((f) => f.additions + f.deletions)),
    [summary],
  )

  const empty = !branchMissing && summary !== null && summary.files.length === 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      title={
        <span className="flex items-center gap-2">
          <FileDiff size={16} className="text-[var(--color-accent)]" />
          Task result diff
        </span>
      }
      description={
        summary ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[var(--color-text)]">
              {summary.taskLabel ?? summary.taskId}
            </span>
            <span className="text-[var(--color-muted)]">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <span className="text-[var(--color-muted)]">{summary.baseRef}</span>
              <span className="text-[var(--color-muted)]">…</span>
              <span className="text-[var(--color-accent)]">{summary.branch}</span>
            </span>
            <span className="text-[var(--color-muted)]">·</span>
            <DiffStat additions={totals.additions} deletions={totals.deletions} />
            <span className="text-[var(--color-muted)]">
              {totals.count} {totals.count === 1 ? 'file' : 'files'}
            </span>
          </span>
        ) : null
      }
      bodyClassName="flex-1 min-h-0 overflow-hidden"
      footer={
        <p className="mr-auto text-[11px] text-[var(--color-muted)]">
          Read-only preview · Merge stays on the task card
        </p>
      }
    >
      {branchMissing ? (
        <DiffStateMessage
          tone="warning"
          icon={<AlertTriangle size={28} />}
          title="ブランチを参照できません"
          body="このタスクのブランチが root リポジトリに見つかりませんでした。ワークツリーを開いて確認してください。"
          action={
            onOpenWorktree ? (
              <Button
                variant="secondary"
                size="sm"
                leading={<ExternalLink size={13} />}
                onClick={onOpenWorktree}
              >
                ワークツリーで開く
              </Button>
            ) : null
          }
        />
      ) : empty ? (
        <DiffStateMessage
          tone="neutral"
          icon={<FileDiff size={28} />}
          title="差分はありません"
          body="このブランチとデフォルトブランチの間に変更はありませんでした。"
        />
      ) : (
        <div className="flex h-full min-h-0">
          {/* Left: file list */}
          <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]/40">
            <div className="border-b border-[var(--color-border)] p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter files…"
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
            {summary?.truncated ? (
              <div className="flex items-start gap-1.5 border-b border-[var(--color-status-exceeded)]/30 bg-[var(--color-status-exceeded-soft)] px-2.5 py-1.5 text-[10px] text-[var(--color-status-exceeded)]">
                <AlertTriangle size={12} className="mt-px shrink-0" />
                <span>ファイル数が上限を超えたため一部のみ表示しています。</span>
              </div>
            ) : null}
            <ul className="min-h-0 flex-1 overflow-auto py-1">
              {visibleFiles.map((file) => {
                const meta = STATUS_META[file.status]
                const Icon = meta.icon
                const active = file.path === selectedPath
                const bar = file.additions + file.deletions
                const addRatio = bar > 0 ? file.additions / bar : 0
                const width = Math.max(0.08, bar / maxBar)
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      onClick={() => onSelectFile(file.path)}
                      className={cn(
                        'flex w-full flex-col gap-1 px-2.5 py-1.5 text-left transition-colors',
                        active
                          ? 'bg-[var(--color-accent-soft)]'
                          : 'hover:bg-[var(--color-panel-strong)]',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon size={13} className={cn('shrink-0', meta.tone)} />
                        <PathLabel path={file.path} oldPath={file.oldPath} strong={active} />
                      </span>
                      <span className="flex items-center gap-2 pl-[19px]">
                        {file.binary ? (
                          <span className="text-[10px] text-[var(--color-muted)]">binary</span>
                        ) : (
                          <>
                            <span className="flex h-1 w-16 overflow-hidden rounded-full bg-[var(--color-panel-strong)]">
                              <span
                                className="h-full bg-[var(--color-status-completed)]"
                                style={{ width: `${width * addRatio * 100}%` }}
                              />
                              <span
                                className="h-full bg-[var(--color-status-failed)]"
                                style={{ width: `${width * (1 - addRatio) * 100}%` }}
                              />
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-[var(--color-status-completed)]">
                              +{file.additions}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-[var(--color-status-failed)]">
                              −{file.deletions}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
              {visibleFiles.length === 0 ? (
                <li className="px-3 py-6 text-center text-[11px] text-[var(--color-muted)]">
                  No files match “{query}”
                </li>
              ) : null}
            </ul>
          </aside>

          {/* Right: diff viewer */}
          <section className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                {fileContent ? (
                  <>
                    <Badge tone={STATUS_BADGE_TONE[fileContent.status]}>
                      {STATUS_META[fileContent.status].label}
                    </Badge>
                    <PathLabel path={fileContent.path} oldPath={fileContent.oldPath} />
                  </>
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">
                    ファイルを選択してください
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
                {onOpenWorktree ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    leading={<ExternalLink size={12} />}
                    onClick={onOpenWorktree}
                  >
                    Worktree
                  </Button>
                ) : null}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto bg-[var(--color-surface)]">
              <DiffBody
                file={fileContent}
                loading={loadingFile}
                viewMode={viewMode}
                onOpenWorktree={onOpenWorktree}
              />
            </div>
          </section>
        </div>
      )}
    </Dialog>
  )
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: DiffViewMode
  onChange: (mode: DiffViewMode) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)] p-0.5">
      {(['unified', 'split'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors',
            value === mode
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

function DiffBody({
  file,
  loading,
  viewMode,
  onOpenWorktree,
}: {
  file?: TaskResultDiffFile
  loading: boolean
  viewMode: DiffViewMode
  onOpenWorktree?: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-1.5 p-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-[var(--color-panel-strong)]/60 motion-reduce:animate-none"
            style={{ width: `${40 + ((i * 37) % 55)}%` }}
          />
        ))}
      </div>
    )
  }
  if (!file) return null

  if (file.binary) {
    return (
      <DiffStateMessage
        tone="neutral"
        icon={<FileX2 size={24} />}
        title="バイナリのため表示不可"
        body="このファイルはバイナリのため差分プレビューを表示できません。"
        action={
          onOpenWorktree ? (
            <Button
              variant="secondary"
              size="sm"
              leading={<ExternalLink size={13} />}
              onClick={onOpenWorktree}
            >
              ワークツリーで開く
            </Button>
          ) : null
        }
      />
    )
  }

  return (
    <>
      {viewMode === 'unified' ? (
        <UnifiedDiff lines={file.lines} />
      ) : (
        <SplitDiff lines={file.lines} />
      )}
      {file.truncated ? (
        <div className="flex items-center gap-2 border-t border-[var(--color-status-exceeded)]/30 bg-[var(--color-status-exceeded-soft)] px-3 py-2 text-xs text-[var(--color-status-exceeded)]">
          <AlertTriangle size={14} className="shrink-0" />
          <span>プレビュー上限を超過しました。続きはワークツリーで確認してください。</span>
          {onOpenWorktree ? (
            <button
              type="button"
              onClick={onOpenWorktree}
              className="ml-auto inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <ExternalLink size={12} /> ワークツリーで開く
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

const LINE_BG: Record<DiffLineKind, string> = {
  add: 'bg-[var(--color-status-completed-soft)]',
  del: 'bg-[var(--color-status-failed-soft)]',
  hunk: 'bg-[var(--color-accent-soft)]',
  context: '',
  meta: '',
}

const LINE_TEXT: Record<DiffLineKind, string> = {
  add: 'text-[var(--color-status-completed)]',
  del: 'text-[var(--color-status-failed)]',
  hunk: 'text-[var(--color-accent)]',
  context: 'text-[var(--color-text)]',
  meta: 'text-[var(--color-muted)]',
}

const SIGN: Record<DiffLineKind, string> = {
  add: '+',
  del: '−',
  hunk: '',
  context: ' ',
  meta: '',
}

function UnifiedDiff({ lines }: { lines: TaskResultDiffLine[] }) {
  return (
    <table className="w-full border-collapse font-mono text-[11.5px] leading-[1.55]">
      <tbody>
        {lines.map((line, i) => (
          <tr key={i} className={LINE_BG[line.kind]}>
            <td className="w-10 select-none border-r border-[var(--color-border)]/50 px-2 text-right align-top text-[var(--color-muted)]/70 tabular-nums">
              {line.kind === 'add' || line.kind === 'hunk' ? '' : (line.oldNo ?? '')}
            </td>
            <td className="w-10 select-none border-r border-[var(--color-border)]/50 px-2 text-right align-top text-[var(--color-muted)]/70 tabular-nums">
              {line.kind === 'del' || line.kind === 'hunk' ? '' : (line.newNo ?? '')}
            </td>
            <td className={cn('w-4 select-none text-center align-top', LINE_TEXT[line.kind])}>
              {SIGN[line.kind]}
            </td>
            <td
              className={cn(
                'whitespace-pre-wrap break-all px-1 pr-4 align-top',
                LINE_TEXT[line.kind],
              )}
            >
              {line.text || ' '}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface SplitRow {
  left?: TaskResultDiffLine
  right?: TaskResultDiffLine
  hunk?: TaskResultDiffLine
}

/** Pair removals with additions side-by-side; context lines align on both sides. */
function toSplitRows(lines: TaskResultDiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.kind === 'hunk' || line.kind === 'meta') {
      rows.push({ hunk: line })
      i += 1
      continue
    }
    if (line.kind === 'context') {
      rows.push({ left: line, right: line })
      i += 1
      continue
    }
    // Gather a run of dels then adds.
    const dels: TaskResultDiffLine[] = []
    const adds: TaskResultDiffLine[] = []
    while (i < lines.length && lines[i].kind === 'del') dels.push(lines[i++])
    while (i < lines.length && lines[i].kind === 'add') adds.push(lines[i++])
    const max = Math.max(dels.length, adds.length)
    for (let j = 0; j < max; j++) rows.push({ left: dels[j], right: adds[j] })
  }
  return rows
}

function SplitDiff({ lines }: { lines: TaskResultDiffLine[] }) {
  const rows = useMemo(() => toSplitRows(lines), [lines])
  return (
    <table className="w-full table-fixed border-collapse font-mono text-[11.5px] leading-[1.55]">
      <colgroup>
        <col className="w-8" />
        <col className="w-1/2" />
        <col className="w-8" />
        <col className="w-1/2" />
      </colgroup>
      <tbody>
        {rows.map((row, i) => {
          if (row.hunk) {
            return (
              <tr key={i} className={LINE_BG.hunk}>
                <td
                  colSpan={4}
                  className={cn('whitespace-pre-wrap break-all px-2', LINE_TEXT.hunk)}
                >
                  {row.hunk.text}
                </td>
              </tr>
            )
          }
          return (
            <tr key={i}>
              <SplitCell line={row.left} side="old" />
              <SplitCell line={row.right} side="new" />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SplitCell({ line, side }: { line?: TaskResultDiffLine; side: 'old' | 'new' }) {
  if (!line) {
    return (
      <>
        <td className="border-r border-[var(--color-border)]/50 bg-[var(--color-panel)]/30" />
        <td className="border-r border-[var(--color-border)]/50 bg-[var(--color-panel)]/30" />
      </>
    )
  }
  const no = side === 'old' ? line.oldNo : line.newNo
  return (
    <>
      <td
        className={cn(
          'w-8 select-none border-r border-[var(--color-border)]/50 px-1.5 text-right align-top text-[var(--color-muted)]/70 tabular-nums',
          LINE_BG[line.kind],
        )}
      >
        {no ?? ''}
      </td>
      <td
        className={cn(
          'whitespace-pre-wrap break-all border-r border-[var(--color-border)]/50 px-2 align-top',
          LINE_BG[line.kind],
          LINE_TEXT[line.kind],
        )}
      >
        {line.text || ' '}
      </td>
    </>
  )
}

function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
      <span className="text-[var(--color-status-completed)]">+{additions}</span>
      <span className="text-[var(--color-status-failed)]">−{deletions}</span>
    </span>
  )
}

function DiffStateMessage({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: 'neutral' | 'warning'
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className={cn(
          tone === 'warning' ? 'text-[var(--color-status-exceeded)]' : 'text-[var(--color-muted)]',
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-text-strong)]">{title}</p>
        <p className="max-w-sm text-xs text-[var(--color-muted)]">{body}</p>
      </div>
      {action}
    </div>
  )
}
