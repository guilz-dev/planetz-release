import {
  TASK_RESULT_DIFF_BRANCH_NOT_READY_CODE,
  type TaskResultDiffFile,
  type TaskResultDiffSummary,
  type TaskViewModel,
} from '@planetz/shared'
import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { toErrorMessage } from '../lib/to-error-message.js'
import { usePushToast } from './use-toast'

const BRANCH_NOT_READY_PREFIX = `${TASK_RESULT_DIFF_BRANCH_NOT_READY_CODE}:`

interface DiffRequestContext {
  task: TaskViewModel
  taskId: string
  branch: string
}

export interface UseTaskResultDiffOptions {
  listTaskResultDiff?: (input: { taskId: string; branch: string }) => Promise<TaskResultDiffSummary>
  getTaskResultDiffFile?: (input: {
    taskId: string
    branch: string
    path: string
  }) => Promise<TaskResultDiffFile>
  onOpenWorkDir?: (task: TaskViewModel) => void | Promise<void>
}

function isBranchNotReadyError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const maybeCode = (error as { code?: unknown }).code
    if (maybeCode === TASK_RESULT_DIFF_BRANCH_NOT_READY_CODE) {
      return true
    }
    const cause = (error as { cause?: unknown }).cause
    if (cause && cause !== error && isBranchNotReadyError(cause)) {
      return true
    }
  }
  const message = toErrorMessage(error, '')
  return message.includes(BRANCH_NOT_READY_PREFIX)
}

export function useTaskResultDiff(options: UseTaskResultDiffOptions) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<TaskResultDiffSummary | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined)
  const [fileContent, setFileContent] = useState<TaskResultDiffFile | undefined>(undefined)
  const [loadingFile, setLoadingFile] = useState(false)
  const [branchMissing, setBranchMissing] = useState(false)
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split')
  const [request, setRequest] = useState<DiffRequestContext | null>(null)
  const fileRequestSeq = useRef(0)

  const loadFile = useCallback(
    async (path: string, contextOverride?: DiffRequestContext) => {
      const context = contextOverride ?? request
      if (!context || !options.getTaskResultDiffFile) return
      const requestId = ++fileRequestSeq.current
      setLoadingFile(true)
      try {
        const file = await options.getTaskResultDiffFile({
          taskId: context.taskId,
          branch: context.branch,
          path,
        })
        if (requestId !== fileRequestSeq.current) return
        setFileContent(file)
      } catch (error) {
        if (requestId !== fileRequestSeq.current) return
        pushToast({
          kind: 'error',
          title: t('panels.result.title'),
          message: toErrorMessage(error, t('panels.result.loadError')),
        })
      }
      if (requestId === fileRequestSeq.current) {
        setLoadingFile(false)
      }
    },
    [options.getTaskResultDiffFile, pushToast, request, t],
  )

  const openDiff = useCallback(
    async (task: TaskViewModel, branch: string) => {
      if (!options.listTaskResultDiff) return
      const initialContext: DiffRequestContext = { task, taskId: task.id, branch }
      fileRequestSeq.current += 1
      setOpen(true)
      setSummary(null)
      setSelectedPath(undefined)
      setFileContent(undefined)
      setBranchMissing(false)
      setViewMode('split')
      setRequest(initialContext)
      try {
        const nextSummary = await options.listTaskResultDiff({
          taskId: task.id,
          branch,
        })
        const nextContext: DiffRequestContext = {
          task,
          taskId: task.id,
          branch: nextSummary.branch,
        }
        setRequest(nextContext)
        setSummary(nextSummary)
        const firstPath = nextSummary.files[0]?.path
        setSelectedPath(firstPath)
        if (firstPath) {
          await loadFile(firstPath, nextContext)
        }
      } catch (error) {
        if (isBranchNotReadyError(error)) {
          setBranchMissing(true)
          return
        }
        pushToast({
          kind: 'error',
          title: t('panels.result.title'),
          message: toErrorMessage(error, t('panels.task.openWorkDirFailed')),
        })
        setOpen(false)
      }
    },
    [loadFile, options.listTaskResultDiff, pushToast, t],
  )

  const selectFile = useCallback(
    async (path: string) => {
      setSelectedPath(path)
      setFileContent(undefined)
      await loadFile(path)
    },
    [loadFile],
  )

  const closeDiff = useCallback(() => {
    fileRequestSeq.current += 1
    setOpen(false)
    setSummary(null)
    setSelectedPath(undefined)
    setFileContent(undefined)
    setLoadingFile(false)
    setBranchMissing(false)
    setRequest(null)
  }, [])

  const openWorkDir = useCallback(async () => {
    if (!request || !options.onOpenWorkDir) return
    await options.onOpenWorkDir(request.task)
  }, [options.onOpenWorkDir, request])

  return {
    open,
    summary,
    selectedPath,
    fileContent,
    loadingFile,
    branchMissing,
    viewMode,
    setViewMode,
    openDiff,
    selectFile,
    closeDiff,
    openWorkDir,
  }
}
