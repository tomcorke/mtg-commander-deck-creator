import { gameChangersAtLimit } from '../domain/play-style.ts'
import { useMemo } from 'react'

import { deckDelta, deckStateChanged, type PersistedDeckState } from '../deck-state.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { toDeckCardFromRecommendation, type Card } from '../domain/card-model.ts'
import { useCollectionState } from './useCollectionState.ts'
import { useCommanderState } from './useCommanderState.ts'
import { useDeckState } from './useDeckState.ts'
import { useRecommendationState } from './useRecommendationState.ts'
import { useUiState } from './useUiState.ts'
import type { AppHistoryState } from './routes.ts'
import type { DeckWorkspace } from '../autosaves.ts'
import { useWorkspaceState } from './useWorkspaceState.ts'
import { useBuilderState } from './useBuilderState.ts'
import { useOwnedCardsState } from './useOwnedCardsState.ts'

function useCurrentDeckState(state: Record<string, any>) {
  const {
    activeSavedDeckId,
    firstBatchPending,
    commander,
    commanderDetails,
    theme,
    recommendationStyle,
    collectionSets,
    collectionGroups,
    collectionMode,
    prioritizeDeckHealth,
    maxPrice,
    deckBudget,
    ignoreReasons,
    queue,
    localCandidateBuffer,
    limitedRecommendations,
    decisions,
    ignoredCards,
    liked,
    activeSubThemes,
    dismissedSubThemes,
    preferenceScores,
    commanderSubThemes,
    deferredCards,
    batchNumber,
    deck,
    sideboard,
    preferredPrintSet,
    deckTargets,
  } = state
  return useMemo<PersistedDeckState | null>(
    () =>
      commander && commanderDetails && deck.length
        ? {
            savedDeckId: activeSavedDeckId,
            firstBatchPending: firstBatchPending || undefined,
            commander,
            commanderDetails,
            theme,
            recommendationStyle,
            collectionSets,
            collectionGroups,
            collectionMode,
            prioritizeDeckHealth,
            maxPrice,
            deckBudget,
            ignoreReasons,
            queue,
            localCandidateBuffer,
            limitedRecommendations,
            decisions,
            ignoredCards,
            liked,
            activeSubThemes,
            dismissedSubThemes,
            preferenceScores,
            commanderSubThemes,
            deferredCards,
            batchNumber,
            deck,
            sideboard,
            preferredPrintSet,
            deckTargets,
          }
        : null,
    [
      activeSavedDeckId,
      firstBatchPending,
      commander,
      commanderDetails,
      theme,
      recommendationStyle,
      collectionSets,
      collectionGroups,
      collectionMode,
      prioritizeDeckHealth,
      maxPrice,
      deckBudget,
      ignoreReasons,
      queue,
      localCandidateBuffer,
      limitedRecommendations,
      decisions,
      ignoredCards,
      liked,
      activeSubThemes,
      dismissedSubThemes,
      preferenceScores,
      commanderSubThemes,
      deferredCards,
      batchNumber,
      deck,
      sideboard,
      preferredPrintSet,
      deckTargets,
    ],
  )
}

// Ignored cards' data rides with the deck so Later & ignored survives a reload (#493).
function useIgnoredDetails(deckState: PersistedDeckState | null, ignoredDetails: Card[]) {
  return useMemo(
    () => (deckState && ignoredDetails.length ? { ...deckState, ignoredDetails } : deckState),
    [deckState, ignoredDetails],
  )
}

// The theme cards target rides with the deck (#501).
function useThemeTarget(deckState: PersistedDeckState | null, themeTarget: number) {
  return useMemo(
    () => (deckState ? { ...deckState, themeTarget } : deckState),
    [deckState, themeTarget],
  )
}

// Expected opponents (#503) and their edited answer targets (#565) ride with the deck.
function useOpposingStrategies(
  deckState: PersistedDeckState | null,
  opposingStrategies: string[],
  opposingAnswerTargets: Record<string, number>,
) {
  return useMemo(
    () => (deckState ? { ...deckState, opposingStrategies, opposingAnswerTargets } : deckState),
    [deckState, opposingStrategies, opposingAnswerTargets],
  )
}

