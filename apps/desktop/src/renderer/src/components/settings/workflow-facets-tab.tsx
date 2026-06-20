import type { FacetKind } from '@planetz/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConfirmDialogRequest } from '../../hooks/use-confirm-dialog.js'
import { FacetEditorPane } from './facets/facet-editor-pane'
import { FACET_KIND_DEFS } from './facets/facet-kind-defs'
import { facetManagedPath } from './facets/facet-path'
import type { FacetTreeItemData } from './facets/facet-tree-pane'
import { FacetTreePane } from './facets/facet-tree-pane'
import type { WorkflowDraft } from './workflow-draft-types.js'
import { buildFacetTreeItems } from './workflow-facets-build-items.js'

const EMPTY_BUILTIN_CATALOG: Record<FacetKind, string[]> = {
  personas: [],
  policies: [],
  knowledge: [],
  instructions: [],
  reportFormats: [],
}

interface FacetsTabProps {
  draft: WorkflowDraft
  setDraft: (next: WorkflowDraft) => void
  requestConfirm: (payload: ConfirmDialogRequest | string) => Promise<boolean>
  readOnly?: boolean
  onEditInFacets?: (selection: { kind: FacetKind; key: string }) => void
  onNavigateToSteps?: (payload: { kind: FacetKind; key: string; stepNames: string[] }) => void
}

