import { useState, type ReactNode } from 'react'

export type BulkAddStatus = { kind: 'batch' | 'draft'; count: number } | null

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Bulk shortcuts beside the add-zone choice: add the whole batch, or let the app fill the deck to
 * 100 as a draft. The last bulk add stays undoable in one step.
 */
export function BulkActions({
  zoneToggle,
  addableCount,
  openSlots,
  busy,
  blockedReason,
  note,
  status,
  onAddAll,
  onBuild,
  onUndo,
  onReview,
}: {
  zoneToggle: ReactNode
  /** Undecided cards in the batch that can be added now. */
  addableCount: number
  /** Main-deck slots left; the draft offer hides at 0. */
  openSlots: number
  /** True while a batch is loading or revealing. */
  busy: boolean
  /** Why a starting deck can't be built right now, or empty. */
  blockedReason: string
  /** Batch context shown before the shortcuts, such as the undecided-cards note. */
  note?: ReactNode
  status: BulkAddStatus
  onAddAll: () => void
  onBuild: () => Promise<string>
  onUndo: () => void
  onReview: () => void
}) {
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')
  const build = async () => {
    setBuilding(true)
    setError('')
    try {
      setError(await onBuild())
    } finally {
      setBuilding(false)
    }
  }
  return (
    <div className="bulk-actions">
      <div className="bulk-actions-row">
        {zoneToggle}
        <div className="bulk-actions-buttons">
          {note}
          <button
            className="compact-action"
            type="button"
            disabled={busy || addableCount === 0}
            onClick={() => {
              setError('')
              onAddAll()
            }}
          >
            {addableCount > 1 ? `Add all ${addableCount}` : 'Add all'}
          </button>
          {openSlots > 0 && (
            <span className="action-help-wrap">
              <button
                className="compact-action"
                type="button"
                disabled={busy || Boolean(blockedReason) || building}
                aria-busy={building}
                aria-describedby="starting-deck-help"
                onClick={() => void build()}
              >
                {building ? 'Building draft…' : 'Build a starting deck'}
              </button>
              <span
                className="action-help end bulk-actions-help"
                id="starting-deck-help"
                role="tooltip"
              >
                {blockedReason ||
                  `Fills the ${plural(openSlots, 'open slot')} with the app’s top picks for your role targets and theme, then basic lands. An app draft, not a tuned list. Opens Deck review; one undo removes it.`}
              </span>
            </span>
          )}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <BulkAddStatusLine status={status} onUndo={onUndo} onReview={onReview} />
    </div>
  )
}

/** The last bulk add, with its undo. Always mounted, so screen readers hear the change. */
function BulkAddStatusLine({
  status,
  onUndo,
  onReview,
}: {
  status: BulkAddStatus
  onUndo: () => void
  onReview: () => void
}) {
  return (
    <div className="bulk-actions-status" role="status">
      {status && (
        <>
          <span>
            {status.kind === 'draft'
              ? `Starting deck: the app added ${plural(status.count, 'card')}. It’s an app draft, not a tuned list.`
              : `Added ${plural(status.count, 'card')} with Add all.`}
          </span>
          <button className="compact-action" type="button" onClick={onUndo}>
            {status.kind === 'draft' ? 'Undo starting deck' : 'Undo'}
          </button>
          {status.kind === 'draft' && (
            <button className="compact-action" type="button" onClick={onReview}>
              Deck review
            </button>
          )}
        </>
      )}
    </div>
  )
}
