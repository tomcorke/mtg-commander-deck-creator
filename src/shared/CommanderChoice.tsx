import type { ReactNode } from 'react'

import { colourNames } from '../domain/commander-catalog.ts'
import {
  scryfallBackImage,
  scryfallImage,
  toDeckCard,
  type DeckCard,
  type ScryfallCard,
} from '../domain/card-model.ts'
import { FinishedCardImage } from './CardArt.tsx'
import { CardReference } from './CardReference.tsx'
import { CardTile } from './CardTile.tsx'
import { ManaSymbols } from './ManaSymbols.tsx'

/** Colour identity toggles shared by the start screen and the change-commander dialog. */
export function ColourPicker({
  colours,
  toggleColour,
}: {
  colours: string[]
  toggleColour: (colour: string) => void
}) {
  return (
    <div className="colour-picker">
      {Object.entries(colourNames).map(([symbol, name]) => (
        <button
          className={colours.includes(symbol) ? 'selected' : ''}
          key={symbol}
          type="button"
          onClick={() => toggleColour(symbol)}
          aria-label={name}
          aria-pressed={colours.includes(symbol)}
        >
          <ManaSymbols symbols={[symbol]} decorative />
        </button>
      ))}
    </div>
  )
}

/** A commander search result: art, name reference, cost, and the caller's choose action. */
export function CommanderChoiceTile({
  card,
  openCard,
  action,
  note,
}: {
  card: ScryfallCard
  openCard: (card: DeckCard) => void
  action: ReactNode
  note?: ReactNode
}) {
  const converted = toDeckCard(card)
  return (
    <CardTile
      className="commander-tile"
      art={
        <div className="commander-discovery-art">
          <FinishedCardImage
            image={scryfallImage(card)}
            backImage={scryfallBackImage(card)}
            alt={`${card.name} card`}
            cardName={card.name}
            set={card.set}
            collectorNumber={card.collector_number}
            showFlipButton
          />
        </div>
      }
      name={<CardReference card={converted} onOpen={() => openCard(converted)} />}
      cost={card.mana_cost ?? card.card_faces?.[0]?.mana_cost}
      actions={action}
    >
      {note}
    </CardTile>
  )
}
