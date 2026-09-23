import { useEffect } from 'react'

import { commanderNames, randomThree } from '../domain/commander-catalog.ts'
import { commanderPrintingOptions } from '../domain/printing.ts'

export type AppEffectsDeps = Record<string, any>

export function useRouteEffects(deps: AppEffectsDeps) {
  const {
    initialRoute,
    savedCommander,
    historyReady,
    setShowBuilder,
    setActiveModal,
    readRoute,
    writeRoute,
    appHistoryKey,
  } = deps
  useEffect(() => {
    const route = initialRoute ?? {
      app: appHistoryKey,
      view: savedCommander ? 'builder' : 'start',
      modal: null,
      entry: false,
    }
    writeRoute(route, true)
    historyReady.current = true
    const applyRoute = () => {
      const next = readRoute() ?? { app: appHistoryKey, view: 'start', modal: null, entry: false }
      setShowBuilder(next.view === 'builder')
      setActiveModal(next.modal)
    }
    window.addEventListener('popstate', applyRoute)
    window.addEventListener('hashchange', applyRoute)
    return () => {
      window.removeEventListener('popstate', applyRoute)
      window.removeEventListener('hashchange', applyRoute)
    }
  }, [])
}

export function usePersistenceEffect(deps: AppEffectsDeps) {
  const { recommendationState, currentDeckState, saveDeckState } = deps
  useEffect(() => {
    if (recommendationState !== 'idle' || !currentDeckState) return
    saveDeckState(currentDeckState)
  }, [currentDeckState, recommendationState])
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
        }
      : card
  })
}

function uniqueCards(cards: any[]) {
  const seen = new Set<string>()
  return cards.filter((card) => {
    if (seen.has(card.name)) return false
    seen.add(card.name)
    return true
  })
}

function commanderCosts(cards: any[]) {
  return Object.fromEntries(
    cards.map((card) => [card.name, card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '']),
  )
}

export function useCommanderPrintingEffect(deps: AppEffectsDeps) {
  const {
    commander,
    commanderDetails,
    deck,
    setCommanderDetails,
    setDeck,
    fetchCard,
    fetchPrintings,
  } = deps
  useEffect(() => {
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
        return commanderPrintingOptions(await fetchPrintings(card.prints_search_uri))
      }),
    )
      .then((printings) => {
        setCommanderDetails((current: any) => updatedCommanderDetails(current, printings))
        setDeck((current: any[]) => updatedDeckPrintings(current, printings, names))
      })
      .catch(() => undefined)
  }, [commander, commanderDetails, deck])
}