// A reload on the play-style step returns to it (#490).
function usePlayStylePending(deckState: PersistedDeckState | null, pending: boolean) {
  return useMemo(
    () => (deckState && pending ? { ...deckState, playStylePending: true } : deckState),
    [deckState, pending],
  )
}

export function useControllerState(
  saved: PersistedDeckState | null,
  initialRoute: Pick<AppHistoryState, 'view' | 'modal'> | null,
  workspace: DeckWorkspace,
) {
  const commander = useCommanderState()
  const collection = useCollectionState()
  const recommendation = useRecommendationState(saved?.limitedRecommendations ?? false)
  const builder = useBuilderState(saved)
  const owned = useOwnedCardsState()
  const deck = useDeckState()
  const ui = useUiState(saved, initialRoute, workspace.initialName)
  const workspaceState = useWorkspaceState(workspace, ui.setSavedDecks)
  const state = {
    ...commander,
    ...collection,
    ...owned,
    ...recommendation,
    ...deck,
    ...ui,
    ...workspaceState,
    ...builder,
    // Once the main deck holds the limit, further Game Changers are excluded like the full filter.
    excludeGameChangers:
      builder.excludeGameChangers ||
      (builder.limitGameChangers && gameChangersAtLimit(builder.deck)),
    excludeGameChangersSetting: builder.excludeGameChangers,
  }
  const currentDeckState = usePlayStylePending(
    useOpposingStrategies(
      useThemeTarget(
        useIgnoredDetails(useCurrentDeckState(state), state.ignoredDetails),
        state.themeTarget,
      ),
      state.opposingStrategies,
      state.opposingAnswerTargets,
    ),
    state.awaitingPlayStyle,
  )
  const activeSavedDeck = state.savedDecks.find(({ id }: any) => id === state.activeSavedDeckId)
  const savedDeckChanged = Boolean(
    activeSavedDeck &&
    currentDeckState &&
    deckStateChanged(activeSavedDeck.state, currentDeckState),
  )
  const activeDeckDelta = activeSavedDeck
    ? deckDelta(
        [...activeSavedDeck.state.deck, ...activeSavedDeck.state.sideboard],
        [...state.deck, ...state.sideboard],
      )
    : null
  const selectedDeckCard = useMemo(
    () =>
      state.selectedCardReference ??
      (state.selectedDeckCardLocation
        ? ((state.selectedDeckCardLocation.board === 'deck' ? state.deck : state.sideboard)[
            state.selectedDeckCardLocation.index
          ] ?? null)
        : (state.selectedCollectionCard ??
          (state.selectedGuidanceCard
            ? toDeckCardFromRecommendation(state.selectedGuidanceCard)
            : null))),
    [
      state.deck,
      state.selectedCollectionCard,
      state.selectedCardReference,
      state.selectedDeckCardLocation,
      state.selectedGuidanceCard,
      state.sideboard,
    ],
  )
  return {
    ...state,
    initialRoute,
    savedCommander: saved?.commander,
    activeSavedDeck,
    activeDeckDelta,
    currentDeckState,
    savedDeckChanged,
    selectedDeckCard,
    showExport: state.activeModal === 'export',
    showBasicLands: state.activeModal === 'basics',
    showCardSearch: state.activeModal === 'search',
    showRecommendationSettings: state.activeModal === 'recommendation-settings',
    showOwnedCards: state.activeModal === 'owned-cards',
    showSavedDecks: state.activeModal === 'saved',
    showImport: state.activeModal === 'import',
    showDeckCard:
      state.activeModal === 'card' &&
      (selectedDeckCard !== null || state.selectedManualCard !== null),
    showDeckDoctor:
      state.activeModal === 'review' ||
      state.activeModal === 'review-changes' ||
      state.activeModal === 'review-confirm' ||
      state.activeModal === 'doctor',
    showDeckDoctorHistory: state.activeModal === 'doctor-history',
    selectedDeckCardIsCommander:
      state.selectedDeckCardLocation?.board === 'deck' &&
      state.selectedDeckCardLocation.index < commanderNames(state.commander).length,
  }
}

export type ControllerState = ReturnType<typeof useControllerState>
