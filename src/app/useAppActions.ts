import { useEffect, useEffectEvent, useRef } from 'react'
import { type TargetKey } from '../deck-analysis.ts'

import {
  cardText,
  freshRecommendationCycle,
  rankRecommendationCards,
  selectSubTheme,
  type RecommendationStyle,
} from '../recommendations.ts'
import { randomItems } from '../domain/commander-catalog.ts'
import { playStyleSettings, type PlayStyle } from '../domain/play-style.ts'
import type { Card } from '../domain/card-model.ts'
import { fetchEdhrecCommander } from '../adapters/edhrec.ts'
import { deckPageTitle, type SavedDeck } from '../deck-state.ts'
import type { AutosavedDraft } from '../autosaves.ts'
import {
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  fetchScryfallCollectionCards,
  fetchScryfallCollectionCount,
  fetchScryfallPrintings,
  fetchScryfallSets,
  searchScryfall,
} from '../adapters/scryfall.ts'
import {
  clickCardImage as clickCardImageAction,
  chooseRoleFocus,
  clearCompletedRoleFocus,
  fanCards,
  nextBatch as nextBatchAction,
  refreshRecommendationSettings,
  resetFan,
} from '../features/builder/interactions.ts'
import { createActionHandlers } from './action-handlers.ts'
import { loadPrintings as loadPrintingsAction } from './printing-actions.ts'
import {
  fetchDeckDoctorCandidates,
  fetchDeckDoctorCommanders,
  start as startRecommendations,
  recommendationPoolKey,
  type RecommendationProgress,
} from './recommendation-actions.ts'
import { useAppEffects, usePrintingRepairEffect } from './useAppEffects.ts'
import { useSignatureRecommendations } from './useSignatureRecommendations.ts'
import type { ControllerState } from './useControllerState.ts'
import {
  appHistoryKey,
  readAppRoute,
  reviewRouteDepth,
  runOrConfirmReviewExit,
  writeAppRoute,
  type AppHistoryState,
  type AppModal,
  type AppView,
} from './routes.ts'

type AppState = ControllerState & Record<string, any>

type RoutingActions = ReturnType<typeof useRoutingActions>
type RemoteActions = ReturnType<typeof useRemoteActions>

function useRoutingActions(state: AppState) {
  function navigateView(view: AppView, modal: AppModal | null = null, replace = false) {
    const current = readAppRoute()
    const route = {
      app: appHistoryKey,
      view,
      modal,
      entry: Boolean(modal && !replace),
      reviewDepth: reviewRouteDepth(current, modal, replace),
    } satisfies AppHistoryState
    state.setShowBuilder(view === 'builder')
    state.setActiveModal(modal)
    if (!state.historyReady.current || (current?.view === view && current.modal === modal)) return
    writeAppRoute(route, replace)
  }
  const openModal = (modal: AppModal) =>
    navigateView(state.showBuilder ? 'builder' : 'start', modal)
  function closeModal(replace = false) {
    const current = readAppRoute()
    if (!replace && current?.modal && current.entry) {
      window.history.back()
      return
    }
    navigateView(current?.view ?? (state.showBuilder ? 'builder' : 'start'), null, true)
  }
  function cancelReviewNavigation() {
    state.reviewNavigation.current = null
    state.setShowReviewExitPrompt(false)
  }
  function confirmReviewNavigation() {
    const direction = state.reviewNavigation.current
    if (!direction || !state.showReviewExitPrompt) return
    state.reviewNavigation.current = null
    if (typeof direction === 'function') {
      state.pendingReviewChanges.current = false
      state.setShowReviewExitPrompt(false)
      direction()
      return
    }
    state.reviewNavigationAllowed.current = true
    state.pendingReviewChanges.current = false
    state.setShowReviewExitPrompt(false)
    if (direction === 'back') window.history.back()
    else window.history.forward()
  }
  function requestReviewExit(exit: () => void) {
    runOrConfirmReviewExit(state.pendingReviewChanges.current, exit, (pendingExit) => {
      state.reviewNavigation.current = pendingExit
      state.setShowReviewExitPrompt(true)
    })
  }
  return {
    navigateView,
    openModal,
    closeModal,
    requestReviewExit,
    cancelReviewNavigation,
    confirmReviewNavigation,
  }
}

async function startInWorkspace(
  state: AppState,
  deps: Parameters<typeof startRecommendations>[0],
  name: string,
  preserveDeck: boolean,
  progress?: RecommendationProgress,
) {
  if (!name.trim()) return false
  if (!preserveDeck) {
    if (!(await state.workspace.begin())) return false
    state.setActiveSavedDeckId('')
    state.setDeckName('')
    if (!deps.prepareFirstBatch) state.resetFirstUse()
  }
  return startRecommendations(deps, name, preserveDeck, progress)
}