export function useBasicCardCacheEffect(deps: AppEffectsDeps) {
  const { basicNames, fetchCards, basicCardCache } = deps
  useEffect(() => {
    void fetchCards(basicNames.map((name: string) => ({ name })))
      .then((cards: any[]) => cards.forEach((card) => basicCardCache.set(card.name, card)))
      .catch(() => undefined)
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

export function useCardSearchEffect(deps: AppEffectsDeps) {
  const {
    showCardSearch,
    cardSearch,
    commanderDetails,
    filterCardIdentity,
    excludeUnreleased,
    setCardSearchState,
    setCardSearchResults,
    fetchSearch,
  } = deps
  useEffect(() => {
    if (!showCardSearch || cardSearch.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setCardSearchState('loading')
      try {
        const identity = commanderDetails?.colours.join('').toLowerCase() || 'c'
        const query = `name:${cardSearch.trim()}${filterCardIdentity ? ` id<=${identity}` : ''}${excludeUnreleased ? ' date<=today' : ''}`
        const result = await fetchSearch(query, controller.signal)
        setCardSearchResults(uniqueCards(result).slice(0, 8))
        setCardSearchState('idle')
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setCardSearchState('error')
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [cardSearch, showCardSearch, filterCardIdentity, excludeUnreleased, commanderDetails?.colours])
}

export function useCardSearchFocusEffect(deps: AppEffectsDeps) {
  const { showCardSearch, cardSearchInput } = deps
  useEffect(() => {
    if (showCardSearch) cardSearchInput.current?.focus()
  }, [showCardSearch])
}

export function useCommanderSearchEffect(deps: AppEffectsDeps) {
  const { search, setMatches, setCommanderCosts, fetchSearch } = deps
  useEffect(() => {
    if (search.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const cards = await fetchSearch(`is:commander name:${search.trim()}`, controller.signal)
        setMatches([...new Set(cards.map((card: any) => card.name))].slice(0, 6))
        setCommanderCosts((current: Record<string, string>) => ({
          ...current,
          ...commanderCosts(cards),
        }))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setMatches([])
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search])
}

export function useColourSuggestionsEffect(deps: AppEffectsDeps) {
  const { colours, setSuggestionPool, setSuggestions, setCommanderCosts, fetchSearch } = deps
  useEffect(() => {
    if (!colours.length) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const identity = colours.join('').toLowerCase()
        const cards = await fetchSearch(`is:commander id=${identity}`, controller.signal, 'edhrec')
        const names = cards.map((card: any) => card.name)
        setSuggestionPool(names)
        setSuggestions(randomThree(names))
        setCommanderCosts((current: Record<string, string>) => ({
          ...current,
          ...commanderCosts(cards),
        }))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSuggestions([])
      }
    }
    void load()
    return () => controller.abort()
  }, [colours])
}

export function useCommanderImagesEffect(deps: AppEffectsDeps) {
  const {
    search,
    matches,
    suggestions,
    commanderCosts,
    commanderImages,
    setCommanderCosts,
    setCommanderImages,
    fetchCard,
  } = deps
  useEffect(() => {
    const shown = search.trim().length >= 2 ? matches : suggestions
    const missing = shown.filter(
      (name: string) => commanderCosts[name] === undefined || commanderImages[name] === undefined,
    )
    if (!missing.length) return
    const controller = new AbortController()
    const load = async () => {
      for (const name of missing) {
        const costs: string[] = []
        const images: { image: string; backImage?: string }[] = []
        for (const cardName of commanderNames(name)) {
          let card: any
          try {
            card = await fetchCard(cardName, controller.signal)
          } catch {
            continue
          }
          costs.push(card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '')
          const image = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
          if (image) images.push({ image, backImage: card.card_faces?.[1]?.image_uris?.normal })
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        setCommanderCosts((current: Record<string, string>) => ({
          ...current,
          [name]: costs.join(' '),
        }))
        setCommanderImages((current: Record<string, { image: string; backImage?: string }[]>) => ({
          ...current,
          [name]: images,
        }))
      }
    }
    void load().catch(() => undefined)
    return () => controller.abort()
  }, [suggestions, matches, search])
}

export function usePrintingRepairEffect(deps: AppEffectsDeps) {
  const {
    queue,
    activeSavedDeckId,
    batchNumber,
    commander,
    repairedPrintingBatches,
    collectionSets,
    preferredPrintSet,
    loadPrintings,
  } = deps
  useEffect(() => {
    const cards = queue.slice(0, 8)
    if (
      !cards.some(
        (card: any) =>
          !card.setName ||
          !card.scryfallUri ||
          (card.faces.length > 1 && !card.backImage) ||
          card.printings?.some(
            (printing: any) =>
              !printing.finish ||
              !printing.setName ||
              !printing.scryfallUri ||
              (card.faces.length > 1 && !printing.backImage),
          ),
      )
    )
      return
    const repairKey = `${activeSavedDeckId}:${batchNumber}:${commander}:${cards.map((card: any) => card.name).join('|')}`
    if (repairedPrintingBatches.current.has(repairKey)) return
    repairedPrintingBatches.current.add(repairKey)
    void loadPrintings(cards, collectionSets[0] || preferredPrintSet)
  }, [
    activeSavedDeckId,
    batchNumber,
    collectionSets,
    commander,
    loadPrintings,
    preferredPrintSet,
    queue,
  ])
}

export function useAppEffects(deps: AppEffectsDeps) {
  useRouteEffects(deps)
  usePersistenceEffect(deps)
  useTitleEffect(deps)
  useCommanderPrintingEffect(deps)
  useBasicCardCacheEffect(deps)
  useSetCatalogEffect(deps)
  useCardSearchEffect(deps)
  useCardSearchFocusEffect(deps)
  useCommanderSearchEffect(deps)
  useColourSuggestionsEffect(deps)
  useCommanderImagesEffect(deps)
}