export function FacetsTab({
  draft,
  setDraft,
  requestConfirm,
  readOnly = false,
  onEditInFacets,
  onNavigateToSteps,
}: FacetsTabProps) {
  const [showBuiltin, setShowBuiltin] = useState(false)
  const [builtinCatalog, setBuiltinCatalog] =
    useState<Record<FacetKind, string[]>>(EMPTY_BUILTIN_CATALOG)
  const itemsByKind = useMemo<Record<FacetKind, FacetTreeItemData[]>>(
    () => ({
      personas: buildFacetTreeItems(draft, 'personas', builtinCatalog.personas, showBuiltin),
      policies: buildFacetTreeItems(draft, 'policies', builtinCatalog.policies, showBuiltin),
      knowledge: buildFacetTreeItems(draft, 'knowledge', builtinCatalog.knowledge, showBuiltin),
      instructions: buildFacetTreeItems(
        draft,
        'instructions',
        builtinCatalog.instructions,
        showBuiltin,
      ),
      reportFormats: buildFacetTreeItems(
        draft,
        'reportFormats',
        builtinCatalog.reportFormats,
        showBuiltin,
      ),
    }),
    [builtinCatalog, draft, showBuiltin],
  )

  const [selected, setSelected] = useState<{ kind: FacetKind; key: string } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<FacetKind>>(new Set())
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [builtinContentCache, setBuiltinContentCache] = useState<Record<string, string>>({})
  const builtinContentCacheRef = useRef(builtinContentCache)
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    builtinContentCacheRef.current = builtinContentCache
  }, [builtinContentCache])

  useEffect(() => {
    let cancelled = false
    void window.orbit
      .listWorkflowBuiltinFacets()
      .then((catalog) => {
        if (cancelled) return
        setBuiltinCatalog(catalog)
      })
      .catch(() => {
        // ignore failures and keep project-only list
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selected) {
      const still = itemsByKind[selected.kind].some((i) => i.key === selected.key)
      if (still) return
    }
    for (const k of FACET_KIND_DEFS) {
      const list = itemsByKind[k.kind]
      if (list.length > 0) {
        setSelected({ kind: k.kind, key: list[0].key })
        return
      }
    }
    setSelected(null)
  }, [itemsByKind, selected])

  const selectedItem = selected
    ? (itemsByKind[selected.kind].find((i) => i.key === selected.key) ?? null)
    : null

  useEffect(() => {
    if (!selectedItem || selectedItem.source !== 'builtin' || !selectedItem.key) return
    const cacheKey = `${selectedItem.kind}:${selectedItem.key}`
    if (builtinContentCacheRef.current[cacheKey]) return
    const path = facetManagedPath(selectedItem.kind, selectedItem.key)
    if (draftRef.current.facetContentByPath?.[path]) return

    let cancelled = false
    void window.orbit
      .readFacet({ kind: selectedItem.kind, key: selectedItem.key, source: 'builtin' })
      .then((doc) => {
        if (cancelled) return
        const content = typeof doc.content === 'string' ? doc.content : ''
        if (!content) return
        setBuiltinContentCache((prev) => ({ ...prev, [cacheKey]: content }))
        const latest = draftRef.current
        setDraft({
          ...latest,
          facetContentByPath: {
            ...(latest.facetContentByPath ?? {}),
            [path]: content,
          },
        })
      })
      .catch(() => {
        void window.orbit
          .readWorkflowFacets({ managedPaths: [path] })
          .then((reads) => {
            if (cancelled) return
            const loaded = reads.find((r) => r.managedPath === path)?.content
            if (typeof loaded !== 'string' || loaded.length === 0) return
            setBuiltinContentCache((prev) => ({ ...prev, [cacheKey]: loaded }))
            const latest = draftRef.current
            setDraft({
              ...latest,
              facetContentByPath: {
                ...(latest.facetContentByPath ?? {}),
                [path]: loaded,
              },
            })
          })
          .catch(() => {
            // ignore facet read errors
          })
      })
    return () => {
      cancelled = true
    }
  }, [selectedItem, setDraft])

  function toggleCollapse(kind: FacetKind) {
    const next = new Set(collapsed)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    setCollapsed(next)
  }

  function addItem(kind: FacetKind) {
    setDraft({
      ...draft,
      [kind]: [...draft[kind], { key: '', path: '', content: '' }],
    })
    setSelected({ kind, key: '' })
    if (collapsed.has(kind)) {
      const next = new Set(collapsed)
      next.delete(kind)
      setCollapsed(next)
    }
  }

  async function overrideBuiltin(kind: FacetKind, key: string) {
    const path = facetManagedPath(kind, key)
    const cacheKey = `${kind}:${key}`
    let content = draftRef.current.facetContentByPath?.[path] ?? builtinContentCache[cacheKey] ?? ''
    if (!content) {
      try {
        const doc = await window.orbit.readFacet({ kind, key, source: 'builtin' })
        if (typeof doc.content === 'string') content = doc.content
      } catch {
        try {
          const reads = await window.orbit.readWorkflowFacets({ managedPaths: [path] })
          const loaded = reads.find((r) => r.managedPath === path)?.content
          if (typeof loaded === 'string') content = loaded
        } catch {
          // keep empty override content when read fails
        }
      }
    }
    setOverrideError(null)
    try {
      await window.orbit.writeProjectFacet({ kind, key, content })
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : String(err))
      return
    }
    const latest = draftRef.current
    setDraft({
      ...latest,
      [kind]: [...latest[kind], { key, path, content }],
      facetContentByPath: content
        ? {
            ...(latest.facetContentByPath ?? {}),
            [path]: content,
          }
        : latest.facetContentByPath,
    })
    setSelected({ kind, key })
  }

  function updateItemAt(kind: FacetKind, index: number, patch: { key?: string; content?: string }) {
    const list = draft[kind].map((m, i) => {
      if (i !== index) return m
      return {
        ...m,
        key: patch.key !== undefined ? patch.key : m.key,
        content: patch.content !== undefined ? patch.content : m.content,
      }
    })
    setDraft({ ...draft, [kind]: list })
    if (selected && selected.kind === kind && patch.key !== undefined) {
      setSelected({ kind, key: patch.key })
    }
  }

  function removeItemAt(kind: FacetKind, index: number) {
    const list = draft[kind].filter((_, i) => i !== index)
    setDraft({ ...draft, [kind]: list })
  }

  async function confirmRemoveFacet(kind: FacetKind, key: string, index: number) {
    if (!(await requestConfirm(`Delete ${kind} "${key || '(new)'}"?`))) return
    removeItemAt(kind, index)
  }

  const displayContent = (() => {
    if (!selectedItem) return ''
    if (selectedItem.source === 'project') {
      const idx = selectedItem.index
      if (idx === undefined) return ''
      return draft[selectedItem.kind][idx]?.content ?? ''
    }
    const path = facetManagedPath(selectedItem.kind, selectedItem.key)
    const cacheKey = `${selectedItem.kind}:${selectedItem.key}`
    return draft.facetContentByPath?.[path] ?? builtinContentCache[cacheKey] ?? ''
  })()

  return (
    <div className="flex gap-3">
      <FacetTreePane
        itemsByKind={itemsByKind}
        selected={selected}
        collapsed={collapsed}
        showBuiltin={showBuiltin}
        onToggleBuiltin={setShowBuiltin}
        onSelect={setSelected}
        onToggleCollapse={toggleCollapse}
        onAdd={addItem}
        onNavigateToSteps={onNavigateToSteps}
        allowAdd={!readOnly}
      />

      <div className="min-w-0 flex-1">
        {overrideError ? (
          <p className="mb-2 text-xs text-[var(--color-status-failed)]">{overrideError}</p>
        ) : null}
        {selectedItem ? (
          <FacetEditorPane
            item={{
              kind: selectedItem.kind,
              key: selectedItem.key,
              source: selectedItem.source,
              listingSource: selectedItem.listingSource,
              content: displayContent,
              stepReferences: selectedItem.stepReferences,
              referencingStepNames: selectedItem.referencingStepNames,
              keyEditable: selectedItem.source === 'project' && !readOnly,
              contentEditable: false,
            }}
            mode="reference"
            onChange={
              readOnly || selectedItem.source !== 'project' || selectedItem.index === undefined
                ? undefined
                : (patch) => {
                    if (selectedItem.index === undefined) return
                    updateItemAt(selectedItem.kind, selectedItem.index, patch)
                  }
            }
            onRemove={
              readOnly || selectedItem.source !== 'project' || selectedItem.index === undefined
                ? undefined
                : () => {
                    if (selectedItem.index === undefined) return
                    if ((selectedItem.stepReferences ?? 0) > 0) return
                    void confirmRemoveFacet(selectedItem.kind, selectedItem.key, selectedItem.index)
                  }
            }
            onOverride={
              readOnly || selectedItem.source !== 'builtin'
                ? undefined
                : () => void overrideBuiltin(selectedItem.kind, selectedItem.key)
            }
            onEditInFacets={
              selectedItem.key && onEditInFacets
                ? () => onEditInFacets({ kind: selectedItem.kind, key: selectedItem.key })
                : undefined
            }
            onAssignOnStepsTab={
              selectedItem.key &&
              onNavigateToSteps &&
              (selectedItem.referencingStepNames?.length ?? 0) > 0
                ? () =>
                    onNavigateToSteps({
                      kind: selectedItem.kind,
                      key: selectedItem.key,
                      stepNames: selectedItem.referencingStepNames ?? [],
                    })
                : undefined
            }
          />
        ) : (
          <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-xs text-[var(--color-muted)]">
            Select a facet on the left, or click <span className="font-mono">+</span> to add a
            reference.
          </p>
        )}
      </div>
    </div>
  )
}
