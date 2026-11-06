import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

import { cardConstructionError } from '../../domain/commander-construction.ts'
import {
  toDeckCard,
  type CommanderDetails,
  type DeckCard,
  type ScryfallCard,
} from '../../domain/card-model.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { CardTile } from '../../shared/CardTile.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
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
  toSideboard: boolean
  zoneToggle: ReactNode
}

// Divides 6, 4, 3 and 2, so each page fills whole rows at every column count.
const pageStep = 24

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
  toSideboard,
  zoneToggle,
}: Props) {
  const dialog = useDialogFocus(true, onClose)
  const [shown, setShown] = useState(pageStep)
  const total = poolSize ?? cards.length
  const filtered = type !== 'all' || Boolean(mana.trim())
  const hidden = filteredCards.length - shown
  const filter = (set: Dispatch<SetStateAction<string>>, value: string) => {
    set(value)
    setShown(pageStep)
  }
  return (
    <div
      className="modal-backdrop collection-browser-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        {...dialog}
        className="export-modal collection-browser-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-browser-title"
      >
        <div className="export-heading collection-browser-heading">
          <div>
            <p className="eyebrow">Discovery</p>
            <h2 id="collection-browser-title">Cards from your chosen sets</h2>
            <p role="status">
              {state === 'loading'
                ? 'Loading legal collection cards…'
                : state === 'idle' && filteredCards.length > 0
                  ? filtered
                    ? `${filteredCards.length} of ${total} legal unique cards match`
                    : `${total} legal unique cards, shown in random order`
                  : ''}
            </p>
          </div>
          <ModalCloseButton onClick={onClose} label="Close collection browser" />
        </div>
        <div className="collection-browser-filters">
          <label>
            Card type{' '}
            <select value={type} onChange={(event) => filter(setType, event.target.value)}>
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
              onChange={(event) => filter(setMana, event.target.value)}
              placeholder="Any"
            />
          </label>
          {zoneToggle}
        </div>
        {state === 'error' && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {state === 'idle' && (
          <div className="collection-browser-grid">
            {filteredCards.slice(0, shown).map((card) => {
              const display = toDeckCard(card)
              const blocked = cardConstructionError(
                display,
                toSideboard ? sideboard : deck,
                commanderDetails?.colours ?? [],
              )
              return (
                <CardTile
                  key={`${card.name}-${card.set}-${card.collector_number}`}
                  className="collection-browser-tile"
                  art={
                    <button
                      className="collection-browser-art"
                      type="button"
                      aria-label={`Show details for ${card.name}`}
                      onClick={() => onOpenCard(card)}
                    >
                      {display.image ? (
                        <SmallCardImage image={display.image} placement="reference" />
                      ) : (
                        <span>No card art</span>
                      )}
                    </button>
                  }
                  name={<CardReference card={display} onOpen={() => onOpenCard(card)} />}
                  cost={display.manaCost || display.faces[0]?.manaCost}
                  detail={`${display.typeLine} · ${card.set.toUpperCase()}`}
                  actions={
                    <button
                      type="button"
                      className="export"
                      disabled={Boolean(blocked)}
                      title={blocked || undefined}
                      onClick={() => onAddCard(card)}
                    >
                      {toSideboard ? 'Add to sideboard' : 'Add to deck'}
                    </button>
                  }
                />
              )
            })}
          </div>
        )}
        {state === 'idle' && hidden > 0 && (
          <button
            className="export collection-browser-more"
            type="button"
            onClick={() => setShown(shown + pageStep)}
          >
            Show {Math.min(hidden, pageStep)} more ({hidden} left)
          </button>
        )}
        {state === 'idle' && !filteredCards.length && (
          <p className="collection-browser-empty">
            {filtered ? 'No cards match these filters.' : 'No legal cards in your chosen sets.'}
            {filtered && (
              <button
                type="button"
                className="export"
                onClick={() => {
                  filter(setType, 'all')
                  filter(setMana, '')
                }}
              >
                Clear filters
              </button>
            )}
          </p>
        )}
      </section>
    </div>
  )
}
