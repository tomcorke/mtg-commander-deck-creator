import { builderAction, type BuilderActionHost } from './builder-action.ts'
import { useEffect, useRef } from 'react'

import { deckDataStatus } from '../domain/deck-data-status.ts'
import type { Card } from '../domain/card-model.ts'
import { basicLandNames, shouldAutoOpenDeckReview } from '../deck-analysis.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { printingOptions } from '../domain/printing.ts'
import { shouldConfirmReviewNavigation, type AppHistoryState } from './routes.ts'

export type AppEffectsDeps = Record<string, any> & BuilderActionHost

export function useRouteEffects(deps: AppEffectsDeps) {
  const currentRoute = useRef<AppHistoryState | null>(null)
  const {
    initialRoute,
    savedCommander,
    historyReady,
    setShowBuilder,
    setActiveModal,
    readRoute,
    writeRoute,
    appHistoryKey,
    pendingReviewChanges,
    reviewNavigation,
    reviewNavigationAllowed,
    setShowReviewExitPrompt,
    showBuilder,
    activeModal,
  } = deps
  useEffect(() => {
    const route = initialRoute ?? {
      app: appHistoryKey,
      view: savedCommander ? 'builder' : 'start',
      modal: null,
      entry: false,
    }
    currentRoute.current = route
    writeRoute(route, true)
    historyReady.current = true
    const applyRoute = (next: AppHistoryState) => {
      currentRoute.current = next
      if (window.history.state?.app !== appHistoryKey) writeRoute(next, true)
      setShowBuilder(next.view === 'builder')
      setActiveModal(next.modal)
    }
    const handleRoute = (direction: 'back' | 'hash') => {
      const next = readRoute() ?? { app: appHistoryKey, view: 'start', modal: null, entry: false }
      if (reviewNavigationAllowed.current) {
        reviewNavigationAllowed.current = false
        reviewNavigation.current = null
        setShowReviewExitPrompt(false)
        applyRoute(next)
        return
      }
      if (reviewNavigation.current) {
        const current = currentRoute.current
        if (current && current.view === next.view && current.modal === next.modal)
          setShowReviewExitPrompt(true)
        return
      }
      if (shouldConfirmReviewNavigation(currentRoute.current, next, pendingReviewChanges.current)) {
        reviewNavigation.current = direction
        if (direction === 'back') window.history.go(1)
        else window.history.back()
        return
      }
      applyRoute(next)
    }
    // A typed hash fires popstate first with no app state; it has no forward entry to restore.
    const handlePopState = () =>
      handleRoute(window.history.state?.app === appHistoryKey ? 'back' : 'hash')
    const handleHashChange = () => handleRoute('hash')
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])
  useEffect(() => {
    if (!historyReady.current) return
    currentRoute.current = {
      app: appHistoryKey,
      view: showBuilder ? 'builder' : 'start',
      modal: activeModal,
      entry: false,
    }
  }, [activeModal, appHistoryKey, historyReady, showBuilder])
}

export function useCompletionReviewEffect(deps: AppEffectsDeps) {
  const { deck, commander, openModal, showBuilder, skipCompletionReviewDecks } = deps
  const previousCount = useRef(deck.length)
  useEffect(() => {
    const importedDeck = skipCompletionReviewDecks.current.has(deck)
    if (
      showBuilder &&
      deckDataStatus(deck, commander, [], [], []).deckComplete &&
      shouldAutoOpenDeckReview(previousCount.current, deck.length, importedDeck)
    )
      openModal('review')
    previousCount.current = deck.length
  }, [deck, commander, deck.length, openModal, showBuilder, skipCompletionReviewDecks])
}

export function usePersistenceEffect(deps: AppEffectsDeps) {
  const { recommendationState, currentDeckState, deckName, workspace } = deps
  const fetchBoundary = deps.builderState.fetchBoundary
  useEffect(() => {
    if (recommendationState !== 'idle' || fetchBoundary || !currentDeckState) return
    const cards = [
      ...currentDeckState.deck,
      ...currentDeckState.sideboard,
      ...currentDeckState.queue,
      ...currentDeckState.deferredCards.map(({ card }: { card: Card }) => card),
    ]
    // Do not replace the recovery snapshot with an in-flight migration.
    if (cards.some((card: Card) => card.dataStatus === 'pending')) return
    workspace.save(currentDeckState, deckName)
  }, [currentDeckState, recommendationState, deckName, workspace, fetchBoundary])
}

