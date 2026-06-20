import { Component, type ErrorInfo, type ReactNode } from 'react'

interface RootErrorBoundaryProps {
  children: ReactNode
}

interface RootErrorBoundaryState {
  error: Error | null
}

/** Surfaces renderer crashes instead of a blank Electron window in dev. */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[planetz] renderer error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full items-center justify-center bg-[#24273a] p-8 text-[#cad3f5]">
        <div className="max-w-xl rounded-xl border border-[#5b6078] bg-[#363a4f] p-6 text-sm">
          <p className="font-semibold text-[#eed49f]">Renderer error</p>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-[#a5adcb]">
            {error.stack ?? error.message}
          </pre>
        </div>
      </div>
    )
  }
}
