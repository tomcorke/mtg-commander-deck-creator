import { Component, type ReactNode } from 'react'
import { ModalCloseButton } from './CardDetails.tsx'
import { useDialogFocus } from './hooks.ts'

export class CardViewBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // Deliberately allowlist diagnostics: errors and React stacks can contain user data.
    console.error('Card view render failed', { surface: 'card-details', phase: 'render' })
  }

  render() {
    return this.state.failed ? (
      <CardViewFallback onClose={this.props.onClose} />
    ) : (
      this.props.children
    )
  }
}

function CardViewFallback({ onClose }: { onClose: () => void }) {
  const dialog = useDialogFocus(true, onClose)
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        {...dialog}
        className="export-modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-view-error-title"
      >
        <div className="export-heading">
          <h2 id="card-view-error-title">Unable to show card details</h2>
          <ModalCloseButton onClick={onClose} label="Close card details error" />
        </div>
        <p className="import-help">
          Your deck is still here. Close this view to open another card.
        </p>
        <div className="export-actions">
          <button type="button" className="primary" onClick={onClose}>
            Close card details
          </button>
        </div>
      </section>
    </div>
  )
}
