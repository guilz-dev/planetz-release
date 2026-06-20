import type { FacetKind, ProjectFacetSummary } from '@planetz/shared'
import { catalogFacetKey, emptyBuiltinFacetCatalog, FACET_KINDS } from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FacetTreeItemData } from './facet-tree-pane'

function emptyItemsByKind(): Record<FacetKind, FacetTreeItemData[]> {
  return {
    personas: [],
    policies: [],
    knowledge: [],
    instructions: [],
    reportFormats: [],
  }
}

function normalizeBuiltinFacetCatalog(value: unknown): Record<FacetKind, string[]> {
  const fallback = emptyBuiltinFacetCatalog()
  if (!value || typeof value !== 'object') return fallback
  const record = value as Record<string, unknown>
  return {
    personas: Array.isArray(record.personas)
      ? record.personas.filter((v) => typeof v === 'string')
      : [],
    policies: Array.isArray(record.policies)
      ? record.policies.filter((v) => typeof v === 'string')
      : [],
    knowledge: Array.isArray(record.knowledge)
      ? record.knowledge.filter((v) => typeof v === 'string')
      : [],
    instructions: Array.isArray(record.instructions)
      ? record.instructions.filter((v) => typeof v === 'string')
      : [],
    reportFormats: Array.isArray(record.reportFormats)
      ? record.reportFormats.filter((v) => typeof v === 'string')
      : [],
  }
}

function normalizeProjectFacets(value: unknown): ProjectFacetSummary[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ProjectFacetSummary => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return (
      typeof record.kind === 'string' &&
      FACET_KINDS.includes(record.kind as FacetKind) &&
      typeof record.key === 'string' &&
      typeof record.managedPath === 'string'
    )
  })
}

export interface FacetSelection {
  kind: FacetKind
  key: string
}

function migrateStringMap(
  map: Record<string, string>,
  kind: FacetKind,
  fromKey: string,
  toKey: string,
): Record<string, string> {
  if (fromKey === toKey) return map
  const fromId = catalogFacetKey(kind, fromKey)
  const toId = catalogFacetKey(kind, toKey)
  if (!(fromId in map)) return map
  const next = { ...map }
  next[toId] = next[fromId]
  delete next[fromId]
  return next
}

function migrateLoadedId(
  loaded: Set<string>,
  kind: FacetKind,
  fromKey: string,
  toKey: string,
): void {
  if (fromKey === toKey) return
  const fromId = catalogFacetKey(kind, fromKey)
  const toId = catalogFacetKey(kind, toKey)
  if (!loaded.has(fromId)) return
  loaded.delete(fromId)
  loaded.add(toId)
}

type FacetUsageSummary = {
  workflowCount: number
  stepCount: number
  workflowNames: string[]
}

function migrateUsageMap(
  map: Record<string, FacetUsageSummary>,
  kind: FacetKind,
  fromKey: string,
  toKey: string,
): Record<string, FacetUsageSummary> {
  if (fromKey === toKey) return map
  const fromId = catalogFacetKey(kind, fromKey)
  const toId = catalogFacetKey(kind, toKey)
  if (!(fromId in map)) return map
  const next = { ...map }
  next[toId] = next[fromId]
  delete next[fromId]
  return next
}

