import type { Card, DeckCard } from '../../domain/card-model.ts'
import type { DeckDoctorSwapRecord } from '../../deck-doctor.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardTile } from '../builder/DeckReviewCard.tsx'

type Props = {
  show: boolean
  history: DeckDoctorSwapRecord[]
  error: string
  openCard: (card: Card | DeckCard) => void
  undoSwap: (id: string) => boolean
  closeModal: () => void
}

export function DeckReviewHistoryModal({
  show,
  history,
  error,
  openCard,
  undoSwap,
  closeModal,
}: Props) {
  if (!show) return null
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        className="export-modal deck-review-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            closeModal()
          }
        }}
      >
        <div className="export-heading">
          <p className="eyebrow">Deck review</p>
          <ModalCloseButton autoFocus label="Close change history" onClick={closeModal} />
        </div>
        <section
          id="deck-review-history"
          tabIndex={-1}
          className="doctor-history"
          aria-labelledby="history-title"
        >
          <div className="doctor-section-heading">
            <div>
              <p className="eyebrow">Your changes</p>
              <h2 id="history-title">Change history</h2>
            </div>
            <span>{history.length} applied</span>
          </div>
          {history.length ? (
            history.map((swap) => (
              <article className="doctor-history-item" key={swap.id}>
                <div className="doctor-history-pair">
                  {swap.cutCard && (
                    <CardTile
                      card={swap.cutCard}
                      status={swap.movedToSideboard ? 'Moved to sideboard' : 'Cut from deck'}
                      openCard={openCard}
                    />
                  )}
                  {swap.cutCard && swap.addedCard && (
                    <span className="doctor-pair-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                  {swap.addedCard && (
                    <CardTile card={swap.addedCard} status="In deck" openCard={openCard} />
                  )}
                </div>
                <button
                  className="export"
                  type="button"
                  onClick={() => undoSwap(swap.id)}
                  aria-label={
                    swap.cutCard && swap.addedCard
                      ? `Undo ${swap.addedCard.name} for ${swap.cutCard.name}`
                      : swap.addedCard
                        ? `Undo adding ${swap.addedCard.name}`
                        : `Undo cutting ${swap.cutCard?.name}`
                  }
                >
                  Undo this change
                </button>
              </article>
            ))
          ) : (
            <p className="doctor-muted">No changes applied yet.</p>
          )}
          {error && (
            <p className="doctor-error" role="status">
              {error}
            </p>
          )}
        </section>
      </section>
    </div>
  )
}
