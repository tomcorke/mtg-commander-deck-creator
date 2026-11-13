import { cardFeatures, type AnalysisCard } from './deck-analysis.ts'
import { hasTag } from './domain/creature-types.ts'
import { supportedThemes } from './domain/recommendation-themes.ts'

type TaggedCard = { tags: string[]; typeLine?: string }
export type DeckReviewFilter = { label: string; cardNames: string[] }

const supportedThemeSet = new Set(supportedThemes)

/**
 * Cards per theme: selected themes first, matched as offers match them (`hasTag`, so changelings
 * count for creature-type themes, #501), then other supported tags found in the deck.
 */
export function deckTagCoverage<T extends TaggedCard>(cards: T[], selectedTags: string[]) {
  const selected = [...new Set(selectedTags.filter(Boolean))]
  const coverage = new Map<string, T[]>(
    selected.map((tag) => [tag, cards.filter((card) => hasTag(card, tag))]),
  )
  for (const card of cards)
    for (const tag of new Set(card.tags)) {
      if (selected.includes(tag) || !supportedThemeSet.has(tag)) continue
      coverage.set(tag, [...(coverage.get(tag) ?? []), card])
    }
  return [...coverage].map(([tag, matchingCards]) => ({ tag, cards: matchingCards }))
}

// Wizards' bracket barometers (mtg-knowledge-base format-policy.md). Names are Wizards'
// mass land denial examples; text checks catch printed wording only. Two-card combos come from
// Commander Spellbook data instead (src/domain/combo-index.ts).
const massLandDenialExamples = new Set([
  'Armageddon',
  'Ruination',
  'Sunder',
  'Winter Orb',
  'Blood Moon',
])
const massLandDenialText =
  /\b(?:destroy|exile|return) all [^.]*\blands\b|\beach player sacrifices (?:all|\w+) lands\b|\blands don't untap\b/i
const extraTurnText = /\btakes? \w+ extra turns?\b/i

export function deckRiskIndicators<T extends { name: string; detail: string }>(cards: T[]) {
  return [
    {
      label: 'Mass land denial',
      cards: cards.filter(
        (card) => massLandDenialExamples.has(card.name) || massLandDenialText.test(card.detail),
      ),
    },
    { label: 'Extra turns', cards: cards.filter((card) => extraTurnText.test(card.detail)) },
  ]
}

/** Cards whose printed text wins the game or makes opponents lose it: a heuristic text clue. */
export const winConditionCards = <T extends AnalysisCard>(cards: T[]) =>
  cards.filter((card) => cardFeatures(card).strategy.includes('finisher'))
