import type { CollectionMode } from '../../recommendations.ts'
import type { CommanderPromotionInfo } from '../../domain/commander-promotion.ts'
import { cardScryfallUri, cardTypeLine, type DeckCard } from '../../domain/card-model.ts'
import { ArtLoading, FinishedCardImage, PrintingButton } from '../../shared/CardArt.tsx'
import { CardDetails, ModalCloseButton } from '../../shared/CardDetails.tsx'
import { OracleText } from '../../shared/ManaSymbols.tsx'
import { CommanderPromotion } from '../../shared/CommanderPromotion.tsx'

type DeckCardModalProps = {
  show: boolean
  selectedDeckCard: DeckCard | null
  selectedCollectionCard: DeckCard | null
  selectedGuidanceCard: boolean
  deckComplete: boolean
  selectedDeckCardIsCommander: boolean
  commanderPromotion: CommanderPromotionInfo | null
  promoteToCommander: () => void
  loadingArt: string
  cardEffects: boolean
  cycleSelectedDeckCardPrinting: () => void
  pendingCardRemoval: { board: 'deck' | 'sideboard'; index: number } | null
  selectedDeckCardLocation: { board: 'deck' | 'sideboard'; index: number } | null
  removeSelectedDeckCard: () => void
  addSelectedGuidanceCard: () => void
  closeDeckCard: () => void
  toggleCollectionSet: (set: string) => void
  collectionMode: CollectionMode
  collectionSets: string[]
}

export function DeckCardModal({
  show,
  selectedDeckCard,
  selectedCollectionCard,
  selectedGuidanceCard,
  deckComplete,
  selectedDeckCardIsCommander,
  commanderPromotion,
  promoteToCommander,
  loadingArt,
  cardEffects,
  cycleSelectedDeckCardPrinting,
  pendingCardRemoval,
  selectedDeckCardLocation,
  removeSelectedDeckCard,
  addSelectedGuidanceCard,
  closeDeckCard,
  toggleCollectionSet,
  collectionMode,
  collectionSets,
}: DeckCardModalProps) {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-card-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            closeDeckCard()
          }
        }}
      >
        <div className="export-heading">
          <p className="eyebrow">
            {selectedGuidanceCard
              ? 'Deck health suggestion'
              : selectedCollectionCard
                ? 'Collection card'
                : 'Deck card'}
          </p>
          <ModalCloseButton
            autoFocus
            onClick={closeDeckCard}
            label={`Close ${selectedDeckCard.name} details`}
          />
        </div>
        <div className="deck-card-modal-content">
          <figure className="deck-card-modal-art">
            <FinishedCardImage
              image={selectedDeckCard.image}
              alt={`${selectedDeckCard.name} card`}
              finish={selectedDeckCard.finish}
              effectsEnabled={cardEffects}
              className="deck-card-modal-image"
            />
            <ArtLoading active={loadingArt === selectedDeckCard.name} />
            <PrintingButton
              count={selectedDeckCard.printings?.length ?? 0}
              index={selectedDeckCard.printing ?? 0}
              loading={Boolean(loadingArt)}
              name={selectedDeckCard.name}
              onClick={() => void cycleSelectedDeckCardPrinting()}
            />
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
        {!selectedGuidanceCard &&
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
