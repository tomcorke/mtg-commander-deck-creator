import { builderAction } from './builder-action.ts'
import { restoreBuilderState } from './builder-restore.ts'
import { withBuilderPrinting } from '../domain/builder-data.ts'
import {
  fetchScryfallCard,
  resolveScryfallIdentifiers,
  fetchScryfallPrintings,
  ScryfallRateLimitError,
} from '../adapters/scryfall.ts'
import { type AddZone } from '../deck-analysis.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { defaultFinish, finishPrice, foilTypeFor, printingOptions } from '../domain/printing.ts'
import type {
  Card,
  DeckCard,
  DeckCardLocation,
  ExportFormat,
  ScryfallCard,
} from '../domain/card-model.ts'
import {
  scryfallBackImage,
  scryfallImage,
  toDeckCard,
  toDeckCardFromRecommendation,
} from '../domain/card-model.ts'
import { hasBackFace } from '../domain/card-layout.ts'
import {
  applyCurrentCardData,
  pendingDeckData,
  refreshCardData,
} from '../domain/current-card-data.ts'
import { deckJob } from './deck-job.ts'
import { applyBuilderAction, orderedPrintings } from '../recommendations.ts'
import {
  deleteSavedDeck,
  saveSavedDeck,
  suggestedDeckName,
  persistedDeckStateSchema,
  type PersistedDeckState,
  type SavedDeck,
} from '../deck-state.ts'
import {
  ImportMissingCardsError,
  matchImportedCard,
  missingCardNames,
  parseDeckImportSource,
  shouldOpenReviewAfterImport,
  type ImportedCard,
  type ImportedDeck,
} from '../deck-import.ts'
import { commanderPromotionInfo } from '../domain/commander-promotion.ts'
import { start as startRecommendations, type AppActionContext } from './recommendation-actions.ts'
import { bindSignatureBudget, resetSignatureContext } from './signature-actions.ts'
import {
  cardConstructionError,
  commanderConstructionError,
} from '../domain/commander-construction.ts'

function preloadArt(sources: (string | undefined)[]) {
  return Promise.all(
    sources.filter(Boolean).map(
      (source: any) =>
        new Promise<void>((resolve: any) => {
          const image = new Image()
          image.onload = image.onerror = () => resolve()
          image.src = source!
        }),
    ),
  )
}

const cardCanHavePowerToughness = (card: Pick<DeckCard, 'typeLine'>) =>
  /Creature|Vehicle/.test(card.typeLine)

export function retryCurrentCardData(deps: AppActionContext) {
  builderAction(deps, { type: 'retryData' })
}

export function addRecommendationCard(deps: AppActionContext, card: Card) {
  const result = builderAction(deps, {
    type: 'addGuidance',
    card,
  })
  deps.setBatchAnnouncement(result.error ?? `${card.name} added from deck-health guidance.`)
}

export function addCollectionCard(deps: AppActionContext, card: ScryfallCard) {
  const result = builderAction(deps, {
    type: 'addCollection',
    card,
  })
  deps.setBatchAnnouncement(result.error ?? `${card.name} added from collection browsing.`)
}

export function decide(deps: AppActionContext, card: Card, action: 'add' | 'later' | 'ignore') {
  const result = builderAction(deps, {
    type: 'decide',
    card,
    decision: action,
  })
  if (result.error) deps.setBatchAnnouncement(result.error)
}
// The outgoing commander stays as a deck card unless `keepOutgoing` is false.
export async function promoteToCommander(
  deps: AppActionContext,
  candidate: Card | DeckCard,
  keepOutgoing = true,
) {
  const job = deckJob(deps)
  deps = job.deps
  const { commander, commanderDetails, deck, setBatchAnnouncement, start } = deps
  const outgoing = commanderNames(commander)
  if (outgoing.includes(candidate.name)) return
  const withoutOutgoing = (cards: DeckCard[]) =>
    keepOutgoing ? cards : cards.filter((card) => !outgoing.includes(card.name))
  const promotion = commanderPromotionInfo(
    candidate,
    withoutOutgoing(deck),
    keepOutgoing ? (commanderDetails?.colours ?? []) : [],
  )
  if (!promotion?.canPromote) return
  const error = commanderConstructionError([candidate])
  if (error) {
    setBatchAnnouncement(error)
    return
  }
  const loaded = await start(candidate.name, true)
  if (!loaded || !job.isCurrent()) return
  const current = deps.getCurrentState?.() ?? deps
  const existing = [...current.deck, ...current.sideboard].find(
    (card: DeckCard) => card.name === candidate.name,
  )
  const promoted = existing ?? toDeckCardFromRecommendation(candidate as Card)
  const result = builderAction(deps, {
    type: 'promote',
    candidate: promoted,
    outgoingNames: outgoing,
    keepOutgoing,
    details: deps.getBuilderState().commanderDetails,
  })
  if (result.error) {
    setBatchAnnouncement(result.error)
    return
  }
  setBatchAnnouncement(`${candidate.name} is now your commander.`)
}

