import { restoredRecommendationDecisions, type PersistedDeckState } from '../deck-state.ts'
import { builderPoolKey } from '../domain/builder-settings.ts'
import { createBuilderState, type BuilderState } from '../domain/builder-state.ts'
import { migrateRecommendationPriority } from '../domain/recommendation-tuning.ts'

export function restoreBuilderState(
  saved: PersistedDeckState | null,
  today: string,
  id: string,
  defaults?: BuilderState,
): BuilderState {
  const initial = defaults
    ? { ...defaults, today, signatureDeckKey: id, focusedRole: null, deckDoctorHistory: [] }
    : createBuilderState(today, id)
  if (!saved) return initial
  const restored: BuilderState = {
    ...initial,
    signatureQuota: { pages: 0, cards: 0 },
    fetchBoundary: null,
    fetchSequence: 0,
    pendingFetches: [],
    completedFetches: [],
    localCandidateBuffer: saved.localCandidateBuffer ?? [],
    recommendationOptionsChanged: false,
    commander: saved.commander,
    commanderDetails: saved.commanderDetails,
    deck: saved.deck,
    sideboard: saved.sideboard,
    queue: saved.queue,
    deferredCards: saved.deferredCards,
    batchNumber: saved.batchNumber,
    decisions: restoredRecommendationDecisions(saved),
    ignoreReasons: saved.ignoreReasons ?? {},
    ignoredCards: saved.ignoredCards,
    liked: saved.liked,
    preferenceScores: saved.preferenceScores,
    deckTargets: saved.deckTargets,
    theme: saved.theme,
    activeSubThemes: saved.activeSubThemes,
    dismissedSubThemes: saved.dismissedSubThemes,
    commanderSubThemes: saved.commanderSubThemes,
    recommendationStyle: migrateRecommendationPriority(
      saved.recommendationStyle,
      saved.prioritizeDeckHealth,
    ),
    maxPrice: saved.maxPrice ?? null,
    collectionMode: saved.collectionSets.length ? saved.collectionMode : 'none',
    collectionSets: saved.collectionSets,
    collectionGroups: saved.collectionGroups,
    preferredPrintSet: saved.preferredPrintSet,
  }
  return { ...restored, committedPoolKey: builderPoolKey(restored) }
}
