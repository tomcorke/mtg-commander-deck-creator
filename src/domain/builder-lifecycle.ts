import { defaultDeckTargets } from '../deck-analysis.ts'
import { builderPoolKey } from './builder-settings.ts'
import type { BuilderAction, BuilderState } from './builder-state.ts'

export function resetBuilder(
  state: BuilderState,
  identity: { today: string; signatureDeckKey: string },
): BuilderState {
  const reset: BuilderState = {
    ...state,
    today: identity.today,
    signatureDeckKey: identity.signatureDeckKey,
    commander: '',
    commanderDetails: null,
    theme: '',
    collectionSets: [],
    collectionGroups: [],
    collectionMode: 'none',
    deck: [],
    sideboard: [],
    queue: [],
    deckDoctorHistory: [],
    decisions: {},
    ignoreReasons: {},
    focusedRole: null,
    ignoredCards: [],
    liked: [],
    activeSubThemes: [],
    dismissedSubThemes: [],
    preferenceScores: {},
    commanderSubThemes: [],
    deferredCards: [],
    batchNumber: 1,
    preferredPrintSet: '',
    deckTargets: { ...defaultDeckTargets },
    signatureQuota: { pages: 0, cards: 0 },
    fetchBoundary: null,
    fetchSequence: 0,
    pendingFetches: [],
    completedFetches: [],
    recommendationOptionsChanged: false,
  }
  return { ...reset, committedPoolKey: builderPoolKey(reset) }
}

export function beginBuilderRecommendations(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'beginRecommendations' }>,
): BuilderState {
  const base = action.preserveDeck
    ? state
    : {
        ...resetBuilder(state, action),
        theme: state.theme,
        deckTargets: state.deckTargets,
        // Extra creature types picked on the start screen carry over as sub-themes.
        activeSubThemes: action.extraCreatureTypes.slice(0, 2),
        recommendationOptionsChanged: state.recommendationOptionsChanged,
      }
  return {
    ...base,
    commander: action.commander,
    commanderDetails: null,
    queue: [],
    commanderSubThemes: [],
    deferredCards: action.progress?.deferredCards ?? [],
    batchNumber: action.progress?.batchNumber ?? 1,
    preferenceScores: action.progress?.preferenceScores ?? base.preferenceScores,
    decisions: {},
    ignoreReasons: {},
    liked: action.progress ? base.liked : [],
  }
}
