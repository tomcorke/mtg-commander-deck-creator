import { type Dispatch, type SetStateAction } from 'react'

import type { SavedDeck } from '../../deck-state.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'

type SavedDecksModalProps = {
  show: boolean
  commander: string
  deckName: string
  setDeckName: (value: string) => void
  storeDeck: () => void
  deckNameDuplicate: boolean
  activeSavedDeck: SavedDeck | undefined
  activeDeckDelta: { added: number; removed: number } | null
  savedDecks: SavedDeck[]
  pendingSavedDeckRemoval: string
  setPendingSavedDeckRemoval: Dispatch<SetStateAction<string>>
  loadSavedDeck: (saved: SavedDeck) => void
  removeSavedDeck: (saved: SavedDeck) => void
  closeModal: () => void
}

export function SavedDecksModal({
  show,
  commander,
  deckName,
  setDeckName,
  storeDeck,
  deckNameDuplicate,
  activeSavedDeck,
  activeDeckDelta,
  savedDecks,
  pendingSavedDeckRemoval,
  setPendingSavedDeckRemoval,
  loadSavedDeck,
  removeSavedDeck,
  closeModal,
}: SavedDecksModalProps) {
  if (!show) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        className="export-modal saved-decks-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-decks-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Local decks</p>
            <h2 id="saved-decks-title">Saved decks</h2>
          </div>
          <ModalCloseButton onClick={() => closeModal()} label="Close saved decks" />
        </div>
        {commander && (
          <>
            <form
              className="save-deck-form"
              onSubmit={(event) => {
                event.preventDefault()
                storeDeck()
              }}
            >
              <label>
                <span className="sr-only">Deck name</span>
                <input
                  className="clearable-input"
                  value={deckName}
                  onChange={(event) => setDeckName(event.target.value)}
                  aria-label="Deck name"
                  aria-invalid={deckNameDuplicate}
                  aria-describedby={deckNameDuplicate ? 'deck-name-warning' : undefined}
                />
                <button
                  type="button"
                  className="clear-deck-name"
                  onClick={() => setDeckName('')}
                  aria-label="Clear deck name"
                >
                  ×
                </button>
                {deckNameDuplicate && (
                  <small id="deck-name-warning" className="deck-name-warning">
                    Name already used
                  </small>
                )}
              </label>
              <button className="primary" disabled={!deckName.trim() || deckNameDuplicate}>
                {activeSavedDeck ? 'Overwrite save' : 'Save deck'}
              </button>
            </form>
            {activeSavedDeck && (
              <p className="overwrite-notice">
                This will overwrite <b>{activeSavedDeck.name}</b> with{' '}
                <span className="delta-added">+{activeDeckDelta?.added} added</span> and{' '}
                <span className="delta-removed">−{activeDeckDelta?.removed} removed</span>.
              </p>
            )}
          </>
        )}
        <div className="saved-deck-list">
          {savedDecks.map((saved) => (
            <article key={saved.id}>
              <div className="saved-deck-details">
                <b>{saved.name}</b>
                <span>
                  {saved.state.commander} · {saved.state.deck.length}/100 cards
                </span>
                <small>Updated {new Date(saved.updatedAt).toLocaleString()}</small>
              </div>
              <button className="saved-deck-load" onClick={() => loadSavedDeck(saved)}>
                Load
              </button>
              <span className="saved-deck-delete-wrap">
                <button
                  className={`saved-deck-delete ${pendingSavedDeckRemoval === saved.id ? 'confirm' : ''}`}
                  onClick={() =>
                    pendingSavedDeckRemoval === saved.id
                      ? removeSavedDeck(saved)
                      : setPendingSavedDeckRemoval(saved.id)
                  }
                  aria-label={
                    pendingSavedDeckRemoval === saved.id
                      ? `Confirm deletion of ${saved.name}`
                      : `Delete ${saved.name}`
                  }
                >
                  {pendingSavedDeckRemoval === saved.id ? 'Confirm' : 'Delete'}
                </button>
                {pendingSavedDeckRemoval === saved.id && (
                  <span className="saved-delete-confirm" role="tooltip">
                    Click again to delete
                  </span>
                )}
              </span>
            </article>
          ))}
        </div>
        {!savedDecks.length && <p className="saved-decks-empty">No saved decks yet.</p>}
      </section>
    </div>
  )
}
