import { supportedThemes } from './domain/recommendation-themes.ts'

type TaggedCard = { tags: string[] }
export type DeckReviewFilter = { label: string; cardNames: string[] }

const supportedThemeSet = new Set(supportedThemes)

export function deckTagCoverage<T extends TaggedCard>(cards: T[], selectedTags: string[]) {
  const coverage = new Map<string, T[]>(selectedTags.filter(Boolean).map((tag) => [tag, []]))
  for (const card of cards)
    for (const tag of new Set(card.tags)) {
      const matchingCards = coverage.get(tag)
      if (matchingCards) matchingCards.push(card)
      else if (supportedThemeSet.has(tag)) coverage.set(tag, [card])
    }
  return [...coverage].map(([tag, matchingCards]) => ({ tag, cards: matchingCards }))
}

// Wizards' bracket barometers (mtg-knowledge-base format-policy.md). Names are Wizards'
// mass land denial examples; text checks catch printed wording only.
// ponytail: no combo data source yet; add Commander Spellbook lookups if combos need flagging.
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
