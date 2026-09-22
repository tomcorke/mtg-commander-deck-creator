import {
  balanceThemeCoverage,
  cardText,
  freshRecommendationCycle,
  rankRecommendationCards,
  selectSubTheme,
} from '../recommendations.ts'
import { randomItems, randomThree, themeCommanders } from '../domain/commander-catalog.ts'
import type { Card } from '../domain/card-model.ts'
import { basicLandNames } from '../deck-analysis.ts'
import { fetchEdhrecCommander } from '../adapters/edhrec.ts'
import { deckPageTitle, saveDeckState } from '../deck-state.ts'
import {
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  fetchScryfallCollectionCards,
  fetchScryfallPrintings,
  fetchScryfallSets,
  searchScryfall,
} from '../adapters/scryfall.ts'
import {
  clickCardImage as clickCardImageAction,
  fanCards,
  nextBatch as nextBatchAction,
  resetFan,
} from '../features/builder/interactions.ts'
import { createActionHandlers } from './action-handlers.ts'
import { loadPrintings as loadPrintingsAction } from './printing-actions.ts'
import { start as startRecommendations } from './recommendation-actions.ts'
import { useAppEffects, usePrintingRepairEffect } from './useAppEffects.ts'
import type { ControllerState } from './useControllerState.ts'
import {
  appHistoryKey,
  readAppRoute,
  writeAppRoute,
  type AppHistoryState,
  type AppModal,
  type AppView,
} from './routes.ts'

const basicNames = [...Object.values(basicLandNames), 'Wastes']
const basicCardCache = new Map<string, any>()

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
  return { navigateView, openModal, closeModal }
}

function useRemoteActions(state: AppState, routing: RoutingActions) {
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
    basicNames,
    basicCardCache,
    setSetOptions: state.setSetOptions,
    recommendationState: state.recommendationState,
    currentDeckState: state.currentDeckState,
    saveDeckState,
    showBuilder: state.showBuilder,
    commander: state.commander,
    deck: state.deck,
    activeSavedDeck: state.activeSavedDeck,
    savedDeckChanged: state.savedDeckChanged,
    deckPageTitle,
    commanderDetails: state.commanderDetails,
    setCommanderDetails: state.setCommanderDetails,
    setDeck: state.setDeck,
    showCardSearch: state.showCardSearch,
    cardSearch: state.cardSearch,
    filterCardIdentity: state.filterCardIdentity,
    excludeUnreleased: state.excludeUnreleased,
    setCardSearchState: state.setCardSearchState,
    setCardSearchResults: state.setCardSearchResults,
    cardSearchInput: state.cardSearchInput,
    search: state.search,
    setMatches: state.setMatches,
    setCommanderCosts: state.setCommanderCosts,
    colours: state.colours,
    setSuggestionPool: state.setSuggestionPool,
    setSuggestions: state.setSuggestions,
    suggestions: state.suggestions,
    matches: state.matches,
    commanderCosts: state.commanderCosts,
    commanderImages: state.commanderImages,
    setCommanderImages: state.setCommanderImages,
    fetchCard: (name: string, signal?: AbortSignal) => fetchScryfallCard(name, fetch, signal),
    fetchPrintings: fetchScryfallPrintings,
    fetchCards: fetchScryfallCardsByIdentifiers,
    fetchSets: fetchScryfallSets,
    fetchSearch: (query: string, signal?: AbortSignal, order?: string) =>
      searchScryfall(query, fetch, signal, order),
  })
  usePrintingRepairEffect({
    queue: state.queue,
    activeSavedDeckId: state.activeSavedDeckId,
    batchNumber: state.batchNumber,
    commander: state.commander,
    repairedPrintingBatches: state.repairedPrintingBatches,
    collectionSets: state.collectionSets,
    preferredPrintSet: state.preferredPrintSet,
    loadPrintings,
  })
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
  const start = (name: string, preserveDeck = false) =>
    startRecommendations(recommendationDeps, name, preserveDeck)
  return { loadPrintings, recommendationDeps, start }
}

function useStartActions(state: AppState, routing: RoutingActions, remote: RemoteActions) {
  function chooseTheme(name: string) {
    state.setTheme(name)
    state.setColours([])
    state.setSearch('')
    state.setSuggestionPool(themeCommanders[name])
    state.setSuggestions(randomThree(themeCommanders[name]))
  }
  function toggleColour(colour: string) {
    state.setTheme('')
    state.setSearch('')
    state.setColours((selected: string[]) =>
      selected.includes(colour)
        ? selected.filter((item) => item !== colour)
        : [...selected, colour],
    )
  }
  function choosePowerTarget(target: 'precon' | 'upgraded' | 'high') {
    state.setPowerTarget(target)
    state.setRecommendationOptionsChanged(true)
    const exclude = target !== 'high'
    state.setExcludeGameChangers(exclude)
    state.setExcludeTutors(exclude)
    state.setExcludeExtraTurns(exclude)
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
    choosePowerTarget,
    retryEdhrec,
  }
}

function useBuilderActions(state: AppState, routing: RoutingActions, remote: RemoteActions) {
  const chooseSubTheme = (name: string) => {
    const selection = selectSubTheme(state.activeSubThemes, name)
    state.setActiveSubThemes(selection.activeSubThemes)
    if (selection.refreshRecommendations) state.setRecommendationOptionsChanged(true)
    state.setQueue((current: Card[]) => balanceThemeCoverage(current, selection.activeSubThemes))
    state.setShowSubThemePicker(false)
    state.setSubThemeSearch('')
  }
  const chooseRecommendationStyle = (style: 'story' | 'balanced' | 'optimized') => {
    state.setRecommendationStyle(style)
    state.setPrioritizeDeckHealth(style !== 'story')
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
    basicCardCache,
    openModal: (_deps: unknown, modal: AppModal) => routing.openModal(modal),
    closeModal: (replace = false) => routing.closeModal(replace),
    navigateView: (_deps: unknown, view: AppView, modal: AppModal | null = null, replace = false) =>
      routing.navigateView(view, modal, replace),
    start: remote.start,
  })
  const interactionDeps = { ...remote.recommendationDeps, start: remote.start }
  return {
    ...actions,
    chooseSubTheme,
    chooseRecommendationStyle,
    chooseCollectionMode,
    toggleCollectionSet,
    browseCollection,
    fanCards,
    resetFan,
    clickCardImage: (event: any, card: Card) => clickCardImageAction(event, card, actions.decide),
    nextBatch: (extraSubTheme = '') => nextBatchAction(interactionDeps, extraSubTheme),
  }
}

export function useAppActions(state: AppState) {
  const routing = useRoutingActions(state)
  const remote = useRemoteActions(state, routing)
  return {
    ...useStartActions(state, routing, remote),
    ...useBuilderActions(state, routing, remote),
  }
}