function useRemoteActions(state: AppState, routing: RoutingActions) {
  useSignatureRecommendations(state)
  const loadPrintings = (
    cards: Card[],
    preferredSet = '',
    selectedCollectionSets = state.collectionSets,
    selectedCollectionMode = state.collectionMode,
  ) =>
    loadPrintingsAction(
      { ...state, ...routing, fetchPrintings: fetchScryfallPrintings },
      cards,
      preferredSet,
      selectedCollectionSets,
      selectedCollectionMode,
    )
  useAppEffects({
    initialRoute: state.initialRoute,
    savedCommander: state.savedCommander,
    historyReady: state.historyReady,
    setShowBuilder: state.setShowBuilder,
    setActiveModal: state.setActiveModal,
    readRoute: readAppRoute,
    writeRoute: writeAppRoute,
    appHistoryKey,
    pendingReviewChanges: state.pendingReviewChanges,
    reviewNavigation: state.reviewNavigation,
    reviewNavigationAllowed: state.reviewNavigationAllowed,
    setShowReviewExitPrompt: state.setShowReviewExitPrompt,
    setSetOptions: state.setSetOptions,
    recommendationState: state.recommendationState,
    currentDeckState: state.currentDeckState,
    workspace: state.workspace,
    deckName: state.deckName,
    showBuilder: state.showBuilder,
    openModal: routing.openModal,
    commander: state.commander,
    deck: state.deck,
    skipCompletionReviewDecks: state.skipCompletionReviewDecks,
    activeSavedDeck: state.activeSavedDeck,
    savedDeckChanged: state.savedDeckChanged,
    deckPageTitle,
    commanderDetails: state.commanderDetails,
    setCommanderDetails: state.setCommanderDetails,
    setDeck: state.setDeck,
    fetchCard: (name: string, signal?: AbortSignal) => fetchScryfallCard(name, fetch, signal),
    fetchPrintings: fetchScryfallPrintings,
    fetchCards: fetchScryfallCardsByIdentifiers,
    fetchSets: fetchScryfallSets,
    activeModal: state.activeModal,
    collectionSets: state.collectionSets,
    collectionMode: state.collectionMode,
    excludeGameChangers: state.excludeGameChangers,
    excludeTutors: state.excludeTutors,
    excludeExtraTurns: state.excludeExtraTurns,
    excludeUnreleased: state.excludeUnreleased,
    setCollectionPoolSize: state.setCollectionPoolSize,
    fetchCollectionCount: fetchScryfallCollectionCount,
    fetchSearch: (query: string, signal?: AbortSignal, order?: string) =>
      searchScryfall(query, fetch, signal, order),
  })
  usePrintingRepairEffect({ ...state, workspaceId: state.autosave.id, loadPrintings })
  const recommendationDeps = {
    ...state,
    ...routing,
    activeModal: state.activeModal,
    freshRecommendationCycle,
    searchCards: (query: string, signal?: AbortSignal, order?: string) =>
      searchScryfall(query, fetch, signal, order),
    fetchCollection: fetchScryfallCollectionCards,
    fetchEdhrec: fetchEdhrecCommander,
    fetchCard: fetchScryfallCard,
    fetchPrintings: fetchScryfallPrintings,
    fetchCards: fetchScryfallCardsByIdentifiers,
    cardText,
    loadPrintings,
    rankRecommendationCards,
  }
  const start = (name: string, preserveDeck = false, progress?: RecommendationProgress) =>
    startInWorkspace(state, recommendationDeps, name, preserveDeck, progress)
  return {
    loadPrintings,
    recommendationDeps,
    start,
    prepareCommander: (name: string) =>
      startInWorkspace(state, { ...recommendationDeps, prepareFirstBatch: true }, name, false),
    firstBatch: (settings: ReturnType<typeof playStyleSettings>) =>
      startRecommendations({ ...recommendationDeps, ...settings }, state.commander, true),
  }
}