export async function changeArt(
  deps: AppActionContext,
  name: string,
  sources: (string | undefined)[],
  apply: () => void,
) {
  const job = deckJob(deps)
  const { setLoadingArt } = job.deps
  const { deck, sideboard, queue, selectedManualCard } = deps
  setLoadingArt(`pending:${name}`)
  const loadingTimer = setTimeout(() => setLoadingArt(name), 50)
  await preloadArt(sources)
  clearTimeout(loadingTimer)
  const current = deps.getCurrentState?.() ?? deps
  if (
    job.isCurrent() &&
    current.deck === deck &&
    current.sideboard === sideboard &&
    current.queue === queue &&
    current.selectedManualCard === selectedManualCard
  )
    apply()
  setLoadingArt('')
}

export async function cycleCommanderPrinting(deps: AppActionContext, index: number) {
  const details = deps.commanderDetails
  const printings = details?.printings[index]
  if (!printings || printings.length < 2 || deps.loadingArt) return
  const selection = (details.selections[index] + 1) % printings.length
  const selected = printings[selection]
  const name = commanderNames(deps.commander)[index]
  await changeArt(deps, name, [selected.image, selected.art], () => {
    builderAction(deps, {
      type: 'printing',
      board: 'deck',
      index,
      name,
      printings,
      selection,
      automatic: false,
    })
  })
}

export async function cyclePrinting(deps: AppActionContext, card: Card) {
  const printings = card.printings
  if (!printings || printings.length < 2 || deps.loadingArt) return
  const selection = ((card.printing ?? 0) + 1) % printings.length
  await changeArt(deps, card.name, [printings[selection].image], () => {
    builderAction(deps, {
      type: 'printing',
      board: 'queue',
      index: deps.queue.findIndex((item: Card) => item.name === card.name),
      name: card.name,
      printings,
      selection,
      automatic: false,
    })
    deps.setSelectedGuidanceCard((current: Card | null) =>
      current?.name === card.name
        ? withBuilderPrinting(current, printings, selection, true)
        : current,
    )
  })
}

export async function cycleDeckPrinting(deps: AppActionContext, index: number) {
  if (index < commanderNames(deps.commander).length) return cycleCommanderPrinting(deps, index)
  const card: DeckCard | undefined = deps.deck[index]
  const printings = card?.printings
  if (!card || !printings || printings.length < 2 || deps.loadingArt) return
  const selection = ((card.printing ?? 0) + 1) % printings.length
  await changeArt(deps, card.name, [printings[selection].image], () => {
    builderAction(deps, {
      type: 'printing',
      board: 'deck',
      index,
      name: card.name,
      printings,
      selection,
      automatic: false,
    })
  })
}

export async function cycleSideboardPrinting(deps: AppActionContext, index: number) {
  const card: DeckCard | undefined = deps.sideboard[index]
  const printings = card?.printings
  if (!card || !printings || printings.length < 2 || deps.loadingArt) return
  const selection = ((card.printing ?? 0) + 1) % printings.length
  await changeArt(deps, card.name, [printings[selection].image], () => {
    builderAction(deps, {
      type: 'printing',
      board: 'sideboard',
      index,
      name: card.name,
      printings,
      selection,
      automatic: false,
    })
  })
}

export async function cycleSelectedDeckCardPrinting(deps: AppActionContext) {
  const { selectedDeckCardLocation, selectedGuidanceCard } = deps
  if (selectedGuidanceCard) {
    await cyclePrinting(deps, selectedGuidanceCard)
    return
  }
  if (!selectedDeckCardLocation) return
  if (selectedDeckCardLocation.board === 'deck')
    await cycleDeckPrinting(deps, selectedDeckCardLocation.index)
  else await cycleSideboardPrinting(deps, selectedDeckCardLocation.index)
}

export function deckList(deps: AppActionContext, format: ExportFormat) {
  const { commander, deck, sideboard } = deps
  const commanderCount = commanderNames(commander).length
  const section = (cards: DeckCard[], board: string) => {
    const grouped = new Map<string, { card: DeckCard; quantity: number }>()
    for (const card of cards) {
      const key = JSON.stringify([card.name, card.set, card.collectorNumber, card.finish])
      const existing = grouped.get(key)
      if (existing) existing.quantity++
      else grouped.set(key, { card, quantity: 1 })
    }
    return [...grouped.values()]
      .map(({ card, quantity }) => {
        const finish = card.finish === 'foil' ? ' *F*' : card.finish === 'etched' ? ' *E*' : ''
        return format === 'plain'
          ? `${quantity} ${card.name}${finish}`
          : format === 'csv'
            ? `${quantity},"${card.name.replaceAll('"', '""')}",${card.set.toUpperCase()},${card.collectorNumber},${card.finish ?? ''},${board}`
            : `${quantity} ${card.name} (${card.set.toUpperCase()}) ${card.collectorNumber}${finish}`
      })
      .join('\n')
  }
  const commanders = section(deck.slice(0, commanderCount), 'Commander')
  const mainboard = section(deck.slice(commanderCount), 'Mainboard')
  const side = section(sideboard, 'Sideboard')
  if (format === 'csv')
    return ['Quantity,Name,Set,Collector Number,Foil,Board', commanders, mainboard, side]
      .filter(Boolean)
      .join('\n')
  const main = format === 'plain' ? `COMMANDER:\n${commanders}\n\nDECK:\n${mainboard}` : mainboard
  return `${main}${side ? `\n\nSIDEBOARD:\n${side}` : ''}`
}

