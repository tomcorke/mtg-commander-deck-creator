import { useState } from 'react'
import type { Card, DeckCard } from '../../domain/card-model.ts'
import type { startingDeckSummary } from '../../domain/bulk-add.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { ReviewCardTile } from './DeckReviewCard.tsx'

const preview = 12
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Deck review's list of the cards an app-built starting deck added, with one-step undo. */
export function StartingDeckDraft({
  summary,
  openCard,
  undo,
}: {
  summary: NonNullable<ReturnType<typeof startingDeckSummary>>
  openCard: (card: Card | DeckCard) => void
  undo: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? summary.cards : summary.cards.slice(0, preview)
  return (
    <section
      id="starting-deck-draft"
      className="doctor-findings starting-deck-draft"
      aria-labelledby="starting-deck-draft-title"
    >
      <div className="doctor-section-heading">
        <div>
          <p className="eyebrow">App draft, not a tuned list</p>
          <h2 id="starting-deck-draft-title">Starting deck</h2>
        </div>
        <button className="export" type="button" onClick={undo}>
          Undo starting deck
        </button>
      </div>
      <p>
        The app added {plural(summary.total, 'card')}: its top-ranked picks for your role targets
        and theme, then lands. Nobody tuned this list. Check the findings below and swap out cards
        you don’t want. Undo removes every card the draft added.
      </p>
      {summary.extraBasics > 0 && (
        <p className="doctor-muted">
          Suggestions ran short, so {plural(summary.extraBasics, 'extra basic land')} filled the
          last slots. Replace them as you find better cards.
        </p>
      )}
      {summary.basics.length > 0 && (
        <p className="doctor-muted">
          Basic lands:{' '}
          {summary.basics.map(({ card, count }, index) => (
            <span key={card.name}>
              {index > 0 && ', '}
              {count}× <CardReference card={card} onOpen={() => openCard(card)} />
            </span>
          ))}
        </p>
      )}
      {summary.cards.length > 0 && (
        <div className="doctor-card-grid">
          {shown.map((card) => (
            <ReviewCardTile key={card.name} card={card} status="App draft" openCard={openCard} />
          ))}
        </div>
      )}
      {summary.cards.length > preview && (
        <button className="export" type="button" onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Show fewer' : `Show all ${summary.cards.length} drafted cards`}
        </button>
      )}
    </section>
  )
}
