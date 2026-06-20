import { PRODUCT_DISPLAY_NAME } from '@planetz/shared'
import { useEffect, useState } from 'react'
import { AppBootScreen } from './components/app-boot-screen'
import { MainDashboard } from './components/main-dashboard'
import { DevResultHarness } from './components/mock/dev-result-harness'
import { MockIntentRailPreview } from './components/mock/mock-intent-rail-preview'
import { MockIntroHarnessPreview } from './components/mock/mock-intro-harness-preview'
import { MockIntroIntentScenePreview } from './components/mock/mock-intro-intent-scene-preview'
import { MockIssueStatusPreview } from './components/mock/mock-issue-status-preview'
import { MockIssueTabPreview } from './components/mock/mock-issue-tab-preview'
import { MockResultDisplayPreview } from './components/mock/mock-result-display-preview'
import { MockRunningTaskPreview } from './components/mock/mock-running-task-preview'
import { MockWorkflowAutoPreview } from './components/mock/mock-workflow-auto-preview'
import { MockWorkflowSelectionPreview } from './components/mock/mock-workflow-selection-preview'
import { ToastStack } from './components/ui/toast-stack'
import { WorkspaceOnboarding } from './components/workspace-onboarding'
import { useWorkspaceSession } from './hooks/use-workspace-session'
import { useI18n } from './i18n'
import { resolveTheme } from './skins/registry'
import { useAppStore } from './store/app-store'

function BridgeUnavailable() {
  const inElectron = navigator.userAgent.includes('Electron')
  const { t } = useI18n()

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 text-sm text-[var(--color-muted-strong)]">
        <p className="font-semibold text-[var(--color-text-strong)]">{t('bridge.title')}</p>
        {!inElectron ? (
          <p className="mt-2">{t('bridge.webBrowser', { productName: PRODUCT_DISPLAY_NAME })}</p>
        ) : (
          <p className="mt-2">{t('bridge.electronBroken')}</p>
        )}
      </div>
    </div>
  )
}

function AppContent() {
  const { t } = useI18n()
  const state = useAppStore((s) => s.state)
  const themeId = useAppStore((s) => s.themeId)
  const promptHistory = useAppStore((s) => s.promptHistory)
  const session = useWorkspaceSession()
  const skin = resolveTheme(themeId)

  if (typeof window.orbit === 'undefined') {
    return <BridgeUnavailable />
  }

  if (!state && session.bootstrap.hydrating) {
    return <AppBootScreen status={t('workspace.restoring')} />
  }

  const showOnboarding =
    !state || Boolean(state.canonicalImportOffer) || state.workspace.bootstrap !== 'takt_ready'

  if (showOnboarding) {
    return (
      <div className="h-full">
        <WorkspaceOnboarding
          opening={session.bootstrap.opening}
          recentWorkspaces={session.workspace.recentWorkspaces}
          workspacePath={state?.workspace.path ?? null}
          canonicalImportOffer={state?.canonicalImportOffer ?? null}
          onOpenWorkspace={() => void session.workspace.onChangeWorkspace()}
          onOpenRecentWorkspace={session.workspace.onOpenRecentWorkspace}
          onRemoveRecentWorkspace={session.workspace.onRemoveRecentWorkspace}
          onConfirmCanonicalImport={async (options) => {
            await window.orbit.confirmCanonicalImport(options)
          }}
          onDismissCanonicalImport={async () => {
            await window.orbit.dismissCanonicalImport()
          }}
          onSaveProviderModel={async ({ provider, model }) => {
            await window.orbit.updateEngineConfig({ provider, model })
          }}
        />
      </div>
    )
  }

  return (
    <div className="h-full">
      <MainDashboard
        state={state}
        skin={skin}
        promptHistory={promptHistory}
        workspace={session.workspace}
        settings={session.settings}
        retry={session.retry}
        chain={session.chain}
        integration={session.integration}
      />
    </div>
  )
}

function useHashRoute(): string {
  const [hash, setHash] = useState<string>(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  )
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return hash
}

export function App() {
  const hash = useHashRoute()
  if (hash === '#mock/running-task') {
    return (
      <>
        <MockRunningTaskPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/intent-rail') {
    return (
      <>
        <MockIntentRailPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/intro-intent-rail') {
    return (
      <>
        <MockIntroIntentScenePreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/intro-harness') {
    return (
      <>
        <MockIntroHarnessPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#dev/result-full') {
    return <DevResultHarness />
  }
  if (hash === '#mock/workflow-selection') {
    return (
      <>
        <MockWorkflowSelectionPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/workflow-auto') {
    return (
      <>
        <MockWorkflowAutoPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/result-display') {
    return (
      <>
        <MockResultDisplayPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/issue-tab') {
    return (
      <>
        <MockIssueTabPreview />
        <ToastStack />
      </>
    )
  }
  if (hash === '#mock/issue-status') {
    return (
      <>
        <MockIssueStatusPreview />
        <ToastStack />
      </>
    )
  }
  return (
    <>
      <AppContent />
      <ToastStack />
    </>
  )
}
