import { restoredRecommendationDecisions, type PersistedDeckState } from '../deck-state.ts'
import { defaultThemeTarget } from '../deck-analysis.ts'
import {
  normalizeOpposingAnswerTargets,
  normalizeOpposingStrategies,
} from '../domain/opposing-strategies.ts'
import { builderPoolKey } from '../domain/builder-settings.ts'
import { createBuilderState, type BuilderState } from '../domain/builder-state.ts'
import { migrateRecommendationPriority } from '../domain/recommendation-tuning.ts'
import { outOfLandSlot } from '../domain/recommendation-scoring.ts'

export function restoreBuilderState(
  saved: PersistedDeckState | null,
  today: string,
  id: string,
  defaults?: BuilderState,
): BuilderState {
  const initial = defaults
    ? {
        ...defaults,
        today,
        signatureDeckKey: id,
        focusedRole: null,
        deckDoctorHistory: [],
        bulkAdd: null,
        lastDecision: null,
        // Another deck's combos; useComboLinksEffect recomputes them for this one.
        comboLinks: [],
        priceCappedFavourites: [],
      }
    : createBuilderState(today, id)
  if (!saved) return initial
  const restored: BuilderState = {
    ...initial,
    signatureQuota: { pages: 0, cards: 0 },
    fetchBoundary: null,
    fetchSequence: 0,
    pendingFetches: [],
    completedFetches: [],
    localCandidateBuffer: (saved.localCandidateBuffer ?? []).map(outOfLandSlot),
    recommendationOptionsChanged: false,
    commander: saved.commander,
    commanderDetails: saved.commanderDetails,
    deck: saved.deck,
    sideboard: saved.sideboard,
    // Saves from before #379 labelled nonland mana sources as lands; the next batch re-ranks them.
    queue: saved.queue.map(outOfLandSlot),
    deferredCards: saved.deferredCards.map((entry) => ({
      ...entry,
      card: outOfLandSlot(entry.card),
    })),
    batchNumber: saved.batchNumber,
    decisions: restoredRecommendationDecisions(saved),
    ignoreReasons: saved.ignoreReasons ?? {},
    ignoredCards: saved.ignoredCards,
    ignoredDetails: (saved.ignoredDetails ?? []).filter(({ name }) =>
      saved.ignoredCards.includes(name),
    ),
    liked: saved.liked,
    preferenceScores: saved.preferenceScores,
    deckTargets: saved.deckTargets,
    themeTarget: saved.themeTarget ?? defaultThemeTarget,
    opposingStrategies: normalizeOpposingStrategies(saved.opposingStrategies),
    opposingAnswerTargets: normalizeOpposingAnswerTargets(saved.opposingAnswerTargets),
    theme: saved.theme,
    activeSubThemes: saved.activeSubThemes,
    dismissedSubThemes: saved.dismissedSubThemes,
    commanderSubThemes: saved.commanderSubThemes,
    recommendationStyle: migrateRecommendationPriority(
      saved.recommendationStyle,
      saved.prioritizeDeckHealth,
    ),
    maxPrice: saved.maxPrice ?? null,
    deckBudget: saved.deckBudget ?? null,
    collectionMode: saved.collectionSets.length ? saved.collectionMode : 'none',
    collectionSets: saved.collectionSets,
    collectionGroups: saved.collectionGroups,
    preferredPrintSet: saved.preferredPrintSet,
  }
  return { ...restored, committedPoolKey: builderPoolKey(restored) }
}
