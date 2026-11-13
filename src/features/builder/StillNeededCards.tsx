import { useState } from 'react'
import type { Card, DeckCard } from '../../domain/card-model.ts'
import { stillNeededGroups } from '../../domain/owned-cards.ts'
import { ReviewCardTile } from './DeckReviewCard.tsx'

const preview = 12
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Deck review's list of main-deck cards, commanders included, that owned cards do not cover. */
export function StillNeededCards({
  groups,
  openCard,
  selectCards,
}: {
  groups: ReturnType<typeof stillNeededGroups<DeckCard>>
  openCard: (card: Card | DeckCard) => void
  selectCards: (label: string, cardNames: string[]) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const total = groups.reduce((sum, { needed }) => sum + needed, 0)
  const shown = showAll ? groups : groups.slice(0, preview)
  return (
    <section
      id="still-needed"
      tabIndex={-1}
      className="doctor-findings still-needed"
      aria-labelledby="still-needed-title"
    >
      <div className="doctor-section-heading">
        <div>
          <p className="eyebrow">Your owned cards</p>
          <h2 id="still-needed-title">Still needed</h2>
        </div>
        {total > 0 && (
          <button
            className="export"
            type="button"
            aria-label={`Show ${plural(total, 'still-needed card')} in the deck list`}
            onClick={() =>
              selectCards(
                'Still needed',
                groups.map(({ card }) => card.name),
              )
            }
          >
            Show {total} in deck
          </button>
        )}
      </div>
      <p>
        {total
          ? `${plural(total, 'main-deck card')}, commanders included, that your owned cards do not cover. Each owned copy covers one card of that name, in any printing; the sideboard is left out. Export can list them.`
          : 'Your owned cards cover every card in the main deck.'}
      </p>
      {total > 0 && (
        <div className="doctor-card-grid">
          {shown.map(({ card, needed, inDeck }) => (
            <ReviewCardTile
              key={card.name}
              card={card}
              status={inDeck > 1 ? `Need ${needed} of ${inDeck}` : 'Still needed'}
              openCard={openCard}
            />
          ))}
        </div>
      )}
      {groups.length > preview && (
        <button className="export" type="button" onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Show fewer' : `Show all ${total} still-needed cards`}
        </button>
      )}
    </section>
  )
}
