import type { CollectionMode } from '../../recommendations.ts'
import type { CommanderPromotionInfo } from '../../domain/commander-promotion.ts'
import { cardScryfallUri, cardTypeLine, type DeckCard } from '../../domain/card-model.ts'
import { ArtLoading, FinishedCardImage } from '../../shared/CardArt.tsx'
import { CardDetails, ModalCloseButton } from '../../shared/CardDetails.tsx'
import { OracleText } from '../../shared/ManaSymbols.tsx'
import { CommanderPromotion } from '../../shared/CommanderPromotion.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'

type DeckCardModalProps = {
  show: boolean
  selectedDeckCard: DeckCard | null
  selectedCollectionCard: DeckCard | null
  selectedGuidanceCard: boolean
  selectedCardReference: boolean
  deckComplete: boolean
  selectedDeckCardIsCommander: boolean
  commanderPromotion: CommanderPromotionInfo | null
  promoteToCommander: () => void
  loadingArt: string
  cycleSelectedDeckCardPrinting: () => void
  pendingCardRemoval: { board: 'deck' | 'sideboard'; index: number } | null
  selectedDeckCardLocation: { board: 'deck' | 'sideboard'; index: number } | null
  removeSelectedDeckCard: () => void
  addSelectedGuidanceCard: () => void
  closeDeckCard: () => void
  toggleCollectionSet: (set: string) => void
  collectionMode: CollectionMode
  collectionSets: string[]
  notice?: string
  addAction?: { label: string; disabled: boolean; error: string; onAdd: () => void }
}

// eslint-disable-next-line max-lines-per-function -- The focused modal markup stays together.
export function DeckCardModal({
  show,
  selectedDeckCard,
  selectedCollectionCard,
  selectedGuidanceCard,
  selectedCardReference,
  deckComplete,
  selectedDeckCardIsCommander,
  commanderPromotion,
  promoteToCommander,
  loadingArt,
  cycleSelectedDeckCardPrinting,
  pendingCardRemoval,
  selectedDeckCardLocation,
  removeSelectedDeckCard,
  addSelectedGuidanceCard,
  closeDeckCard,
  toggleCollectionSet,
  collectionMode,
  collectionSets,
  notice,
  addAction,
}: DeckCardModalProps) {
  const dialog = useDialogFocus(show && Boolean(selectedDeckCard), closeDeckCard)
  if (!show || !selectedDeckCard) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDeckCard()
      }}
    >
      <section
        className="export-modal deck-card-modal"
        {...dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-card-title"
      >
        <div className="export-heading">
          <p className="eyebrow">
            {selectedCardReference
              ? 'Card details'
              : selectedGuidanceCard
                ? 'Deck health suggestion'
                : selectedCollectionCard
                  ? 'Collection card'
                  : 'Deck card'}
          </p>
          <ModalCloseButton
            onClick={closeDeckCard}
            label={`Close ${selectedDeckCard.name} details`}
          />
        </div>
        <div className="deck-card-modal-content">
          <figure className="deck-card-modal-art">
            <FinishedCardImage
              image={selectedDeckCard.image}
              backImage={selectedDeckCard.backImage}
              alt={`${selectedDeckCard.name} card`}
              cardName={selectedDeckCard.name}
              finish={selectedDeckCard.finish}
              className="deck-card-modal-image"
              showFlipButton
              printing={{
                count: selectedDeckCard.printings?.length ?? 0,
                index: selectedDeckCard.printing ?? 0,
                loading: Boolean(loadingArt),
                name: selectedDeckCard.name,
                onClick: () => void cycleSelectedDeckCardPrinting(),
              }}
            />
            <ArtLoading active={loadingArt === selectedDeckCard.name} />
          </figure>
          <div className="deck-card-modal-copy">
            <div className="deck-card-modal-title">
              <h2 id="deck-card-title">{selectedDeckCard.name}</h2>
              <span className="deck-card-modal-mana">
                <OracleText text={selectedDeckCard.manaCost} />
              </span>
            </div>
            <p className="card-type-line">{cardTypeLine(selectedDeckCard)}</p>
            <p className="deck-card-description">
              <OracleText text={selectedDeckCard.detail} />
            </p>
            <CardDetails
              card={selectedDeckCard}
              source={{ label: 'Scryfall', uri: cardScryfallUri(selectedDeckCard) }}
              onToggleSet={() => toggleCollectionSet(selectedDeckCard.set)}
              collectionSelected={
                collectionMode !== 'none' && collectionSets.includes(selectedDeckCard.set)
              }
            />
          </div>
        </div>
        {notice && <p role="status">{notice}</p>}
        {addAction && (
          <div className="export-actions deck-card-modal-actions">
            {addAction.error && <p role="status">{addAction.error}</p>}
            <button
              type="button"
              className="primary"
              disabled={addAction.disabled}
              onClick={addAction.onAdd}
            >
              {addAction.label}
            </button>
          </div>
        )}
        {commanderPromotion && (
          <CommanderPromotion info={commanderPromotion} onPromote={promoteToCommander} />
        )}
        {selectedGuidanceCard && (
          <div className="export-actions deck-card-modal-actions">
            <button type="button" className="primary" onClick={addSelectedGuidanceCard}>
              {deckComplete ? 'Add to sideboard' : 'Add to deck'}
            </button>
          </div>
        )}
        {!selectedCardReference &&
          !selectedGuidanceCard &&
          !selectedDeckCardIsCommander &&
          selectedCollectionCard === null && (
            <div className="deck-card-modal-actions">
              <button
                type="button"
                className={`deck-card-modal-remove ${pendingCardRemoval?.board === selectedDeckCardLocation?.board && pendingCardRemoval?.index === selectedDeckCardLocation?.index ? 'confirm' : ''}`}
                onClick={removeSelectedDeckCard}
              >
                {pendingCardRemoval?.board === selectedDeckCardLocation?.board &&
                pendingCardRemoval?.index === selectedDeckCardLocation?.index
                  ? 'Confirm removal'
                  : `Remove from ${selectedDeckCardLocation?.board === 'sideboard' ? 'sideboard' : 'deck'}`}
              </button>
            </div>
          )}
      </section>
    </div>
  )
}