export function useFacetCatalog(options?: { showBuiltin?: boolean }) {
  const [showBuiltin, setShowBuiltin] = useState(options?.showBuiltin ?? true)
  const [projectFacets, setProjectFacets] = useState<ProjectFacetSummary[]>([])
  const [builtinCatalog, setBuiltinCatalog] = useState<Record<FacetKind, string[]>>(
    emptyBuiltinFacetCatalog(),
  )
  const [selected, setSelected] = useState<FacetSelection | null>(null)
  const [collapsed, setCollapsed] = useState<Set<FacetKind>>(() => new Set(FACET_KINDS))
  const [pendingDraft, setPendingDraft] = useState<FacetSelection | null>(null)
  const [contentByKey, setContentByKey] = useState<Record<string, string>>({})
  const [savedContentByKey, setSavedContentByKey] = useState<Record<string, string>>({})
  const [usageByKey, setUsageByKey] = useState<Record<string, FacetUsageSummary>>({})
  const [loading, setLoading] = useState(true)
  const [builtinCatalogLoading, setBuiltinCatalogLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedIdsRef = useRef<Set<string>>(new Set())
  const diskKeyRef = useRef<string | null>(null)

  const refreshProjectFacets = useCallback(async (opts?: { initial?: boolean }) => {
    const isInitial = opts?.initial ?? false
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const items = await window.orbit.listProjectFacets()
      setProjectFacets(normalizeProjectFacets(items))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (isInitial) setLoading(false)
      else setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refreshProjectFacets({ initial: true })
    void Promise.resolve()
      .then(() => window.orbit.listWorkflowBuiltinFacets())
      .then((catalog) => {
        setBuiltinCatalog(normalizeBuiltinFacetCatalog(catalog))
      })
      .catch(() => {
        // keep project-only list
      })
      .finally(() => {
        setBuiltinCatalogLoading(false)
      })
  }, [refreshProjectFacets])

  const itemsByKind = useMemo(() => {
    const out = emptyItemsByKind()
    const projectKeysByKind: Record<FacetKind, Set<string>> = {
      personas: new Set(),
      policies: new Set(),
      knowledge: new Set(),
      instructions: new Set(),
      reportFormats: new Set(),
    }

    for (const pf of projectFacets) {
      projectKeysByKind[pf.kind].add(pf.key)
      const usage = usageByKey[catalogFacetKey(pf.kind, pf.key)]
      out[pf.kind].push({
        kind: pf.kind,
        key: pf.key,
        source: 'project',
        workflowReferences: usage?.workflowCount,
        stepReferences: usage?.stepCount,
      })
    }

    if (showBuiltin) {
      for (const kind of FACET_KINDS) {
        for (const key of builtinCatalog[kind] ?? []) {
          if (projectKeysByKind[kind].has(key)) continue
          out[kind].push({ kind, key, source: 'builtin' })
        }
      }
    }

    for (const kind of FACET_KINDS) {
      out[kind].sort((a, b) => a.key.localeCompare(b.key))
    }

    if (pendingDraft && !pendingDraft.key) {
      out[pendingDraft.kind].unshift({
        kind: pendingDraft.kind,
        key: '',
        source: 'project',
      })
    }

    return out
  }, [projectFacets, builtinCatalog, showBuiltin, usageByKey, pendingDraft])

  const selectFacet = useCallback(
    (selection: FacetSelection, source: 'project' | 'builtin' | 'draft') => {
      setSelected(selection)
      diskKeyRef.current =
        source === 'project' && selection.key ? selection.key : source === 'draft' ? null : null
      if (source !== 'draft') setPendingDraft(null)
    },
    [],
  )

  useEffect(() => {
    if (loading || builtinCatalogLoading || !selected) return
    const still = itemsByKind[selected.kind].some((i) => i.key === selected.key)
    if (still) return
    const id = catalogFacetKey(selected.kind, selected.key)
    if (loadedIdsRef.current.has(id) || pendingDraft?.kind === selected.kind) return
    setSelected(null)
    diskKeyRef.current = null
  }, [itemsByKind, selected, pendingDraft, loading, builtinCatalogLoading])

  useEffect(() => {
    if (!selected?.key) return
    const id = catalogFacetKey(selected.kind, selected.key)
    if (loadedIdsRef.current.has(id)) return
    loadedIdsRef.current.add(id)
    let cancelled = false
    void Promise.resolve()
      .then(() => window.orbit.readFacet({ kind: selected.kind, key: selected.key }))
      .then((doc) => {
        if (cancelled) return
        const content = doc.content ?? ''
        setContentByKey((prev) => ({ ...prev, [id]: content }))
        setSavedContentByKey((prev) => ({ ...prev, [id]: content }))
        if (doc.source === 'project') {
          diskKeyRef.current = selected.key
        }
      })
      .catch(() => {
        loadedIdsRef.current.delete(id)
      })
    void Promise.resolve()
      .then(() => window.orbit.listFacetUsages({ kind: selected.kind, key: selected.key }))
      .then((usage) => {
        if (cancelled) return
        setUsageByKey((prev) => ({ ...prev, [id]: usage }))
      })
      .catch(() => {
        // ignore usage errors
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const selectedItem = selected
    ? (itemsByKind[selected.kind].find((i) => i.key === selected.key) ?? null)
    : null

  const selectedContent = selected
    ? (contentByKey[catalogFacetKey(selected.kind, selected.key)] ?? '')
    : ''

  const selectedDirty = selected
    ? selectedContent !== (savedContentByKey[catalogFacetKey(selected.kind, selected.key)] ?? '')
    : false

  function renameSelectedKey(nextKey: string): void {
    if (!selected) return
    const prevKey = selected.key
    if (prevKey === nextKey) return
    setContentByKey((prev) => migrateStringMap(prev, selected.kind, prevKey, nextKey))
    setSavedContentByKey((prev) => migrateStringMap(prev, selected.kind, prevKey, nextKey))
    setUsageByKey((prev) => migrateUsageMap(prev, selected.kind, prevKey, nextKey))
    migrateLoadedId(loadedIdsRef.current, selected.kind, prevKey, nextKey)
    setSelected({ kind: selected.kind, key: nextKey })
  }

  const setSelectedFromUi = useCallback(
    (selection: FacetSelection) => {
      const isProject = projectFacets.some(
        (pf) => pf.kind === selection.kind && pf.key === selection.key,
      )
      const isDraft = pendingDraft?.kind === selection.kind && !selection.key
      selectFacet(selection, isDraft ? 'draft' : isProject ? 'project' : 'builtin')
    },
    [projectFacets, pendingDraft, selectFacet],
  )

  async function saveContent(kind: FacetKind, key: string, content: string): Promise<void> {
    setBusy(true)
    setError(null)
    const priorDiskKey = diskKeyRef.current
    const writingSelectedFacet = selected?.kind === kind && selected.key === key
    try {
      await window.orbit.writeProjectFacet({ kind, key, content })
      if (writingSelectedFacet && priorDiskKey && priorDiskKey !== key) {
        await window.orbit.deleteProjectFacet({ kind, key: priorDiskKey })
      }
      const id = catalogFacetKey(kind, key)
      setContentByKey((prev) => ({ ...prev, [id]: content }))
      setSavedContentByKey((prev) => ({ ...prev, [id]: content }))
      if (writingSelectedFacet) {
        diskKeyRef.current = key
      }
      setPendingDraft(null)
      await refreshProjectFacets()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function deleteFacet(kind: FacetKind, key: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await window.orbit.deleteProjectFacet({ kind, key })
      const id = catalogFacetKey(kind, key)
      setContentByKey((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setSavedContentByKey((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      loadedIdsRef.current.delete(id)
      if (diskKeyRef.current === key) diskKeyRef.current = null
      await refreshProjectFacets()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function overrideBuiltin(kind: FacetKind, key: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const doc = await window.orbit.readFacet({ kind, key, source: 'builtin' })
      const content = doc.content ?? ''
      await window.orbit.writeProjectFacet({ kind, key, content })
      const id = catalogFacetKey(kind, key)
      setContentByKey((prev) => ({ ...prev, [id]: content }))
      setSavedContentByKey((prev) => ({ ...prev, [id]: content }))
      loadedIdsRef.current.add(id)
      diskKeyRef.current = key
      await refreshProjectFacets()
      selectFacet({ kind, key }, 'project')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      setBusy(false)
    }
  }

  function addDraft(kind: FacetKind): void {
    const draftKey = ''
    setPendingDraft({ kind, key: draftKey })
    selectFacet({ kind, key: draftKey }, 'draft')
    setContentByKey((prev) => ({ ...prev, [catalogFacetKey(kind, draftKey)]: '' }))
    setSavedContentByKey((prev) => ({ ...prev, [catalogFacetKey(kind, draftKey)]: '' }))
    if (collapsed.has(kind)) {
      const next = new Set(collapsed)
      next.delete(kind)
      setCollapsed(next)
    }
  }

  function toggleCollapse(kind: FacetKind): void {
    const next = new Set(collapsed)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    setCollapsed(next)
  }

  const expandKind = useCallback((kind: FacetKind) => {
    setCollapsed((prev) => {
      if (!prev.has(kind)) return prev
      const next = new Set(prev)
      next.delete(kind)
      return next
    })
  }, [])

  const catalogReady = !loading && !builtinCatalogLoading

  return {
    showBuiltin,
    setShowBuiltin,
    itemsByKind,
    selected,
    selectFacet,
    setSelected: setSelectedFromUi,
    renameSelectedKey,
    collapsed,
    toggleCollapse,
    expandKind,
    selectedItem,
    selectedContent,
    selectedDirty,
    setSelectedContent: (content: string) => {
      if (!selected) return
      setContentByKey((prev) => ({
        ...prev,
        [catalogFacetKey(selected.kind, selected.key)]: content,
      }))
    },
    loading,
    builtinCatalogLoading,
    catalogReady,
    refreshing,
    busy,
    error,
    saveContent,
    deleteFacet,
    overrideBuiltin,
    addDraft,
    refreshProjectFacets,
  }
}
