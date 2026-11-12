import type { ReactNode } from 'react'

import { colourNames } from '../domain/commander-catalog.ts'
import {
  scryfallBackImage,
  scryfallImage,
  toDeckCard,
  type DeckCard,
  type ScryfallCard,
} from '../domain/card-model.ts'
import { deckCountLabel } from '../domain/commander-popularity.ts'
import { FinishedCardImage } from './CardArt.tsx'
import { CardReference } from './CardReference.tsx'
import { CardTile } from './CardTile.tsx'
import { IdentifiedThemes } from './IdentifiedThemes.tsx'
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

/**
 * A commander search result: art, name reference, cost, type line, and the caller's choose action.
 * With `insights`, up to three identified themes and the EDHREC deck count follow the type line;
 * the page states once that themes are estimates.
 */
export function CommanderChoiceTile({
  card,
  openCard,
  action,
  note,
  selected,
  insights,
}: {
  card: ScryfallCard
  openCard: (card: DeckCard) => void
  action: ReactNode
  note?: ReactNode
  selected?: boolean
  /** `deckCount` is undefined while loading or when EDHREC's lists omit the commander. */
  insights?: { deckCount?: number }
}) {
  const converted = toDeckCard(card)
  return (
    <CardTile
      className="commander-tile"
      selected={selected}
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
      name={<CardReference card={converted} preview={false} onOpen={() => openCard(converted)} />}
      cost={card.mana_cost ?? card.card_faces?.[0]?.mana_cost}
      detail={converted.typeLine}
      actions={action}
    >
      {insights && (
        <>
          <IdentifiedThemes card={converted} limit={3} compact />
          {/* The line keeps its height while the count loads, so rows do not jump. */}
          <p className="commander-deck-count">
            {insights.deckCount !== undefined && deckCountLabel(insights.deckCount)}
          </p>
        </>
      )}
      {note}
    </CardTile>
  )
}

/** Loading tiles with a result tile's parts, so the grid keeps its height when results arrive. */
export function CommanderTilePlaceholders() {
  return Array.from({ length: 12 }, (_, index) => (
    <div className="commander-tile-placeholder" aria-hidden="true" key={index}>
      <CardTile
        className="commander-tile"
        art={<span className="commander-placeholder" />}
        name={<span className="placeholder-text">Loading</span>}
        detail={<span className="placeholder-text">Loading type line</span>}
        actions={
          <button
            className="export commander-choose placeholder-text"
            type="button"
            disabled
            tabIndex={-1}
          >
            Choose
          </button>
        }
      />
    </div>
  ))
}