export function useTitleEffect(deps: AppEffectsDeps) {
  const { showBuilder, commander, deck, activeSavedDeck, savedDeckChanged, deckPageTitle } = deps
  useEffect(() => {
    document.title =
      showBuilder && commander
        ? deckPageTitle(deck.length, activeSavedDeck?.name ?? commander, savedDeckChanged)
        : 'Commander Deck Creator'
  }, [activeSavedDeck?.name, commander, deck.length, savedDeckChanged, showBuilder])
}

function printingIndex(options: any[], image: string, finish: string) {
  return options.findIndex((printing) => printing.image === image && printing.finish === finish)
}

function updatedCommanderDetails(current: any, printings: any[][]) {
  if (!current) return current
  return {
    ...current,
    printings,
    selections: printings.map((options, index) =>
      Math.max(0, printingIndex(options, current.images[index], 'nonfoil')),
    ),
  }
}

function updatedDeckPrintings(current: any[], printings: any[][], names: string[]) {
  return current.map((card) => {
    const index = names.indexOf(card.name)
    if (index < 0 || index >= printings.length) return card
    const options = printings[index]
    const matching = printingIndex(options, card.image, card.finish)
    const selectedIndex = matching >= 0 ? matching : printingIndex(options, card.image, 'nonfoil')
    const selected = options[selectedIndex]
    return selected
      ? {
          ...card,
          printings: options,
          image: selected.image,
          backImage: selected.backImage,
          set: selected.set,
          setName: selected.setName,
          collectorNumber: selected.collectorNumber,
          scryfallUri: selected.scryfallUri,
          price: selected.price,
          priceUri: selected.priceUri,
          finish: selected.finish,
          foilType: selected.foilType,
        }
      : card
  })
}

export function useCommanderPrintingEffect(deps: AppEffectsDeps) {
  const { commander, commanderDetails, deck, fetchCard, fetchPrintings, workspace } = deps
  const workspaceId = workspace?.getSnapshot().id
  useEffect(() => {
    let cancelled = false
    const names = commanderNames(commander)
    if (
      !commanderDetails ||
      commanderDetails.printings.every((printings: any[], index: number) =>
        printings.every(
          (printing) =>
            printing.finish &&
            printing.setName &&
            printing.scryfallUri &&
            (!(deck[index]?.faces?.length > 1) || printing.backImage),
        ),
      )
    )
      return
    void Promise.all(
      names.map(async (name) => {
        const card = await fetchCard(name)
        return printingOptions(await fetchPrintings(card.prints_search_uri))
      }),
    )
      .then((printings) => {
        if (cancelled || (workspace && workspace.getSnapshot().id !== workspaceId)) return
        builderAction(deps, (builder) => ({
          type: 'data',
          changes: {
            commanderDetails: updatedCommanderDetails(builder.commanderDetails, printings),
          },
        }))
        builderAction(deps, (builder) => ({
          type: 'data',
          changes: {
            deck: updatedDeckPrintings(builder.deck, printings, names),
          },
        }))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [commander, workspaceId])
}

export function useBasicCardPrefetchEffect(deps: AppEffectsDeps) {
  const { fetchCards } = deps
  useEffect(() => {
    void fetchCards([...Object.values(basicLandNames), 'Wastes'].map((name) => ({ name }))).catch(
      () => undefined,
    )
  }, [])
}

export function useSetCatalogEffect(deps: AppEffectsDeps) {
  const { fetchSets, setSetOptions } = deps
  useEffect(() => {
    void fetchSets()
      .then((sets: any[]) => setSetOptions(sets))
      .catch(() => undefined)
  }, [])
}

export function useCollectionCountEffect(deps: AppEffectsDeps) {
  const {
    activeModal,
    collectionSets,
    collectionMode,
    commanderDetails,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    today,
    setCollectionPoolSize,
    fetchCollectionCount,
  } = deps
  const colours: string[] | undefined = commanderDetails?.colours
  const identity = colours?.join('')
  useEffect(() => {
    if (activeModal !== 'recommendation-settings' || !collectionSets.length || !colours) return
    const controller = new AbortController()
    const filters = {
      excludeGameChangers,
      excludeTutors,
      excludeExtraTurns,
      excludeUnreleased,
      today,
    }
    void fetchCollectionCount(colours, collectionSets, filters, fetch, controller.signal)
      .then((count: number) => {
        if (!controller.signal.aborted) setCollectionPoolSize(count)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [
    activeModal,
    collectionSets,
    collectionMode,
    identity,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    today,
  ])
}

export function useAppEffects(deps: AppEffectsDeps) {
  useRouteEffects(deps)
  useCompletionReviewEffect(deps)
  usePersistenceEffect(deps)
  useTitleEffect(deps)
  useCommanderPrintingEffect(deps)
  useBasicCardPrefetchEffect(deps)
  useSetCatalogEffect(deps)
  useCollectionCountEffect(deps)
}
