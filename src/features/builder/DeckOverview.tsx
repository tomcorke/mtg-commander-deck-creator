import type { Dispatch, ReactNode, SetStateAction } from 'react'

import { colourNames } from '../../domain/commander-catalog.ts'
import type { DeckCard } from '../../domain/card-model.ts'
import { deckTagCoverage } from '../../deck-review.ts'
import {
  analyseDeck,
  curveBucket,
  isSnowManaSource,
  manaGuidanceSymbols,
  requiredPipsForCard,
  rolesForCard,
  targetKeys,
  targetLabels,
  type DeckTargets,
  type ManaGuidanceSymbol,
} from '../../deck-analysis.ts'
import { ManaSymbols } from '../../shared/ManaSymbols.tsx'
import { ManaCurve } from './ManaCurve.tsx'

type DeckOverviewProps = {
  deck: DeckCard[]
  sideboardCount: number
  commanderCount: number
  commanderColours: string[]
  theme: string
  activeSubThemes: string[]
  analysis: ReturnType<typeof analyseDeck>
  deckTargets: DeckTargets
  setDeckTargets: Dispatch<SetStateAction<DeckTargets>>
  displayedTypeCounts: readonly (readonly [string, number])[]
  selectManaValue: (value: number) => void
  selectCards: (label: string, cardNames: string[]) => void
}

type StatusKind = 'good' | 'attention' | 'neutral'

function ReviewStatus({ kind, label }: { kind: StatusKind; label: string }) {
  return (
    <span className={`deck-review-status ${kind}`}>
      <b aria-hidden="true">{kind === 'good' ? '✓' : kind === 'attention' ? '!' : '·'}</b>
      {label}
    </span>
  )
}

function FilterButton({
  label,
  count,
  className = '',
  onClick,
  children,
}: {
  label: string
  count: number
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      className={`export deck-review-filter ${className}`}
      type="button"
      aria-label={`Show ${count} matching ${count === 1 ? 'card' : 'cards'} for ${label} in the deck list`}
      disabled={!count}
      onClick={onClick}
    >
      {children}
      <span className="deck-review-filter-action">Show {count} in deck</span>
    </button>
  )
}

const cardNames = (cards: DeckCard[]) => [...new Set(cards.map((card) => card.name))]
const manaGuidanceName = (symbol: ManaGuidanceSymbol) =>
  symbol === 'C' ? 'Colourless' : symbol === 'S' ? 'Snow' : colourNames[symbol]

