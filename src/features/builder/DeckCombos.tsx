import { useMemo, useState } from 'react'
import { cardNameKey, type DeckCard } from '../../domain/card-model.ts'
import {
  comboPageUrl,
  comboSourceName,
  comboSourceUrl,
  type Combo,
  type ComboCard,
} from '../../domain/combo-index.ts'
import { formatTerms } from '../../domain/glossary.ts'
import type { PowerTarget } from '../../domain/recommendation-types.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { ReviewStatus } from './ReviewStatus.tsx'
import type { DeckComboState } from './useDeckCombos.ts'

// How each Power setting treats combo pieces (docs/domain/combo-data.md). Bracket wording follows
// mtg-knowledge-base knowledge/topics/commander/format-policy.md; no setting assigns a bracket.
const powerTreatment: Record<
  PowerTarget,
  { note: string; includedKind: 'attention' | 'neutral' | 'good'; nearHeading: string }
> = {
  precon: {
    note: `Core power treats combos as a caution. ${formatTerms.twoCardCombos.definition} Talk to your table about any combo below, and add a card that completes one only on purpose.`,
    includedKind: 'attention',
    nearHeading: 'Cards that would add a combo',
  },
  upgraded: {
    note: `Upgraded power lists combos for table talk. ${formatTerms.twoCardCombos.definition}`,
    includedKind: 'neutral',
    nearHeading: 'One card away',
  },
  high: {
    note: 'High power treats combos as a way to win: cards that complete one are listed as additions to consider.',
    includedKind: 'good',
    nearHeading: 'Add one card to complete a combo',
  },
}
const preview = 6

function ComboCards({
  cards,
  deckCard,
  openCard,
  openCardByName,
}: {
  cards: ComboCard[]
  deckCard: (card: ComboCard) => DeckCard | undefined
  openCard: (card: DeckCard) => void
  openCardByName: (name: string) => void
}) {
  return (
    <span className="deck-review-combo-cards">
      {cards.map((card, position) => {
        const inDeck = deckCard(card)
        return (
          <span key={card.oracleId ?? card.name} className="deck-review-combo-card">
            {position > 0 && <span aria-hidden="true">+</span>}
            <CardReference
              thumbnail
              card={inDeck ?? { name: card.name, image: card.image ?? '' }}
              onOpen={() => (inDeck ? openCard(inDeck) : openCardByName(card.name))}
            />
          </span>
        )
      })}
    </span>
  )
}

const comboResults = (combo: Combo) =>
  combo.results.length > 3
    ? `${combo.results.slice(0, 3).join(' · ')} · and ${combo.results.length - 3} more`
    : combo.results.join(' · ') || 'Results not listed'

function SpellbookLink({ combo }: { combo: Combo }) {
  return (
    <a
      className="deck-review-combo-link"
      href={comboPageUrl(combo.id)}
      target="_blank"
      rel="noreferrer"
    >
      View on {comboSourceName}
    </a>
  )
}

function ShowMore({
  shown,
  total,
  expanded,
  toggle,
}: {
  shown: number
  total: number
  expanded: boolean
  toggle: () => void
}) {
  if (total <= shown && !expanded) return null
  return (
    <button type="button" className="export deck-review-combo-more" onClick={toggle}>
      {expanded ? 'Show fewer' : `Show all ${total}`}
    </button>
  )
}

