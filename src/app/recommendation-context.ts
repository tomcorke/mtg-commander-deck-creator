import {
  analyseDeck,
  defaultDeckTargets,
  deckRoleBoosts,
  rolesForCard,
  targetKeys,
} from '../deck-analysis.ts'
import type { PersistedDeckState } from '../deck-state.ts'
import type { Card, DeckCard } from '../domain/card-model.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { manaSupportFromAnalysis, type RecommendationScoreContext } from '../recommendations.ts'

// All recommendation surfaces use the same deck, preference, and candidate-supply signals.
export function buildRecommendationContext(
  settings: Partial<PersistedDeckState> & Record<string, unknown>,
  candidates: Card[],
  deck: DeckCard[] = settings.deck ?? [],
): RecommendationScoreContext {
  const analysis = analyseDeck(deck)
  const targets = settings.deckTargets ?? defaultDeckTargets
  const roleBoosts: Record<string, number> = settings.prioritizeDeckHealth
    ? deckRoleBoosts(deck.length, analysis.counts, targets)
    : {}
  return {
    theme: settings.theme ?? '',
    activeSubThemes: settings.activeSubThemes ?? [],
    pickedTags: new Set([
      ...deck.slice(commanderNames(settings.commander ?? '').length).flatMap(({ tags }) => tags),
      ...Object.entries(settings.preferenceScores ?? {})
        .filter(([, score]) => score > 0)
        .map(([tag]) => tag),
    ]),
    preferenceScores: settings.preferenceScores ?? {},
    neededRoles: new Set(targetKeys.filter((role) => (roleBoosts[role] ?? 0) > 0)),
    cardRoles: [],
    recommendationStyle: settings.recommendationStyle,
    collectionSets: settings.collectionSets,
    collectionMode: settings.collectionMode,
    roleBoosts,
    roleSupply: Object.fromEntries(
      targetKeys.map((role) => [
        role,
        candidates.filter((card) => rolesForCard(card).includes(role)).length,
      ]),
    ),
    batchNumber: settings.batchNumber,
    manaSupport: manaSupportFromAnalysis(analysis, targets),
    maxPrice: settings.maxPrice as number | null | undefined,
  }
}