export async function copyDeck(deps: AppActionContext) {
  const { exportFormat, setCopied } = deps
  await navigator.clipboard.writeText(deckList(deps, exportFormat))
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}

export function openCollectionCard(deps: AppActionContext, card: ScryfallCard) {
  const {
    openModal,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
    setSelectedCardReference,
  } = deps
  setSelectedCardReference(null)
  setSelectedDeckCardLocation(null)
  setSelectedGuidanceCard(null)
  setSelectedCollectionCard(toDeckCard(card))
  openModal(deps, 'card')
}

export async function fetchBasic(name: string) {
  try {
    return toDeckCard(await fetchScryfallCard(name))
  } catch {
    throw new Error('Basic land unavailable')
  }
}

export async function addBasicLands(
  deps: AppActionContext,
  plan: { name: string; count: number }[],
) {
  const job = deckJob(deps)
  const { closeModal, setBasicLandState } = job.deps
  const expectedDeck = deps.deck
  setBasicLandState('loading')
  try {
    const cards = await Promise.all(
      plan.map(async ({ name, count }) => ({
        card: await fetchBasic(name),
        count,
      })),
    )
    if (!job.isCurrent()) return
    if ((deps.getCurrentState?.() ?? deps).deck !== expectedDeck) {
      setBasicLandState('idle')
      return
    }
    const result = builderAction(deps, { type: 'addBasics', cards })
    if (result.error) throw new Error(result.error)
    setBasicLandState('idle')
    closeModal()
  } catch {
    setBasicLandState('error')
  }
}

export async function selectManualCard(deps: AppActionContext, card: ScryfallCard) {
  deps.manualPrintingRequest.current?.abort()
  const controller = new AbortController()
  deps.manualPrintingRequest.current = controller
  deps.setSelectedCardReference(null)
  deps.setSelectedDeckCardLocation(null)
  deps.setSelectedCollectionCard(null)
  deps.setSelectedGuidanceCard(null)
  deps.setSelectedManualCard(card)
  deps.setManualPrintings([card])
  deps.setManualPrinting(0)
  deps.setManualPrintingError('')
  deps.setBuilderModeReturn('search')
  deps.openModal(deps, 'card')
  if (!card.prints_search_uri) return
  try {
    const printings = (
      await fetchScryfallPrintings(card.prints_search_uri, fetch, controller.signal)
    ).filter((printing) => scryfallImage(printing))
    if (controller.signal.aborted) return
    if (!printings.length) throw new Error('Alternate printings unavailable.')
    const selected = printings.findIndex(
      (printing) =>
        printing.set === card.set && printing.collector_number === card.collector_number,
    )
    deps.setManualPrintings(selected < 0 ? [card, ...printings] : printings)
    deps.setManualPrinting(Math.max(0, selected))
  } catch (error) {
    if (!controller.signal.aborted)
      deps.setManualPrintingError(
        error instanceof ScryfallRateLimitError
          ? error.message
          : 'Alternate printings unavailable. Reopen details to retry.',
      )
  }
}

export async function cycleManualPrinting(deps: AppActionContext) {
  const { loadingArt, manualPrinting, manualPrintings, setManualPrinting, setSelectedManualCard } =
    deps
  if (manualPrintings.length < 2 || loadingArt) return
  const index = (manualPrinting + 1) % manualPrintings.length
  const selected = manualPrintings[index]
  const controller = deps.manualPrintingRequest.current
  await changeArt(deps, selected.name, [scryfallImage(selected)], () => {
    if (controller?.signal.aborted) return
    setSelectedManualCard(selected)
    setManualPrinting(index)
  })
}

export function addSearchCards(deps: AppActionContext, cards: ScryfallCard[]) {
  const previousMainCount = deps.deck.length
  const previousSideboardCount = deps.sideboard.length
  const result = builderAction(deps, {
    type: 'addSearch',
    cards,
  })
  if (result.error) return result.error
  deps.skipCompletionReviewDecks.current.add(result.state.deck)
  const mainCount = result.state.deck.length - previousMainCount
  const sideboardCount = result.state.sideboard.length - previousSideboardCount
  deps.setBatchAnnouncement(
    `Added ${mainCount} to deck and ${sideboardCount} to sideboard from search.`,
  )
  return ''
}

export function addManualCard(deps: AppActionContext) {
  if (deps.selectedManualCard) return addSearchCards(deps, [deps.selectedManualCard])
  return 'Select a card first.'
}