// eslint-disable-next-line max-lines-per-function -- One review section; its rows are helpers.
export function DeckCombos({
  state,
  deck,
  powerTarget,
  selectCards,
  openCard,
  openCardByName,
}: {
  state: DeckComboState
  deck: DeckCard[]
  powerTarget: PowerTarget
  selectCards: (label: string, cardNames: string[]) => void
  openCard: (card: DeckCard) => void
  openCardByName: (name: string) => void
}) {
  const [allIncluded, setAllIncluded] = useState(false)
  const [allNear, setAllNear] = useState(false)
  const deckCards = useMemo(() => {
    const cards = new Map<string, DeckCard>()
    for (const card of deck) {
      if (card.oracleId && !cards.has(card.oracleId)) cards.set(card.oracleId, card)
      if (!cards.has(cardNameKey(card.name))) cards.set(cardNameKey(card.name), card)
    }
    return cards
  }, [deck])
  const deckCard = (card: ComboCard) =>
    (card.oracleId && deckCards.get(card.oracleId)) || deckCards.get(cardNameKey(card.name))
  const treatment = powerTreatment[powerTarget]
  const cardProps = { deckCard, openCard, openCardByName }

  if (state.status !== 'ready')
    return (
      <section className="deck-review-section deck-review-combos" aria-labelledby="combos-title">
        <h3 id="combos-title">Known combos</h3>
        <p role="status">
          {state.status === 'loading'
            ? 'Loading combo data…'
            : 'Combo data is unavailable right now, so combos are not checked.'}
        </p>
      </section>
    )
  const { included, nearMisses } = state.matches
  const exported = new Date(state.metadata.exportedAt).toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })
  const shownIncluded = allIncluded ? included : included.slice(0, preview)
  const shownNear = allNear ? nearMisses : nearMisses.slice(0, preview)
  return (
    <section className="deck-review-section deck-review-combos" aria-labelledby="combos-title">
      <div className="deck-review-combos-heading">
        <h3 id="combos-title">Known combos</h3>
        <ReviewStatus
          kind={included.length ? treatment.includedKind : 'neutral'}
          label={
            included.length
              ? `${included.length} in deck`
              : nearMisses.length
                ? 'None complete'
                : 'None found'
          }
        />
      </div>
      <p>
        From{' '}
        <a href={comboSourceUrl} target="_blank" rel="noreferrer">
          {comboSourceName}
        </a>
        , a community combo database (export of {exported}). A listed combo is not a bracket rating,
        and a deck can hold combos it does not list. Combos that need any card of a kind, rather
        than named cards, are not checked.
      </p>
      <p className="deck-review-combos-power">{treatment.note}</p>
      <h4>In this deck ({included.length})</h4>
      {included.length ? (
        <ul className="deck-review-combo-list">
          {shownIncluded.map((combo) => (
            <li key={combo.id} className="deck-review-combo">
              <ComboCards cards={combo.cards} {...cardProps} />
              <span className="deck-review-combo-results">{comboResults(combo)}</span>
              <span className="deck-review-combo-actions">
                <button
                  type="button"
                  className="export"
                  aria-label={`Show the ${combo.cards.length} cards of this combo in the deck list`}
                  onClick={() =>
                    selectCards(
                      `Combo: ${combo.cards.map(({ name }) => name).join(' + ')}`,
                      combo.cards.map((card) => deckCard(card)?.name ?? card.name),
                    )
                  }
                >
                  Show in deck
                </button>
                <SpellbookLink combo={combo} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="deck-review-empty">No complete combo found.</p>
      )}
      <ShowMore
        shown={preview}
        total={included.length}
        expanded={allIncluded}
        toggle={() => setAllIncluded(!allIncluded)}
      />
      <h4>
        {treatment.nearHeading} ({nearMisses.length})
      </h4>
      {nearMisses.length ? (
        <ul className="deck-review-combo-list">
          {shownNear.map(({ card, combos }) => {
            const [best] = combos
            return (
              <li key={card.oracleId ?? card.name} className="deck-review-combo near">
                <span className="deck-review-combo-missing">
                  <CardReference
                    thumbnail
                    card={{ name: card.name, image: card.image ?? '' }}
                    onOpen={() => openCardByName(card.name)}
                  />
                  <span>
                    completes {combos.length} {combos.length === 1 ? 'combo' : 'combos'}
                  </span>
                </span>
                <span className="deck-review-combo-with">
                  <span>With</span>
                  <ComboCards cards={best.cards.filter((item) => deckCard(item))} {...cardProps} />
                </span>
                <span className="deck-review-combo-results">{comboResults(best)}</span>
                <span className="deck-review-combo-actions">
                  <SpellbookLink combo={best} />
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="deck-review-empty">No combo is one card away.</p>
      )}
      <ShowMore
        shown={preview}
        total={nearMisses.length}
        expanded={allNear}
        toggle={() => setAllNear(!allNear)}
      />
    </section>
  )
}
