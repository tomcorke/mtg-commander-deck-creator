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