export async function addOneBasic(deps: AppActionContext, name: string) {
  const job = deckJob(deps)
  const { deck, setBasicLandState } = job.deps
  try {
    const added = await fetchBasic(name)
    if (!job.isCurrent() || (deps.getCurrentState?.() ?? deps).deck !== deck) return
    // The + sits on a main-deck row, so it always adds there, even past 100.
    const result = builderAction(deps, { type: 'addOneBasic', card: added })
    if (result.error) throw new Error(result.error)
  } catch {
    setBasicLandState('error')
  }
}

export async function hydrateDeckCardDetails(deps: AppActionContext, card: DeckCard) {
  const job = deckJob(deps)

  try {
    let fetched: ScryfallCard | undefined
    if (
      !card.setName ||
      !card.scryfallUri ||
      !card.printsUri ||
      (hasBackFace(card.layout) && !card.backImage) ||
      (cardCanHavePowerToughness(card) && (!card.power || !card.toughness))
    ) {
      const result = await resolveScryfallIdentifiers([
        { set: card.set, collector_number: card.collectorNumber },
      ])
      fetched = result.data[0]
      if (!fetched) return
    }
    const printsUri = card.printsUri ?? fetched?.prints_search_uri
    let printings = card.printings
    if (
      (!printings ||
        printings.length < 2 ||
        (hasBackFace(card.layout) && printings.some((printing) => !printing.backImage))) &&
      printsUri
    ) {
      const options = printingOptions(await fetchScryfallPrintings(printsUri))
      if (options.length) printings = orderedPrintings(card, options)
    }
    const desiredFinish = card.finish ?? 'nonfoil'
    const selectedIndex =
      printings?.findIndex(
        (printing: any) =>
          printing.set === card.set &&
          printing.collectorNumber === card.collectorNumber &&
          printing.finish === desiredFinish,
      ) ?? -1
    const selected = selectedIndex >= 0 ? printings?.[selectedIndex] : undefined
    const metadata = {
      setName: selected?.setName ?? fetched?.set_name ?? card.setName,
      scryfallUri: selected?.scryfallUri ?? fetched?.scryfall_uri ?? card.scryfallUri,
      power: fetched?.power ?? fetched?.card_faces?.[0]?.power ?? card.power,
      toughness: fetched?.toughness ?? fetched?.card_faces?.[0]?.toughness ?? card.toughness,
      printsUri,
      price: selected?.price ?? fetched?.prices?.usd ?? card.price,
      priceUri: selected?.priceUri ?? fetched?.purchase_uris?.tcgplayer ?? card.priceUri,
      backImage:
        selected?.backImage ?? (fetched ? scryfallBackImage(fetched) : undefined) ?? card.backImage,
      printings,
      printing: selectedIndex >= 0 ? selectedIndex : card.printing,
      finish: selected?.finish ?? card.finish,
      foilType: selected ? selected.foilType : card.foilType,
    }
    // Enrich only the captured card; newer printing choices and gameplay refreshes win.
    if (!job.isCurrent()) return
    builderAction(deps, (builder) => ({
      type: 'data',
      changes: {
        deck: builder.deck.map((item: any) => (item === card ? { ...item, ...metadata } : item)),
      },
    }))
    builderAction(deps, (builder) => ({
      type: 'data',
      changes: {
        sideboard: builder.sideboard.map((item: any) =>
          item === card ? { ...item, ...metadata } : item,
        ),
      },
    }))
  } catch {
    // The modal still shows the locally stored card details when Scryfall is unavailable.
  }
}

export function openGuidanceCard(deps: AppActionContext, card: Card) {
  const {
    openModal,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
    setSelectedCardReference,
  } = deps
  setSelectedCardReference(null)
  setSelectedDeckCardLocation(null)
  setSelectedCollectionCard(null)
  setSelectedGuidanceCard(card)
  openModal(deps, 'card')
}

export function addSelectedGuidanceCard(deps: AppActionContext) {
  const { selectedGuidanceCard } = deps
  if (!selectedGuidanceCard) return
  addRecommendationCard(deps, selectedGuidanceCard)
  closeDeckCard(deps)
}

export function openDeckCard(deps: AppActionContext, card: DeckCard, location: DeckCardLocation) {
  const {
    openModal,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
    setSelectedCardReference,
  } = deps
  setSelectedCardReference(null)
  setSelectedGuidanceCard(null)
  setSelectedCollectionCard(null)
  setSelectedDeckCardLocation(location)
  openModal(deps, 'card')
  if (
    !card.setName ||
    !card.scryfallUri ||
    !card.printings ||
    card.printings.length < 2 ||
    (hasBackFace(card.layout) &&
      (!card.backImage || card.printings?.some((printing) => !printing.backImage))) ||
    (cardCanHavePowerToughness(card) && (!card.power || !card.toughness))
  )
    void hydrateDeckCardDetails(deps, card)
}

export function openCommanderCard(deps: AppActionContext, index: number) {
  const { deck } = deps
  const card = deck[index]
  if (card) openDeckCard(deps, card, { board: 'deck', index })
}

