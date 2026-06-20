import type { ProjectFacetSummary } from '@planetz/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installOrbitMock } from '../../../__tests__/orbit-mock.js'
import { useFacetCatalog } from '../facets/use-facet-catalog.js'

describe('useFacetCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads project facets on mount', async () => {
    const listProjectFacets = vi.fn(async () => [
      {
        kind: 'personas' as const,
        key: 'planner',
        managedPath: '../facets/personas/planner.md',
      },
    ])
    installOrbitMock({ listProjectFacets })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(listProjectFacets).toHaveBeenCalled()
      expect(result.current.itemsByKind.personas.some((i) => i.key === 'planner')).toBe(true)
    })
  })

  it('does not crash when builtin facet bridge method is unavailable', async () => {
    const listProjectFacets = vi.fn(async () => [])
    installOrbitMock({
      listProjectFacets,
      listWorkflowBuiltinFacets: undefined as unknown as () => Promise<{
        personas: string[]
        policies: string[]
        knowledge: string[]
        instructions: string[]
        reportFormats: string[]
      }>,
    })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(listProjectFacets).toHaveBeenCalled()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  it('ignores malformed project facet payloads without crashing', async () => {
    const listProjectFacets = vi.fn(async () => ({ bad: true }) as unknown as never[])
    installOrbitMock({ listProjectFacets })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(listProjectFacets).toHaveBeenCalled()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.itemsByKind.personas).toEqual([])
      expect(result.current.itemsByKind.policies).toEqual([])
      expect(result.current.itemsByKind.knowledge).toEqual([])
      expect(result.current.itemsByKind.instructions).toEqual([])
      expect(result.current.itemsByKind.reportFormats).toEqual([])
    })
  })

  it('ignores malformed builtin catalog payloads without crashing', async () => {
    installOrbitMock({
      listWorkflowBuiltinFacets: vi.fn(
        async () =>
          ({
            personas: ['planner'],
            policies: 'invalid',
            knowledge: null,
            instructions: [1, 'coding'],
            reportFormats: {},
          }) as unknown as {
            personas: string[]
            policies: string[]
            knowledge: string[]
            instructions: string[]
            reportFormats: string[]
          },
      ),
    })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.itemsByKind.personas.some((item) => item.key === 'planner')).toBe(true)
      expect(result.current.itemsByKind.instructions.some((item) => item.key === 'coding')).toBe(
        true,
      )
      expect(result.current.itemsByKind.policies).toEqual([])
      expect(result.current.itemsByKind.knowledge).toEqual([])
      expect(result.current.itemsByKind.reportFormats).toEqual([])
    })
  })

  it('overrideBuiltin writes project copy from builtin content', async () => {
    const readFacet = vi.fn(async () => ({
      kind: 'personas' as const,
      key: 'planner',
      source: 'builtin' as const,
      content: '# Planner\n',
      managedPath: '../facets/personas/planner.md',
    }))
    const writeProjectFacet = vi.fn(async () => ({ path: '.orbit/facets/personas/planner.md' }))
    installOrbitMock({ readFacet, writeProjectFacet, listProjectFacets: vi.fn(async () => []) })

    const { result } = renderHook(() => useFacetCatalog())

    await act(async () => {
      await result.current.overrideBuiltin('personas', 'planner')
    })

    expect(readFacet).toHaveBeenCalledWith({
      kind: 'personas',
      key: 'planner',
      source: 'builtin',
    })
    expect(writeProjectFacet).toHaveBeenCalledWith({
      kind: 'personas',
      key: 'planner',
      content: '# Planner\n',
    })
  })

  it('keeps an early facet selection while the catalog is still loading', async () => {
    let resolveProjectFacets: (value: ProjectFacetSummary[]) => void = () => {}
    const listProjectFacets = vi.fn(
      () =>
        new Promise<ProjectFacetSummary[]>((resolve) => {
          resolveProjectFacets = resolve
        }),
    )
    installOrbitMock({
      listProjectFacets,
      listWorkflowBuiltinFacets: vi.fn(async () => ({
        personas: [],
        policies: [],
        knowledge: [],
        instructions: [],
        reportFormats: [],
      })),
    })

    const { result } = renderHook(() => useFacetCatalog())

    act(() => {
      result.current.setSelected({ kind: 'personas', key: 'qa-reviewer' })
    })

    expect(result.current.selected).toEqual({ kind: 'personas', key: 'qa-reviewer' })

    await act(async () => {
      resolveProjectFacets([
        {
          kind: 'personas',
          key: 'qa-reviewer',
          managedPath: '../facets/personas/qa-reviewer.md',
        },
      ])
    })

    await waitFor(() => {
      expect(result.current.catalogReady).toBe(true)
      expect(result.current.selected).toEqual({ kind: 'personas', key: 'qa-reviewer' })
      expect(result.current.itemsByKind.personas.some((item) => item.key === 'qa-reviewer')).toBe(
        true,
      )
    })
  })

  it('keeps content when renaming a facet key before save', async () => {
    const listProjectFacets = vi.fn(async () => [
      {
        kind: 'personas' as const,
        key: 'planner',
        managedPath: '../facets/personas/planner.md',
      },
    ])
    const readFacet = vi.fn(async () => ({
      kind: 'personas' as const,
      key: 'planner',
      source: 'project' as const,
      content: '# Planner\n',
      managedPath: '../facets/personas/planner.md',
    }))
    installOrbitMock({
      listProjectFacets,
      readFacet,
      listFacetUsages: vi.fn(async () => ({
        workflowCount: 0,
        stepCount: 0,
        workflowNames: [],
      })),
    })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(result.current.itemsByKind.personas.some((i) => i.key === 'planner')).toBe(true)
    })

    act(() => {
      result.current.setSelected({ kind: 'personas', key: 'planner' })
    })

    await waitFor(() => {
      expect(result.current.selectedContent).toBe('# Planner\n')
    })

    act(() => {
      result.current.renameSelectedKey('strategist')
    })

    expect(result.current.selected?.key).toBe('strategist')
    expect(result.current.selectedContent).toBe('# Planner\n')
    expect(result.current.selectedDirty).toBe(false)
  })

  it('deletes the prior disk key when saving under a renamed key', async () => {
    const listProjectFacets = vi.fn(async () => [
      {
        kind: 'personas' as const,
        key: 'planner',
        managedPath: '../facets/personas/planner.md',
      },
    ])
    const readFacet = vi.fn(async () => ({
      kind: 'personas' as const,
      key: 'planner',
      source: 'project' as const,
      content: '# Planner\n',
      managedPath: '../facets/personas/planner.md',
    }))
    const writeProjectFacet = vi.fn(async () => ({ path: '.orbit/facets/personas/strategist.md' }))
    const deleteProjectFacet = vi.fn(async () => undefined)
    installOrbitMock({
      listProjectFacets,
      readFacet,
      writeProjectFacet,
      deleteProjectFacet,
      listFacetUsages: vi.fn(async () => ({
        workflowCount: 0,
        stepCount: 0,
        workflowNames: [],
      })),
    })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(result.current.itemsByKind.personas.some((i) => i.key === 'planner')).toBe(true)
    })

    act(() => {
      result.current.setSelected({ kind: 'personas', key: 'planner' })
    })

    await waitFor(() => {
      expect(result.current.selectedContent).toBe('# Planner\n')
    })

    act(() => {
      result.current.renameSelectedKey('strategist')
    })

    await act(async () => {
      await result.current.saveContent('personas', 'strategist', '# Planner\n')
    })

    expect(writeProjectFacet).toHaveBeenCalledWith({
      kind: 'personas',
      key: 'strategist',
      content: '# Planner\n',
    })
    expect(deleteProjectFacet).toHaveBeenCalledWith({
      kind: 'personas',
      key: 'planner',
    })
  })

  it('does not delete the selected facet when saving a duplicate key', async () => {
    const listProjectFacets = vi.fn(async () => [
      {
        kind: 'personas' as const,
        key: 'planner',
        managedPath: '../facets/personas/planner.md',
      },
      {
        kind: 'personas' as const,
        key: 'planner-copy',
        managedPath: '../facets/personas/planner-copy.md',
      },
    ])
    const readFacet = vi.fn(async () => ({
      kind: 'personas' as const,
      key: 'planner',
      source: 'project' as const,
      content: '# Planner\n',
      managedPath: '../facets/personas/planner.md',
    }))
    const writeProjectFacet = vi.fn(async () => ({
      path: '.orbit/facets/personas/planner-copy.md',
    }))
    const deleteProjectFacet = vi.fn(async () => undefined)
    installOrbitMock({
      listProjectFacets,
      readFacet,
      writeProjectFacet,
      deleteProjectFacet,
      listFacetUsages: vi.fn(async () => ({
        workflowCount: 0,
        stepCount: 0,
        workflowNames: [],
      })),
    })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(result.current.itemsByKind.personas.some((i) => i.key === 'planner')).toBe(true)
    })

    act(() => {
      result.current.setSelected({ kind: 'personas', key: 'planner' })
    })

    await waitFor(() => {
      expect(result.current.selectedContent).toBe('# Planner\n')
    })

    await act(async () => {
      await result.current.saveContent('personas', 'planner-copy', '# Planner\n')
    })

    expect(writeProjectFacet).toHaveBeenCalledWith({
      kind: 'personas',
      key: 'planner-copy',
      content: '# Planner\n',
    })
    expect(deleteProjectFacet).not.toHaveBeenCalledWith({
      kind: 'personas',
      key: 'planner',
    })
  })

  it('deletes original key after duplicate-save followed by rename-save', async () => {
    const listProjectFacets = vi.fn(async () => [
      {
        kind: 'personas' as const,
        key: 'planner',
        managedPath: '../facets/personas/planner.md',
      },
      {
        kind: 'personas' as const,
        key: 'planner-copy',
        managedPath: '../facets/personas/planner-copy.md',
      },
    ])
    const readFacet = vi.fn(async () => ({
      kind: 'personas' as const,
      key: 'planner',
      source: 'project' as const,
      content: '# Planner\n',
      managedPath: '../facets/personas/planner.md',
    }))
    const writeProjectFacet = vi.fn(async () => ({ path: '.orbit/facets/personas/strategist.md' }))
    const deleteProjectFacet = vi.fn(async () => undefined)
    installOrbitMock({
      listProjectFacets,
      readFacet,
      writeProjectFacet,
      deleteProjectFacet,
      listFacetUsages: vi.fn(async () => ({
        workflowCount: 0,
        stepCount: 0,
        workflowNames: [],
      })),
    })

    const { result } = renderHook(() => useFacetCatalog())

    await waitFor(() => {
      expect(result.current.itemsByKind.personas.some((i) => i.key === 'planner')).toBe(true)
    })

    act(() => {
      result.current.setSelected({ kind: 'personas', key: 'planner' })
    })

    await waitFor(() => {
      expect(result.current.selectedContent).toBe('# Planner\n')
    })

    await act(async () => {
      await result.current.saveContent('personas', 'planner-copy', '# Planner\n')
    })

    act(() => {
      result.current.renameSelectedKey('strategist')
    })

    await act(async () => {
      await result.current.saveContent('personas', 'strategist', '# Planner\n')
    })

    expect(deleteProjectFacet).toHaveBeenCalledWith({
      kind: 'personas',
      key: 'planner',
    })
  })
})
