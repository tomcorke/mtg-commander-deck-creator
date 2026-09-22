import { useMemo } from 'react'

import { deckDelta, deckStateChanged, type PersistedDeckState } from '../deck-state.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { toDeckCardFromRecommendation } from '../domain/card-model.ts'
import { useCollectionState } from './useCollectionState.ts'
import { useCommanderState } from './useCommanderState.ts'
import { useDeckState } from './useDeckState.ts'
import { useRecommendationState } from './useRecommendationState.ts'
import { useUiState } from './useUiState.ts'
import type { AppHistoryState } from './routes.ts'

function useCurrentDeckState(state: Record<string, any>) {
  const {
    activeSavedDeckId,
    commander,
    commanderDetails,
    theme,
    recommendationStyle,
    collectionSets,
    collectionGroups,
    collectionMode,
    prioritizeDeckHealth,
    queue,
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
            commander,
            commanderDetails,
            theme,
            recommendationStyle,
            collectionSets,
            collectionGroups,
            collectionMode,
            prioritizeDeckHealth,
            queue,
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
      commander,
      commanderDetails,
      theme,
      recommendationStyle,
      collectionSets,
      collectionGroups,
      collectionMode,
      prioritizeDeckHealth,
      queue,
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

export function useControllerState(
  saved: PersistedDeckState | null,
  initialRoute: Pick<AppHistoryState, 'view' | 'modal'> | null,
) {
  const commander = useCommanderState(saved)
  const collection = useCollectionState(saved)
  const recommendation = useRecommendationState(saved)
  const deck = useDeckState(saved)
  const ui = useUiState(saved, initialRoute)
  const state = { ...commander, ...collection, ...recommendation, ...deck, ...ui }
  const currentDeckState = useCurrentDeckState(state)
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
      state.selectedDeckCardLocation
        ? ((state.selectedDeckCardLocation.board === 'deck' ? state.deck : state.sideboard)[
            state.selectedDeckCardLocation.index
          ] ?? null)
        : (state.selectedCollectionCard ??
          (state.selectedGuidanceCard
            ? toDeckCardFromRecommendation(state.selectedGuidanceCard)
            : null)),
    [
      state.deck,
      state.selectedCollectionCard,
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
    showSavedDecks: state.activeModal === 'saved',
    showImport: state.activeModal === 'import',
    showDeckCard: state.activeModal === 'card' && selectedDeckCard !== null,
    selectedDeckCardIsCommander:
      state.selectedDeckCardLocation?.board === 'deck' &&
      state.selectedDeckCardLocation.index < commanderNames(state.commander).length,
  }
}

export type ControllerState = ReturnType<typeof useControllerState>