export function openCardReference(deps: AppActionContext, card: Card | DeckCard) {
  if (
    ['review', 'review-changes', 'review-confirm', 'doctor', 'doctor-history', 'search'].includes(
      deps.activeModal,
    ) &&
    !(deps.activeModal === 'doctor-history' && deps.builderModeReturn)
  )
    deps.setBuilderModeReturn(deps.activeModal)
  deps.manualPrintingRequest.current?.abort()
  deps.setSelectedManualCard(null)
  const deckIndex = deps.deck.findIndex(
    (item: DeckCard) =>
      item.name === card.name &&
      item.set === card.set &&
      item.collectorNumber === card.collectorNumber,
  )
  if (deckIndex >= 0)
    return openDeckCard(deps, deps.deck[deckIndex], { board: 'deck', index: deckIndex })
  const sideboardIndex = deps.sideboard.findIndex(
    (item: DeckCard) =>
      item.name === card.name &&
      item.set === card.set &&
      item.collectorNumber === card.collectorNumber,
  )
  if (sideboardIndex >= 0)
    return openDeckCard(deps, deps.sideboard[sideboardIndex], {
      board: 'sideboard',
      index: sideboardIndex,
    })

  deps.setSelectedCardReference('reason' in card ? toDeckCardFromRecommendation(card) : card)
  deps.setSelectedDeckCardLocation(null)
  deps.setSelectedCollectionCard(null)
  deps.setSelectedGuidanceCard(null)
  deps.openModal(deps, 'card')
}

export function closeDeckCard(deps: AppActionContext) {
  const {
    closeModal,
    setPendingCardRemoval,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
    setSelectedCardReference,
  } = deps
  deps.manualPrintingRequest.current?.abort()
  deps.setSelectedManualCard(null)
  deps.setManualPrintings([])
  deps.setManualPrintingError('')
  setPendingCardRemoval(null)
  setSelectedDeckCardLocation(null)
  setSelectedCollectionCard(null)
  setSelectedGuidanceCard(null)
  setSelectedCardReference(null)
  closeModal()
}

export function removeSelectedDeckCard(deps: AppActionContext) {
  const { pendingCardRemoval, selectedDeckCardLocation, setPendingCardRemoval } = deps
  const location = selectedDeckCardLocation
  if (!location) return
  const pending =
    pendingCardRemoval?.board === location.board && pendingCardRemoval.index === location.index
  if (!pending) {
    setPendingCardRemoval({ ...location })
    return
  }
  if (location.board === 'deck') removeDeckCard(deps, location.index)
  else removeSideboardCard(deps, location.index)
  closeDeckCard(deps)
}

export function moveDeckCardToSideboard(deps: AppActionContext, index: number) {
  builderAction(deps, { type: 'moveCard', board: 'deck', index })
}

export function chooseAddZone(deps: AppActionContext, zone: AddZone) {
  builderAction(deps, { type: 'chooseZone', zone })
}

export function moveSelectedDeckCard(deps: AppActionContext) {
  const location = deps.selectedDeckCardLocation
  if (!location) return
  if (location.board === 'deck') moveDeckCardToSideboard(deps, location.index)
  else moveSideboardCard(deps, location.index)
  closeDeckCard(deps)
}

export function removeDeckCard(deps: AppActionContext, index: number) {
  deps.setPendingRemoval(null)
  builderAction(deps, { type: 'removeCard', board: 'deck', index })
}

export function removeSideboardCard(deps: AppActionContext, index: number) {
  builderAction(deps, { type: 'removeCard', board: 'sideboard', index })
}
// Moving between zones is free; the main deck may go over 100 (and so become illegal).
export function moveSideboardCard(deps: AppActionContext, index: number) {
  const result = builderAction(deps, { type: 'moveCard', board: 'sideboard', index })
  if (result.error) deps.setBatchAnnouncement(result.error)
}

export function currentState(deps: AppActionContext): PersistedDeckState | null {
  const { currentDeckState } = deps
  return currentDeckState
}

export function openSavedDecks(deps: AppActionContext) {
  const { activeSavedDeckId, activeSubThemes, commander, deckName, openModal, setDeckName, theme } =
    deps
  if (commander && !activeSavedDeckId && !deckName)
    setDeckName(suggestedDeckName(commander, theme, activeSubThemes))
  openModal(deps, 'saved')
}

export function storeDeck(deps: AppActionContext, overwrite = false) {
  const { activeSavedDeckId, deckName, savedDecks, setActiveSavedDeckId, setSavedDecks } = deps
  const state = currentState(deps)
  const name = deckName.trim()
  const duplicate = savedDecks.find(
    (saved: SavedDeck) =>
      saved.id !== activeSavedDeckId && saved.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  )
  if (!state || !name || (duplicate && !overwrite)) return
  const active = savedDecks.find((saved: SavedDeck) => saved.id === activeSavedDeckId)
  // A new name saves a separate deck; only the active save's own name overwrites it.
  const keepActive = active?.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  const id = duplicate?.id || (keepActive ? activeSavedDeckId : crypto.randomUUID())
  setSavedDecks(
    saveSavedDeck({
      id,
      name,
      updatedAt: new Date().toISOString(),
      state: { ...state, savedDeckId: id },
    }),
  )
  if (deps.signatureDeckKey) bindSignatureBudget(deps.signatureDeckKey, id)
  resetSignatureContext(deps, id)
  setActiveSavedDeckId(id)
}

