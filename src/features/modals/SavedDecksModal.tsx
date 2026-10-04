import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useDialogFocus } from '../../shared/hooks.ts'

import type { SavedDeck } from '../../deck-state.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import type { DeckCard } from '../../domain/card-model.ts'
import type { AutosavedDraft, DeckWorkspace } from '../../autosaves.ts'
import { DraftSavedTime } from './WorkspaceNotice.tsx'

type SavedDecksModalProps = {
  show: boolean
  showBuilder: boolean
  workspace: DeckWorkspace
  autosave: ReturnType<DeckWorkspace['getSnapshot']>
  loadAutosave: (draft: AutosavedDraft) => void
  openCard: (card: DeckCard) => void
  loading: boolean
  commander: string
  deckName: string
  setDeckName: (value: string) => void
  storeDeck: (overwrite?: boolean) => void
  deckNameDuplicate: boolean
  activeSavedDeck: SavedDeck | undefined
  savedDeckChanged: boolean
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
  showBuilder,
  workspace,
  autosave,
  loadAutosave,
  openCard,
  loading,
  commander,
  deckName,
  setDeckName,
  storeDeck,
  deckNameDuplicate,
  activeSavedDeck,
  savedDeckChanged,
  activeDeckDelta,
  savedDecks,
  pendingSavedDeckRemoval,
  setPendingSavedDeckRemoval,
  loadSavedDeck,
  removeSavedDeck,
  closeModal,
}: SavedDecksModalProps) {
  const dialog = useDialogFocus(show, closeModal)
  const [retentionResult, setRetentionResult] = useState('')
  async function applyLimits(values: FormData) {
    setRetentionResult('')
    const limits = {
      maxCount: Number(values.get('maxCount')),
      maxAgeDays: Number(values.get('maxAgeDays')),
    }
    const count = await workspace.previewRetention(limits)
    if (
      count &&
      !window.confirm(
        `Apply limits and delete ${count} inactive draft${count === 1 ? '' : 's'}? Manual saves and decks open in tabs are kept.`,
      )
    )
      return
    const removed = await workspace.setRetention(limits)
    if (removed !== undefined)
      setRetentionResult(
        `Limits applied. Deleted ${removed} inactive draft${removed === 1 ? '' : 's'}.`,
      )
  }
  useEffect(() => {
    if (!show) return
    void workspace.refresh()
  }, [show, workspace])
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
        {...dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-decks-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Local decks</p>
            <h2 id="saved-decks-title">Drafts and saved decks</h2>
          </div>
          <ModalCloseButton onClick={() => closeModal()} label="Close saved decks" />
        </div>
        <h3 className="draft-section-title">Autosaved drafts</h3>
        <p className="draft-help">
          Opening a draft makes a separate copy in this tab; edits do not change the original.
        </p>
        <div className="saved-deck-list autosaved-draft-list">
          {autosave.drafts.map((draft) => (
            <article key={draft.id}>
              <div className="saved-deck-details">
                {draft.name && draft.name !== draft.state.commander && <b>{draft.name}</b>}
                <CardReference
                  card={draft.state.deck[0]}
                  thumbnail
                  onOpen={() => openCard(draft.state.deck[0])}
                />
                <small>
                  {draft.state.deck.length}/100 cards · Saved{' '}
                  <DraftSavedTime updatedAt={draft.updatedAt} />
                </small>
                {draft.id === autosave.id ? (
                  <small>Current workspace</small>
                ) : (
                  autosave.activeIds.includes(draft.id) && (
                    <small>Open in another tab — opening makes a copy</small>
                  )
                )}
              </div>
              {(!showBuilder || draft.id !== autosave.id) && (
                <button
                  className="saved-deck-load"
                  type="button"
                  disabled={loading || autosave.busy}
                  onClick={() => loadAutosave(draft)}
                >
                  Open in this tab
                </button>
              )}
              <span className="saved-deck-delete-wrap">
                <button
                  type="button"
                  className={`saved-deck-delete ${pendingSavedDeckRemoval === `draft:${draft.id}` ? 'confirm' : ''}`}
                  disabled={
                    !autosave.cleanupAvailable ||
                    autosave.busy ||
                    draft.id === autosave.id ||
                    autosave.activeIds.includes(draft.id)
                  }
                  title={
                    draft.id === autosave.id || autosave.activeIds.includes(draft.id)
                      ? 'Decks open in a tab cannot be deleted'
                      : undefined
                  }
                  onClick={() => {
                    if (pendingSavedDeckRemoval !== `draft:${draft.id}`) {
                      setPendingSavedDeckRemoval(`draft:${draft.id}`)
                      return
                    }
                    setPendingSavedDeckRemoval('')
                    // The asynchronous delete disables this button; focus a stable control first.
                    dialog.ref.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus()
                    void workspace.deleteDraft(draft)
                  }}
                  aria-label={`${pendingSavedDeckRemoval === `draft:${draft.id}` ? 'Confirm deletion of' : 'Delete'} draft ${draft.name || draft.state.commander}`}
                >
                  {pendingSavedDeckRemoval === `draft:${draft.id}` ? 'Confirm' : 'Delete'}
                </button>
                {pendingSavedDeckRemoval === `draft:${draft.id}` && (
                  <span className="saved-delete-confirm" role="tooltip">
                    Click again to delete
                  </span>
                )}
              </span>
            </article>
          ))}
        </div>
        {!autosave.drafts.length && <p className="saved-decks-empty">No autosaved drafts yet.</p>}
        {autosave.draftDeleteError && (
          <p className="draft-help" role="status">
            {autosave.draftDeleteError}
          </p>
        )}
        <form
          className="autosave-retention"
          key={`${autosave.retention.maxCount}:${autosave.retention.maxAgeDays}`}
          onSubmit={(event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            void applyLimits(values)
          }}
        >
          <h4>Keep autosaves</h4>
          <div>
            <label>
              Maximum drafts
              <input
                className="clearable-input"
                type="number"
                min="1"
                max="200"
                step="1"
                required
                name="maxCount"
                defaultValue={autosave.retention.maxCount}
                disabled={!autosave.cleanupAvailable}
              />
            </label>
            <label>
              Age limit (days)
              <input
                className="clearable-input"
                type="number"
                min="1"
                max="365"
                step="1"
                required
                name="maxAgeDays"
                defaultValue={autosave.retention.maxAgeDays}
                disabled={!autosave.cleanupAvailable}
              />
            </label>
            <button
              className="saved-deck-load"
              disabled={!autosave.cleanupAvailable || autosave.busy}
            >
              Apply limits
            </button>
          </div>
          <p className="draft-help">
            Limits remove only inactive drafts. Decks open in any tab and manual saves are kept,
            even above the maximum.
          </p>
          {retentionResult && (
            <p className="draft-help" role="status">
              {retentionResult}
            </p>
          )}
          {!autosave.cleanupAvailable && (
            <p className="draft-help">
              Automatic cleanup is off because this browser cannot detect live workspaces safely.
            </p>
          )}
        </form>
        <h3 className="draft-section-title">Manual saves</h3>
        {commander && (
          <>
            <form
              className="save-deck-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (
                  deckNameDuplicate &&
                  !window.confirm(
                    `Overwrite the manual save named "${deckName.trim()}"? This replaces its saved deck.`,
                  )
                )
                  return
                storeDeck(deckNameDuplicate)
              }}
            >
              <label>
                <span className="sr-only">Deck name</span>
                <input
                  className="clearable-input"
                  value={deckName}
                  onChange={(event) => setDeckName(event.target.value)}
                  aria-label="Deck name"
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
                    A save already uses this name. Overwrite it to replace its deck.
                  </small>
                )}
              </label>
              <button className="primary" disabled={!deckName.trim()}>
                {activeSavedDeck || deckNameDuplicate ? 'Overwrite save' : 'Save deck'}
              </button>
            </form>
            {activeSavedDeck && savedDeckChanged && !deckNameDuplicate && (
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
                {saved.name !== saved.state.commander && <b>{saved.name}</b>}
                <CardReference
                  card={saved.state.deck[0]}
                  thumbnail
                  onOpen={() => openCard(saved.state.deck[0])}
                />
                <small>{saved.state.deck.length}/100 cards</small>
                <small>
                  Updated <DraftSavedTime updatedAt={saved.updatedAt} />
                </small>
              </div>
              <button
                className="saved-deck-load"
                type="button"
                disabled={loading || autosave.busy}
                onClick={() => loadSavedDeck(saved)}
              >
                Load
              </button>
              <span className="saved-deck-delete-wrap">
                <button
                  type="button"
                  className={`saved-deck-delete ${pendingSavedDeckRemoval === saved.id ? 'confirm' : ''}`}
                  onClick={() => {
                    if (pendingSavedDeckRemoval !== saved.id) {
                      setPendingSavedDeckRemoval(saved.id)
                      return
                    }
                    dialog.ref.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus()
                    removeSavedDeck(saved)
                  }}
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
