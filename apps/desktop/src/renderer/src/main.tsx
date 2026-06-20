import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { RootErrorBoundary } from './components/root-error-boundary'
import { I18nProvider } from './i18n/i18n-provider'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </RootErrorBoundary>
  </StrictMode>,
)