export function loadSavedDeck(deps: AppActionContext, saved: SavedDeck, checkCurrentData = true) {
  const state = checkCurrentData ? pendingDeckData(saved.state) : saved.state
  deps.setFirstBatchPending?.(state.firstBatchPending ?? false)
  const signatureDeckKey =
    state.savedDeckId || saved.id || deps.buildIdentity?.id || deps.builderState.signatureDeckKey
  const today = deps.buildIdentity?.today ?? deps.builderState.today
  const restored = restoreBuilderState(state, today, signatureDeckKey, deps.builderState)
  builderAction(deps, {
    type: 'restore',
    state: { ...restored, collectionMode: state.collectionMode },
  })
  resetSignatureContext(deps)
  deps.setCollectionPoolSize(null)
  deps.setRecommendationState('idle')
  deps.setCollectionError('')
  deps.setLimitedRecommendations(state.limitedRecommendations)
  deps.setDeckDoctorError('')
  deps.setActiveSavedDeckId(state.savedDeckId || saved.id)
  deps.setDeckName(saved.name)
  deps.navigateView(deps, 'builder', null, true)
}

export function removeSavedDeck(deps: AppActionContext, saved: SavedDeck) {
  const {
    activeSavedDeckId,
    setActiveSavedDeckId,
    setDeckName,
    setPendingSavedDeckRemoval,
    setSavedDecks,
  } = deps
  setPendingSavedDeckRemoval('')
  setSavedDecks(deleteSavedDeck(saved.id))
  if (activeSavedDeckId === saved.id) {
    setActiveSavedDeckId('')
    setDeckName('')
  }
}

function closeImportAndMaybeReview(
  deps: AppActionContext,
  imported: ImportedDeck,
  openReviewAfterImport: boolean,
) {
  deps.closeModal(true)
  if (shouldOpenReviewAfterImport(imported, openReviewAfterImport)) deps.openModal('review')
}

export async function importDeck(
  deps: AppActionContext,
  openReviewAfterImport = true,
  skipMissing = false,
  commanders: string[] = [],
) {
  const job = deckJob(deps)
  const { importSource, setImportError, setImportSource, setImportState } = deps
  if (
    // A retry with skipMissing follows a replacement the player already confirmed.
    !skipMissing &&
    deps.commander &&
    deps.deck.length > 0 &&
    // Lazy import keeps this module loadable by node's test runner, which cannot parse TSX.
    !(await (
      await import('../shared/ConfirmDialog.tsx')
    ).confirmDialog({
      title: 'Replace the current deck?',
      message: `"${deps.deckName || deps.commander}" (${deps.deck.length} cards) stays in Saved decks under Autosaved drafts. Manual saves are unchanged.`,
      confirmLabel: 'Import and replace',
    }))
  )
    return
  setImportState('loading')
  setImportError('')
  try {
    const imported = parseDeckImportSource(importSource, commanders)
    await applyImportedDeck(deps, imported, skipMissing)
    closeImportAndMaybeReview(deps, imported, openReviewAfterImport)
    setImportSource('')
    setImportState('idle')
  } catch (error) {
    if (!job.isCurrent()) return
    setImportError(error instanceof Error ? error.message : 'Could not import deck.')
    if (error instanceof ImportMissingCardsError) {
      deps.setImportFoundCount(error.foundCount)
      setImportState('missing')
    } else setImportState('error')
  }
}

async function resolveImportedPrinting(
  entry: ImportedCard,
  card: ScryfallCard | undefined,
  signal: AbortSignal,
) {
  if (
    !card ||
    !entry.finish ||
    (entry.set && entry.collectorNumber) ||
    card.finishes?.includes(entry.finish)
  )
    return card
  const url = new URL(card.prints_search_uri || 'https://api.scryfall.com/cards/search')
  url.searchParams.set(
    'q',
    `${url.searchParams.get('q') ?? `!"${card.name}"`} game:paper is:${entry.finish}`,
  )
  url.searchParams.set('unique', 'prints')
  url.searchParams.set('order', 'released')
  url.searchParams.set('dir', 'desc')
  const printings = await fetchScryfallPrintings(url.toString(), fetch, signal)
  return printings.find((printing) => printing.finishes?.includes(entry.finish!)) ?? card
}

