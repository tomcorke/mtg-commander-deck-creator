import type { Dispatch, SetStateAction } from 'react'

import { cardConstructionError } from '../../domain/commander-construction.ts'
import {
  scryfallImage,
  toDeckCard,
  type CommanderDetails,
  type DeckCard,
  type ScryfallCard,
} from '../../domain/card-model.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'

type Props = {
  cards: ScryfallCard[]
  error: string
  state: 'idle' | 'loading' | 'error'
  poolSize: number | null
  filteredCards: ScryfallCard[]
  type: string
  mana: string
  setType: Dispatch<SetStateAction<string>>
  setMana: Dispatch<SetStateAction<string>>
  deck: DeckCard[]
  sideboard: DeckCard[]
  commanderDetails: CommanderDetails | null
  onClose: () => void
  onOpenCard: (card: ScryfallCard) => void
  onAddCard: (card: ScryfallCard) => void
}

// eslint-disable-next-line max-lines-per-function -- Preserve the established collection-browser markup while extracting it as one focused dialog.
export function CollectionBrowserDialog({
  cards,
  error,
  state,
  poolSize,
  filteredCards,
  type,
  mana,
  setType,
  setMana,
  deck,
  sideboard,
  commanderDetails,
  onClose,
  onOpenCard,
  onAddCard,
}: Props) {
  return (
    <div
      className="modal-backdrop collection-browser-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="collection-browser collection-browser-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-browser-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      >
        <div className="collection-browser-heading">
          <div>
            <p className="eyebrow">Discovery</p>
            <h2 id="collection-browser-title">Cards from your chosen sets</h2>
            <p>{poolSize ?? cards.length} legal unique cards, shown in random order.</p>
          </div>
          <ModalCloseButton autoFocus onClick={onClose} label="Close collection browser" />
        </div>
        <div className="collection-browser-filters">
          <label>
            Card type{' '}
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              <option value="creature">Creatures</option>
              <option value="artifact">Artifacts</option>
              <option value="enchantment">Enchantments</option>
              <option value="instant">Instants</option>
              <option value="sorcery">Sorceries</option>
              <option value="land">Lands</option>
            </select>
          </label>
          <label>
            Mana value{' '}
            <input
              type="number"
              min="0"
              max="16"
              value={mana}
              onChange={(event) => setMana(event.target.value)}
              placeholder="Any"
            />
          </label>
        </div>
        {state === 'loading' && <p role="status">Loading legal collection cards…</p>}
        {state === 'error' && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {state === 'idle' && (
          <div className="collection-browser-grid">
            {filteredCards.map((card) => (
              <article key={`${card.name}-${card.set}-${card.collector_number}`}>
                <button
                  type="button"
                  className="collection-card-open"
                  onClick={() => onOpenCard(card)}
                >
                  <div>
                    <SmallCardImage image={scryfallImage(card)} />
                  </div>
                  <h3>{card.name}</h3>
                  <p>{card.type_line}</p>
                  <span>
                    {card.cmc ?? 0} mana · {card.set.toUpperCase()}
                  </span>
                  <small>View details</small>
                </button>
                <button
                  type="button"
                  disabled={Boolean(
                    cardConstructionError(
                      toDeckCard(card),
                      deck.length < 100 ? deck : sideboard,
                      commanderDetails?.colours ?? [],
                    ),
                  )}
                  onClick={() => onAddCard(card)}
                >
                  Add to deck
                </button>
              </article>
            ))}
          </div>
        )}
        {state === 'idle' && !filteredCards.length && <p>No cards match those filters.</p>}
      </section>
    </div>
  )
}