export function DeckOverview({
  deck,
  sideboardCount,
  commanderCount,
  commanderColours,
  theme,
  activeSubThemes,
  analysis,
  deckTargets,
  setDeckTargets,
  displayedTypeCounts,
  selectManaValue,
  selectCards,
}: DeckOverviewProps) {
  const mainboard = deck.slice(commanderCount)
  const spellCount = analysis.curve.reduce(
    (sum, point) => sum + point.permanents + point.nonPermanents,
    0,
  )
  const expensiveCount = deck.filter(
    (card) => curveBucket(card) !== null && card.manaValue >= 5,
  ).length
  const selectedTags = [...new Set([theme, ...activeSubThemes].filter(Boolean))]
  const themeCoverage = deckTagCoverage(mainboard, selectedTags)
  const selectedCoverage = themeCoverage.filter(({ tag }) => selectedTags.includes(tag))
  const inferredCoverage = themeCoverage
    .filter(({ tag, cards }) => !selectedTags.includes(tag) && cards.length > 1)
    .sort((left, right) => right.cards.length - left.cards.length)
    .slice(0, 5)
  const identity = (['W', 'U', 'B', 'R', 'G'] as const).filter((colour) =>
    commanderColours.includes(colour),
  )
  const colourStats = manaGuidanceSymbols(identity).map((colour: ManaGuidanceSymbol) => {
    const sourceCards = deck.filter((card) =>
      colour === 'S' ? isSnowManaSource(card) : card.producedMana.includes(colour),
    )
    const requiredCardNames = new Set(
      deck.filter((card) => requiredPipsForCard(card, colour) > 0).map((card) => card.name),
    )
    const matchingCards = deck.filter(
      (card) => sourceCards.includes(card) || requiredCardNames.has(card.name),
    )
    const pips = analysis.required[colour]
    return { colour, pips, sourceCards, matchingCards }
  })
  const typeStats = displayedTypeCounts.map(([type, count]) => ({
    type,
    count,
    cards: deck.filter((card) =>
      type === 'Land'
        ? rolesForCard(card).includes('lands')
        : type === 'Other'
          ? ![card.typeLine, ...card.faces.map((face) => face.typeLine)].some((line) =>
              /\b(?:Creature|Artifact|Enchantment|Instant|Sorcery|Land)\b/.test(line),
            )
          : [card.typeLine, ...card.faces.map((face) => face.typeLine)].some((line) =>
              new RegExp(`\\b${type}\\b`).test(line),
            ),
    ),
  }))
  const roleStats = targetKeys.map((key) => ({
    key,
    cards: deck.filter((card) => rolesForCard(card).includes(key)),
    count: analysis.counts[key],
    target: deckTargets[key],
  }))
  const roleTargetsMet = roleStats.filter(({ count, target }) => count >= target).length
  const unsupportedColours = colourStats.filter(
    ({ pips, sourceCards }) => pips > 0 && sourceCards.length === 0,
  ).length
  const hasColourSignal = colourStats.some(({ pips, sourceCards }) => pips || sourceCards.length)
  const selectedTagsFound = selectedCoverage.filter(({ cards }) => cards.length > 0).length
  const maxTypeCount = Math.max(1, ...typeStats.map(({ count }) => count))

  return (
    <section className="doctor-overview" aria-labelledby="deck-overview-title">
      <div className="doctor-section-heading">
        <div>
          <p className="eyebrow">Your deck</p>
          <h2 id="deck-overview-title">Deck overview</h2>
        </div>
      </div>
      <p className="deck-review-intro">
        {deck.length} / 100 main-deck cards, including{' '}
        {commanderCount === 2 ? 'both commanders' : 'the commander'}. {sideboardCount} sideboard{' '}
        {sideboardCount === 1 ? 'card' : 'cards'} excluded from analysis. Select any count to show
        matching cards in the deck list.
      </p>

      <div className="deck-review-grid">
        <section className="deck-review-section deck-review-overview">
          <h3>At a glance</h3>

          <div className="deck-review-findings">
            <div>
              <ReviewStatus
                kind={roleTargetsMet === targetKeys.length ? 'good' : 'attention'}
                label={roleTargetsMet === targetKeys.length ? 'On target' : 'Needs attention'}
              />
              <b>
                {roleTargetsMet} of {targetKeys.length} role targets met
              </b>
            </div>
            <div>
              <ReviewStatus
                kind={unsupportedColours ? 'attention' : hasColourSignal ? 'good' : 'neutral'}
                label={
                  unsupportedColours
                    ? 'Possible gap'
                    : hasColourSignal
                      ? 'Mana sources found'
                      : 'No coloured mana to check'
                }
              />
              <b>
                {unsupportedColours} colour{unsupportedColours === 1 ? '' : 's'} with pip demand and
                no mana source
              </b>
            </div>
            <div>
              <ReviewStatus
                kind={
                  !selectedTags.length
                    ? 'neutral'
                    : selectedTagsFound === selectedTags.length
                      ? 'good'
                      : 'attention'
                }
                label={
                  !selectedTags.length
                    ? 'No theme selected'
                    : selectedTagsFound === selectedTags.length
                      ? 'Theme cards found'
                      : 'Check theme support'
                }
              />
              <b>
                {selectedTags.length
                  ? `${selectedTagsFound} of ${selectedTags.length} selected themes have cards`
                  : 'Choose a theme to check its cards'}
              </b>
            </div>
          </div>
        </section>

        <section className="deck-review-section">
          <h3>Mana-value curve</h3>
          <p>
            {spellCount} nonland spells · average mana value {analysis.averageManaValue.toFixed(1)}
            {' · '}
            {expensiveCount} cost 5 or more. Select a bar to highlight those cards in the deck list.
          </p>
          <ManaCurve analysis={analysis} selected={null} onSelect={selectManaValue} />
        </section>

        <section className="deck-review-section">
          <h3>Role coverage</h3>
          <p>Adjust targets; select a row to highlight matching cards.</p>
          <div className="deck-review-role-list">
            {roleStats.map(({ key, cards, count, target }) => {
              const gap = Math.max(0, target - count)
              return (
                <div className="deck-review-role" key={key}>
                  <FilterButton
                    label={targetLabels[key]}
                    count={cards.length}
                    className="deck-review-role-filter"
                    onClick={() => selectCards(targetLabels[key], cardNames(cards))}
                  >
                    <span className="deck-review-row-heading">
                      <b>{targetLabels[key]}</b>
                      <strong>
                        {count} / {target}
                      </strong>
                    </span>
                    <span className="deck-review-ratio">
                      <i
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, target)) * 100)}%`,
                        }}
                      />
                    </span>
                    <ReviewStatus
                      kind={gap ? 'attention' : 'good'}
                      label={gap ? `${gap} below target` : 'Target met'}
                    />
                  </FilterButton>
                  <label className="deck-review-target">
                    Target
                    <input
                      type="number"
                      min="0"
                      max="99"
                      aria-label={`${targetLabels[key]} target`}
                      value={target}
                      onChange={(event) =>
                        setDeckTargets((current) => ({
                          ...current,
                          [key]: Math.max(0, Number(event.target.value)),
                        }))
                      }
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </section>

        <section className="deck-review-section">
          <h3>Mana costs</h3>
          <p>
            Counts include coloured, colourless, and snow symbols. Sources use reported mana output
            and snow type lines; they are clues, not draw odds. Select a row to highlight matching
            cards.
          </p>
          <div className="deck-review-colours">
            {colourStats.map(({ colour, pips, sourceCards, matchingCards }) => (
              <FilterButton
                key={colour}
                label={`${manaGuidanceName(colour)} mana demand and sources`}
                count={matchingCards.length}
                className="deck-review-colour-filter"
                onClick={() =>
                  selectCards(
                    `${manaGuidanceName(colour)} mana demand and sources`,
                    cardNames(matchingCards),
                  )
                }
              >
                <span className="deck-review-colour-heading">
                  <ManaSymbols symbols={[colour]} />
                  <b>{manaGuidanceName(colour)}</b>
                  <ReviewStatus
                    kind={
                      pips > 0 && sourceCards.length === 0
                        ? 'attention'
                        : pips > 0
                          ? 'good'
                          : 'neutral'
                    }
                    label={
                      pips > 0 && sourceCards.length === 0
                        ? 'No mana source'
                        : pips > 0
                          ? 'Mana sources found'
                          : 'No cost symbols'
                    }
                  />
                </span>
                <span className="deck-review-colour-counts">
                  <span>
                    <b>{pips}</b> symbols
                  </span>
                  <span>
                    <b>{sourceCards.length}</b> source cards
                  </span>
                </span>
              </FilterButton>
            ))}
          </div>
        </section>

        <section className="deck-review-section">
          <h3>Theme and mechanics</h3>
          <p>Cards matching your themes and mechanics.</p>
          {[...selectedCoverage, ...inferredCoverage].length ? (
            <div className="deck-review-tags">
              {[...selectedCoverage, ...inferredCoverage].map(({ tag, cards }) => {
                const selected = selectedTags.includes(tag)
                const kind = selected ? (cards.length ? 'good' : 'attention') : 'neutral'
                const label =
                  tag === theme
                    ? 'Selected theme'
                    : activeSubThemes.includes(tag)
                      ? 'Active sub-theme'
                      : 'Also found in deck'
                return (
                  <FilterButton
                    key={tag}
                    label={tag}
                    count={cards.length}
                    className="deck-review-tag-filter"
                    onClick={() => selectCards(tag, cardNames(cards))}
                  >
                    <span className="deck-review-tag-kind">{label}</span>
                    <span className="deck-review-tag-heading">
                      <b>{tag}</b>
                      <ReviewStatus
                        kind={kind}
                        label={
                          selected ? (cards.length ? 'Matches found' : 'No matches') : 'Detected'
                        }
                      />
                    </span>
                    <span className="deck-review-tag-count">{cards.length} matching cards</span>
                  </FilterButton>
                )
              })}
            </div>
          ) : (
            <p className="deck-review-empty">No matching themes or mechanics found.</p>
          )}
        </section>

        <section className="deck-review-section">
          <h3>Card-type distribution</h3>
          <p>
            A card may count under more than one type. Select a row to highlight matching cards.
          </p>
          <div className="deck-review-types">
            {typeStats
              .filter(({ count }) => count > 0)
              .map(({ type, count, cards }) => (
                <FilterButton
                  key={type}
                  label={`${type} type`}
                  count={cards.length}
                  className="deck-review-type-filter"
                  onClick={() => selectCards(`${type} type`, cardNames(cards))}
                >
                  <span className="deck-review-row-heading">
                    <b>{type}</b>
                    <strong>{count}</strong>
                  </span>
                  <span className="deck-review-ratio">
                    <i style={{ width: `${(count / maxTypeCount) * 100}%` }} />
                  </span>
                </FilterButton>
              ))}
          </div>
        </section>
      </div>
    </section>
  )
}
