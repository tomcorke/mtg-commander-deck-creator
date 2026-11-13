import type { DeckCard } from '../../domain/card-model.ts'
import { deckSections } from '../../domain/commander-catalog.ts'
import { displayDeckSection } from '../../app/useBuilderData.ts'
import type { SharedDeckEntry, SharedDeckView } from '../../app/share-actions.ts'
import { DeckBoardLayout, type DeckBoardGroup } from '../builder/DeckBoardLayout.tsx'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { DeckPrice } from '../../shared/DeckPrice.tsx'
import { OracleText } from '../../shared/ManaSymbols.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'

type Props = {
  sharedDeck: SharedDeckView | null
  /** Card details open over the builder; the preview steps aside until they close. */
  hidden: boolean
  hasCurrentDeck: boolean
  openCard: (card: DeckCard) => void
  copySharedDeck: () => void
  retry: (payload: string) => void
  closeModal: () => void
}

const finishLabel = (card: DeckCard) =>
  card.finish === 'foil' ? 'Foil' : card.finish === 'etched' ? 'Etched' : ''
const copies = (entries: SharedDeckEntry[]) =>
  entries.flatMap(({ card, quantity }) => Array.from({ length: quantity }, () => card))
const total = (entries: SharedDeckEntry[]) =>
  entries.reduce((sum, { quantity }) => sum + quantity, 0)

function SharedDeckGroups({
  entries,
  openCard,
}: {
  entries: SharedDeckEntry[]
  openCard: (card: DeckCard) => void
}) {
  const sectionOf = (entry: SharedDeckEntry) =>
    entry.board === 'commander'
      ? 'Commander'
      : entry.board === 'sideboard'
        ? 'Sideboard'
        : displayDeckSection(entry.card)
  const groups = [...deckSections, 'Sideboard']
    .map((section) => ({
      section,
      entries: entries.filter((entry) => sectionOf(entry) === section),
    }))
    .filter((group) => group.entries.length)
    .map(({ section, entries: groupEntries }): DeckBoardGroup => ({
      key: section,
      entries: groupEntries.length,
      node: (
        <section className="deck-group">
          <h3>
            {section}
            <span>{total(groupEntries)}</span>
          </h3>
          <ol>
            {groupEntries.map(({ card, quantity }) => (
              <li key={`${card.name}-${card.set}-${card.collectorNumber}-${card.finish}`}>
                <span className="deck-card-reference">
                  <CardReference
                    card={card}
                    className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`}
                    onOpen={() => openCard(card)}
                    thumbnail
                  />
                </span>
                <span className="deck-card-meta">
                  {quantity > 1 && <span className="card-quantity">×{quantity}</span>}
                  <span className="deck-mana">
                    <OracleText text={card.manaCost} />
                    {finishLabel(card) && (
                      <small className="finish-label">{finishLabel(card)}</small>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ),
    }))
  return (
    <div className="deck-board shared-deck-board">
      <DeckBoardLayout groups={groups} tiles={false} busy={false} />
    </div>
  )
}

function SharedDeckBody({
  sharedDeck,
  hasCurrentDeck,
  openCard,
}: Pick<Props, 'hasCurrentDeck' | 'openCard'> & { sharedDeck: SharedDeckView }) {
  if (sharedDeck.status === 'loading')
    return <p className="shared-deck-status">Loading the shared deck’s cards…</p>
  if (sharedDeck.status === 'error')
    return (
      <p className="form-error" role="alert">
        {sharedDeck.error}
      </p>
    )
  const main = sharedDeck.entries.filter(({ board }) => board !== 'sideboard')
  const sideboard = sharedDeck.entries.filter(({ board }) => board === 'sideboard')
  const mainCount = total(main)
  return (
    <>
      <p className="shared-deck-status">
        {mainCount} main-deck {mainCount === 1 ? 'card' : 'cards'}
        {sideboard.length > 0 && ` and ${total(sideboard)} in the sideboard`}. This is a read-only
        copy.{' '}
        {hasCurrentDeck
          ? 'Copying it replaces your current deck after you confirm; your current deck stays in Saved decks under Autosaved drafts.'
          : 'Copy it to start building from it.'}
      </p>
      {sharedDeck.missing.length > 0 && (
        <p className="form-error" role="alert">
          Not found on Scryfall, so left out: {sharedDeck.missing.join(', ')}.
        </p>
      )}
      <DeckPrice deck={copies(main)} sideboard={copies(sideboard)} showSource />
      <SharedDeckGroups entries={sharedDeck.entries} openCard={openCard} />
    </>
  )
}

/** The read-only preview a share link opens; nothing changes until the player copies it. */
export function SharedDeckModal({
  sharedDeck,
  hidden,
  hasCurrentDeck,
  openCard,
  copySharedDeck,
  retry,
  closeModal,
}: Props) {
  const busy = sharedDeck?.status === 'copying'
  const show = Boolean(sharedDeck) && !hidden && sharedDeck?.status !== 'confirming'
  const dialog = useDialogFocus(show, () => {
    if (!busy) closeModal()
  })
  if (!sharedDeck || !show) return null
  const commanders =
    'entries' in sharedDeck
      ? sharedDeck.entries.filter(({ board }) => board === 'commander').map(({ card }) => card.name)
      : []
  const title =
    'deck' in sharedDeck ? sharedDeck.deck.name || commanders.join(' & ') : 'Shared deck'
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) closeModal()
      }}
    >
      <section
        {...dialog}
        className="export-modal shared-deck-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-deck-title"
        aria-busy={sharedDeck.status === 'loading' || busy}
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Shared deck</p>
            <h2 id="shared-deck-title">{title}</h2>
          </div>
          <ModalCloseButton disabled={busy} onClick={closeModal} label="Close shared deck" />
        </div>
        <SharedDeckBody
          sharedDeck={sharedDeck}
          hasCurrentDeck={hasCurrentDeck}
          openCard={openCard}
        />
        {'error' in sharedDeck && sharedDeck.status !== 'error' && sharedDeck.error && (
          <p className="form-error" role="alert">
            {sharedDeck.error}
          </p>
        )}
        <div className="export-actions">
          <button className="export" type="button" disabled={busy} onClick={closeModal}>
            {hasCurrentDeck && sharedDeck.status !== 'error' ? 'Keep my current deck' : 'Close'}
          </button>
          {sharedDeck.status === 'error' ? (
            sharedDeck.retryable && (
              <button className="primary" type="button" onClick={() => retry(sharedDeck.payload)}>
                Try again
              </button>
            )
          ) : (
            <button
              className="primary"
              type="button"
              disabled={sharedDeck.status !== 'ready'}
              onClick={copySharedDeck}
            >
              {busy ? 'Copying…' : 'Copy to my decks'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
