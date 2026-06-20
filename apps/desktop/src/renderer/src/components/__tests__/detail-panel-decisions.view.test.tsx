import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOrbitBridge, createStorageMock } from '../../__tests__/orbit-mock.js'
import { resetAppStore } from '../../__tests__/test-app-store.js'
import { I18nProvider } from '../../i18n/i18n-provider.js'
import { SkinProvider } from '../../skins/context.js'
import { defaultSkin } from '../../skins/default-skin.js'
import { useAppStore } from '../../store/app-store.js'
import { DetailPanel } from '../detail-panel.js'
import { completedTask } from './detail-panel-test-fixtures.js'

describe('DetailPanel decisions link', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetAppStore()
  })

  it('opens decisions for the task when pending count is positive', async () => {
    const task = completedTask({ id: 'task-pending-decisions' })
    const countPendingIntentLedger = vi.fn(async () => ({ count: 2 }))
    const onOpenDecisions = vi.fn()

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({ countPendingIntentLedger }),
        localStorage: storage,
      }),
    )
    useAppStore.setState({ decisionsExpensiveOnly: true, stateRevision: 1 })

    render(
      <I18nProvider>
        <SkinProvider skin={defaultSkin}>
          <DetailPanel
            task={task}
            tasks={[task]}
            results={[]}
            workflows={[]}
            executors={[]}
            chains={[]}
            onSelectTask={vi.fn()}
            onCreateChain={vi.fn()}
            onMaterializeChain={vi.fn(async () => {})}
            onUnlinkChainEdge={vi.fn(async () => {})}
            onOpenDecisions={onOpenDecisions}
          />
        </SkinProvider>
      </I18nProvider>,
    )

    const link = await screen.findByRole('button', {
      name: 'Pending decisions for this task (2)',
    })
    fireEvent.click(link)

    await waitFor(() => {
      expect(countPendingIntentLedger).toHaveBeenCalledWith({
        expensiveOnly: true,
        taskId: 'task-pending-decisions',
      })
      expect(onOpenDecisions).toHaveBeenCalledWith(task)
    })
  })

  it('hides decisions link when pending count is zero', async () => {
    const task = completedTask({ id: 'task-no-decisions' })
    const countPendingIntentLedger = vi.fn(async () => ({ count: 0 }))

    const storage = createStorageMock()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        orbit: createDefaultOrbitBridge({ countPendingIntentLedger }),
        localStorage: storage,
      }),
    )

    render(
      <I18nProvider>
        <SkinProvider skin={defaultSkin}>
          <DetailPanel
            task={task}
            tasks={[task]}
            results={[]}
            workflows={[]}
            executors={[]}
            chains={[]}
            onSelectTask={vi.fn()}
            onCreateChain={vi.fn()}
            onMaterializeChain={vi.fn(async () => {})}
            onUnlinkChainEdge={vi.fn(async () => {})}
            onOpenDecisions={vi.fn()}
          />
        </SkinProvider>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(countPendingIntentLedger).toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: /Pending decisions for this task/ })).toBeNull()
    })
  })
})