function useStartActions(state: AppState, routing: RoutingActions, remote: RemoteActions) {
  function chooseTheme(name: string) {
    state.setTheme(state.theme === name ? '' : name)
  }
  function toggleColour(colour: string) {
    state.setColours((selected: string[]) =>
      selected.includes(colour)
        ? selected.filter((item) => item !== colour)
        : [...selected, colour],
    )
  }
  async function chooseCommander(name: string) {
    if (state.recommendationState === 'loading' || !name.trim()) return false
    state.resetFirstUse()
    state.setAwaitingPlayStyle(true)
    const prepared = await remote.prepareCommander(name)
    state.setFirstBatchPending(prepared)
    return prepared
  }
  async function beginFirstBatch(style?: PlayStyle) {
    const current = {
      powerTarget: state.powerTarget,
      recommendationStyle: state.recommendationStyle,
      excludeGameChangers: state.excludeGameChangers,
      excludeTutors: state.excludeTutors,
      excludeExtraTurns: state.excludeExtraTurns,
    }
    const settings = style ? playStyleSettings(current, style) : current
    if (style) {
      state.setPowerTarget(settings.powerTarget)
      state.setRecommendationStyle(settings.recommendationStyle)
      state.setExcludeGameChangers(settings.excludeGameChangers)
      state.setExcludeTutors(settings.excludeTutors)
      state.setExcludeExtraTurns(settings.excludeExtraTurns)
    }
    state.setAwaitingPlayStyle(false)
    state.setNewDeckGuidePending(true)
    state.setFirstBatchFocusPending(true)
    return remote.firstBatch(settings)
  }
  function choosePowerTarget(target: 'precon' | 'upgraded' | 'high') {
    state.setPowerTarget(target)
    state.setRecommendationOptionsChanged(true)
  }
  async function retryEdhrec() {
    if (
      state.edhrecRetryInFlight.current ||
      state.edhrecRetryRemaining > 0 ||
      state.recommendationState !== 'idle'
    )
      return
    state.edhrecRetryInFlight.current = true
    state.setEdhrecRetryAttempt((attempt: number) => attempt + 1)
    state.setEdhrecRetryRemaining(Math.min(60, 5 * 2 ** state.edhrecRetryAttempt))
    try {
      await remote.start(state.commander, true)
    } finally {
      state.edhrecRetryInFlight.current = false
    }
  }
  return {
    ...routing,
    ...remote,
    chooseTheme,
    toggleColour,
    chooseCommander,
    beginFirstBatch,
    choosePowerTarget,
    retryEdhrec,
  }
}

function useRecommendationInteractions(state: AppState, remote: RemoteActions) {
  const recommendationRefreshInFlight = useRef(false)
  const pendingPriceCapAnnouncement = useRef<string | null>(null)
  const interactionDeps = {
    ...remote.recommendationDeps,
    start: remote.start,
    recommendationRefreshInFlight,
  }
  const applySettings = useEffectEvent(async () => {
    try {
      await refreshRecommendationSettings(interactionDeps)
    } finally {
      if (pendingPriceCapAnnouncement.current) {
        state.setBatchAnnouncement(pendingPriceCapAnnouncement.current)
        pendingPriceCapAnnouncement.current = null
      }
    }
  })
  useEffect(() => {
    if (
      state.showBuilder &&
      !state.awaitingPlayStyle &&
      state.activeModal !== 'recommendation-settings' &&
      state.recommendationOptionsChanged &&
      state.recommendationState === 'idle'
    )
      void applySettings()
  }, [
    state.activeModal,
    state.awaitingPlayStyle,
    state.recommendationOptionsChanged,
    state.recommendationState,
    state.showBuilder,
  ])
  const clearCompletedFocus = useEffectEvent(() => {
    void clearCompletedRoleFocus(interactionDeps)
  })
  useEffect(() => {
    clearCompletedFocus()
  }, [
    state.deck,
    state.deckTargets,
    state.focusedRole,
    state.recommendationOptionsChanged,
    state.recommendationState,
  ])
  return {
    ...interactionDeps,
    announcePriceCap: (price: number | null) => {
      pendingPriceCapAnnouncement.current =
        price === null ? 'Price cap cleared.' : `Price cap set to $${price}.`
    },
  }
}