async function fetchImportedCards(cards: ImportedDeck['cards'], signal: AbortSignal) {
  const identifiers = cards.map((card: any) =>
    card.set && card.collectorNumber
      ? { set: card.set, collector_number: card.collectorNumber }
      : { name: card.name },
  )
  const fetched: ScryfallCard[] = []
  const unresolved: ImportedDeck['cards'] = []
  for (let index = 0; index < identifiers.length; index += 75) {
    const entries = cards.slice(index, index + 75)
    const result = await resolveScryfallIdentifiers(
      identifiers.slice(index, index + 75),
      fetch,
      signal,
    )
    fetched.push(...result.data)
    unresolved.push(...entries.filter((entry: any) => !matchImportedCard(entry, result.data)))
  }
  if (unresolved.length) {
    const result = await resolveScryfallIdentifiers(
      unresolved.map(({ name }: any) => ({ name })),
      fetch,
      signal,
    )
    fetched.push(...result.data)
    // The named endpoint also finds a card by one face's name.
    for (const name of missingCardNames(result.not_found ?? [], unresolved)) {
      const card = await fetchScryfallCard(name, fetch, signal).catch(() => undefined)
      if (card) fetched.push(card)
    }
  }
  return fetched
}

async function resolveImportedCards(
  source: ImportedDeck,
  signal: AbortSignal,
  skipMissing: boolean,
) {
  let imported = source
  const commanderEntries = imported.cards.filter(({ board }: any) => board === 'commander')
  if (!commanderEntries.length) throw new Error('Mark commander with a COMMANDER section.')
  if (commanderEntries.reduce((sum: any, card: any) => sum + card.quantity, 0) > 2)
    throw new Error('Commander section must contain one commander or partner pair.')

  const fetched = await fetchImportedCards(imported.cards, signal)
  const missing = imported.cards.filter((entry) => !matchImportedCard(entry, fetched))
  if (missing.some(({ board }) => board === 'commander'))
    throw new Error(
      `Commander not found: ${missing.find(({ board }) => board === 'commander')!.name}. Check spelling, set, and collector number.`,
    )
  if (missing.length) {
    if (!skipMissing)
      throw new ImportMissingCardsError(
        missing.map(({ name }) => name),
        imported.cards
          .filter((entry) => !missing.includes(entry))
          .reduce((sum, { quantity }) => sum + quantity, 0),
      )
    imported = { ...imported, cards: imported.cards.filter((entry) => !missing.includes(entry)) }
  }
  const resolved = await Promise.all(
    imported.cards.map((entry) =>
      resolveImportedPrinting(entry, matchImportedCard(entry, fetched), signal),
    ),
  )
  const stillMissing = imported.cards.filter((_: any, index: any) => !resolved[index])
  if (stillMissing.length)
    throw new Error(
      `Not found: ${stillMissing.map(({ name }: any) => name).join(', ')}. Check spelling, set, and collector number.`,
    )

  const expanded = imported.cards.flatMap((entry: any, index: any) =>
    Array.from({ length: entry.quantity }, () => ({ entry, card: resolved[index]! })),
  )
  const commanderCards = expanded.filter(({ entry }: any) => entry.board === 'commander')
  const commanderError = commanderConstructionError(
    commanderCards.map(({ card }) => toDeckCard(card)),
  )
  if (commanderError) throw new Error(commanderError)
  const identity = [...new Set(commanderCards.flatMap(({ card }: any) => card.color_identity))]
  const checked: DeckCard[] = []
  for (const { card, entry } of expanded) {
    if (entry.board === 'sideboard') continue
    const converted = toDeckCard(card)
    const error = cardConstructionError(converted, checked, identity)
    if (error) throw new Error(`${card.name}: ${error}`)
    checked.push(converted)
  }

  return { expanded, commanderCards }
}

// Keep an imported finish when the printing has it; otherwise use the printing's default.
function importedDeckCard({ card, entry }: { card: ScryfallCard; entry: ImportedCard }) {
  const finish =
    entry.finish && card.finishes?.includes(entry.finish)
      ? entry.finish
      : defaultFinish(card.finishes)
  return {
    ...toDeckCard(card),
    finish,
    foilType: foilTypeFor(card, finish),
    price: finishPrice(card, finish),
  }
}

async function importedRecommendationState(deps: AppActionContext, name: string) {
  const staged: AppActionContext = {
    ...deps,
    today: deps.buildIdentity?.today ?? deps.today,
    navigateView: () => undefined,
    loadPrintings: async () => undefined,
    recommendationRequest: { current: 0 },
  }
  let builderState = deps.getBuilderState()
  staged.getBuilderState = () => builderState
  staged.getCurrentState = () => staged
  staged.dispatchBuilder = (action) => {
    const result = applyBuilderAction(builderState, action)
    builderState = result.state
    Object.assign(staged, builderState)
    return result
  }
  for (const key of Object.keys(deps).filter((key) => /^set[A-Z]/.test(key))) {
    const field = key[3].toLowerCase() + key.slice(4)
    staged[key] = (value: unknown) => {
      staged[field] = typeof value === 'function' ? value(staged[field]) : value
    }
  }
  const loaded = await startRecommendations(staged, name)
  if (!loaded)
    throw new Error(staged.collectionError || 'Could not load commander recommendations.')
  return persistedDeckStateSchema.parse({ ...staged, savedDeckId: '' })
}