function useBuilderActions(state: AppState, routing: RoutingActions, remote: RemoteActions) {
  const chooseSubTheme = (name: string) => {
    const selection = selectSubTheme(state.activeSubThemes, name)
    state.setActiveSubThemes(selection.activeSubThemes)
    if (selection.refreshRecommendations) state.setRecommendationOptionsChanged(true)
    state.setShowSubThemePicker(false)
    state.setSubThemeSearch('')
  }
  const chooseRecommendationStyle = (style: RecommendationStyle) => {
    state.setRecommendationStyle(style)
    state.setRecommendationOptionsChanged(true)
  }
  const chooseCollectionMode = (mode: 'none' | 'prefer' | 'only') => {
    state.setCollectionMode(mode)
    if (mode === 'none') {
      state.setCollectionSets([])
      state.setCollectionGroups([])
    }
    state.setCollectionPoolSize(null)
    state.setRecommendationOptionsChanged(true)
  }
  function toggleCollectionSet(code: string) {
    const removingLastSet = state.collectionSets.length === 1 && state.collectionSets.includes(code)
    state.setCollectionSets((current: string[]) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    )
    state.setCollectionGroups([])
    if (removingLastSet) state.setCollectionMode('none')
    else if (state.collectionMode === 'none') state.setCollectionMode('prefer')
    state.setCollectionPoolSize(null)
    state.setRecommendationOptionsChanged(true)
  }
  async function browseCollection() {
    if (!state.collectionSets.length) return
    state.setShowCollectionBrowser(true)
    state.setCollectionBrowserState('loading')
    state.setCollectionBrowserError('')
    try {
      const cards = await fetchScryfallCollectionCards(
        state.commanderDetails?.colours ?? [],
        state.collectionSets,
        {
          excludeGameChangers: state.excludeGameChangers,
          excludeTutors: state.excludeTutors,
          excludeExtraTurns: state.excludeExtraTurns,
          excludeUnreleased: state.excludeUnreleased,
        },
      )
      state.setCollectionBrowserCards(randomItems(cards, cards.length))
      state.setCollectionPoolSize(cards.length)
      state.setCollectionBrowserState('idle')
    } catch (error) {
      state.setCollectionBrowserState('error')
      state.setCollectionBrowserError(
        error instanceof Error ? error.message : 'Collection unavailable',
      )
    }
  }
  const actions = createActionHandlers({
    ...state,
    openModal: (_deps: unknown, modal: AppModal) => routing.openModal(modal),
    closeModal: (replace = false) => routing.closeModal(replace),
    navigateView: (_deps: unknown, view: AppView, modal: AppModal | null = null, replace = false) =>
      routing.navigateView(view, modal, replace),
    start: remote.start,
    beginWorkspace: () => state.workspace.begin(),
  })
  const loadWorkspaceDeck = async (saved: SavedDeck | AutosavedDraft) => {
    const draft = 'version' in saved ? saved : undefined
    if (!(await state.workspace.begin(draft))) return
    state.resetFirstUse()
    actions.loadSavedDeck(
      draft ? { ...draft, id: '', state: { ...draft.state, savedDeckId: '' } } : saved,
    )
  }
  const interactionDeps = useRecommendationInteractions(state, remote)
  return {
    ...actions,
    loadAutosave: loadWorkspaceDeck,
    loadSavedDeck: loadWorkspaceDeck,
    chooseSubTheme,
    chooseRecommendationStyle,
    chooseMaxPrice: (price: number | null) => {
      interactionDeps.announcePriceCap(price)
      state.setMaxPrice(price)
      state.setRecommendationOptionsChanged(true)
    },
    chooseRoleFocus: (role: TargetKey | null) => chooseRoleFocus(interactionDeps, role),
    chooseCollectionMode,
    toggleCollectionSet,
    browseCollection,
    fanCards,
    resetFan,
    clickCardImage: (event: any, card: Card) => clickCardImageAction(event, card, actions.decide),
    nextBatch: (extraSubTheme = '') => nextBatchAction(interactionDeps, extraSubTheme),
    fetchDeckDoctorCandidates: () => fetchDeckDoctorCandidates(interactionDeps),
    fetchDeckDoctorCommanders: () => fetchDeckDoctorCommanders(interactionDeps),
  }
}

export function useAppActions(state: AppState) {
  const routing = useRoutingActions(state)
  const poolKey = useRef(recommendationPoolKey(state))
  const remote = useRemoteActions({ ...state, recommendationPoolKey: poolKey }, routing)
  const resumeFirstBatch = useEffectEvent(() => remote.start(state.commander, true))
  useEffect(() => {
    // A14 restores a prepared draft without showing a new-deck play-style step again.
    if (
      state.showBuilder &&
      state.firstBatchPending &&
      !state.awaitingPlayStyle &&
      state.recommendationState === 'idle'
    )
      void resumeFirstBatch()
  }, [
    state.showBuilder,
    state.firstBatchPending,
    state.awaitingPlayStyle,
    state.recommendationState,
  ])
  useEffect(() => {
    if (
      !state.showBuilder ||
      state.activeModal ||
      state.recommendationState !== 'idle' ||
      !state.queue.length
    )
      return
    if (state.firstBatchFocusPending) {
      document.getElementById('recommendation-batch-title')?.focus()
      state.setFirstBatchFocusPending(false)
    }
    if (state.newDeckGuidePending) {
      state.setNewDeckGuidePending(false)
      if (state.introGuideRequested) {
        state.setIntroGuideRequested(false)
        state.setShowIntroGuide(true)
      }
    }
  }, [
    state.showBuilder,
    state.activeModal,
    state.recommendationState,
    state.queue.length,
    state.firstBatchFocusPending,
    state.newDeckGuidePending,
    state.introGuideRequested,
    state.setFirstBatchFocusPending,
    state.setNewDeckGuidePending,
    state.setIntroGuideRequested,
    state.setShowIntroGuide,
  ])
  return {
    ...useStartActions(state, routing, remote),
    ...useBuilderActions(state, routing, remote),
  }
}