export async function applyImportedDeck(
  deps: AppActionContext,
  imported: ImportedDeck,
  skipMissing = false,
) {
  const job = deckJob(deps)
  const signal = AbortSignal.timeout(30_000)
  const { expanded, commanderCards } = await resolveImportedCards(imported, signal, skipMissing)
  if (!job.isCurrent()) throw new Error('The workspace changed; import was not applied.')
  const name = commanderCards.map(({ card }: any) => card.name).join(' & ')
  const prepared = await importedRecommendationState(deps, name)
  if (!job.isCurrent()) throw new Error('The workspace changed; import was not applied.')
  const importedMain = expanded
    .filter(({ entry }: any) => entry.board !== 'sideboard')
    .sort(
      (a: any, b: any) =>
        Number(b.entry.board === 'commander') - Number(a.entry.board === 'commander'),
    )
    .map(importedDeckCard)
  const importedSideboard = expanded
    .filter(({ entry }: any) => entry.board === 'sideboard')
    .map(importedDeckCard)
  // Keep every printing the recommendation load fetched, so the art can still be cycled, and add
  // the imported printing if that list lacks it.
  const printings = commanderCards.map(({ card }, index) => {
    const all = prepared.commanderDetails?.printings?.[index] ?? []
    const own = printingOptions([card])
    return own.every((option) =>
      all.some((item: any) => item.image === option.image && item.finish === option.finish),
    )
      ? all
      : [...own, ...all]
  })
  const state: PersistedDeckState = {
    ...prepared,
    deck: importedMain,
    sideboard: importedSideboard,
    commanderDetails: {
      ...prepared.commanderDetails,
      images: commanderCards.map(({ card }) => scryfallImage(card)),
      art: commanderCards.map(
        ({ card }) => card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? '',
      ),
      printings,
      selections: printings.map((options, index) =>
        Math.max(
          0,
          options.findIndex(
            (option: any) =>
              option.image === scryfallImage(commanderCards[index].card) &&
              option.finish === importedDeckCard(commanderCards[index]).finish,
          ),
        ),
      ),
    },
    queue: prepared.queue.filter(
      (card) => !expanded.some(({ card: added }) => added.name === card.name),
    ),
  }
  if (deps.beginWorkspace && !(await deps.beginWorkspace()))
    throw new Error('Could not create an import workspace.')
  deps.skipCompletionReviewDecks.current.add(importedMain)
  loadSavedDeck(
    deps,
    {
      id: '',
      name: imported.name ?? '',
      updatedAt: new Date().toISOString(),
      state,
    },
    false,
  )
}

export async function startOver(deps: AppActionContext) {
  if (
    // Lazy import keeps this module loadable by node's test runner, which cannot parse TSX.
    !(await (
      await import('../shared/ConfirmDialog.tsx')
    ).confirmDialog({
      title: 'Start a new deck?',
      message: 'Your current deck stays available in Autosaved drafts. Manual saves are unchanged.',
      confirmLabel: 'Start new deck',
    }))
  )
    return
  if (deps.beginWorkspace && !(await deps.beginWorkspace())) return
  deps.resetFirstUse?.()
  resetSignatureContext(deps)
  const identity = deps.getBuilderState()
  builderAction(deps, {
    type: 'startOver',
    today: deps.buildIdentity?.today ?? identity.today,
    signatureDeckKey: deps.buildIdentity?.id ?? identity.signatureDeckKey,
  })
  deps.setCollectionPoolSize(null)
  deps.setDeckDoctorError('')
  deps.setActiveSavedDeckId('')
  deps.setDeckName('')
  deps.navigateView(deps, 'start', null, true)
}

export function applyDeckDoctorSwapPlan(
  deps: AppActionContext,
  cuts: { cutIndex: number; cutCard: DeckCard }[],
  additions: Card[],
  moveCutToSideboard: boolean,
  id: string,
) {
  const result = builderAction(deps, {
    type: 'doctorApply',
    id,
    cuts,
    additions,
    moveCutToSideboard,
  })
  deps.setDeckDoctorError(result.error ?? '')
  return !result.error
}

export async function undoDeckDoctorSwap(deps: AppActionContext, id: string) {
  const job = deckJob(deps)
  const record = deps.deckDoctorHistory.find((swap: any) => swap.id === id)
  if (!record) return false
  try {
    const refreshed = record.cutCard
      ? applyCurrentCardData(
          record.cutCard,
          await refreshCardData(
            [record.cutCard],
            AbortSignal.timeout(30_000),
            deps.cardDataFetcher,
          ),
        )
      : undefined
    if (!job.isCurrent()) return false
    const current = deps.getCurrentState?.() ?? deps
    if (!current.deckDoctorHistory.includes(record)) return false
    const result = builderAction(current, { type: 'doctorUndo', id, refreshedCut: refreshed })
    if (result.error) throw new Error(result.error)
    deps.setDeckDoctorError('')
    return true
  } catch (error) {
    if (!job.isCurrent()) return false
    deps.setDeckDoctorError(error instanceof Error ? error.message : 'Could not undo swap safely.')
    return false
  }
}
