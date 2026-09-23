import type { KeyboardEvent, MouseEvent } from 'react'
import {
  fetchScryfallCard,
  fetchScryfallCollection,
  fetchScryfallPrintings,
} from '../adapters/scryfall.ts'
import { defaultDeckTargets } from '../deck-analysis.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { cardPrintingOptions } from '../domain/printing.ts'
import type {
  Card,
  DeckCard,
  DeckCardLocation,
  ExportFormat,
  ScryfallCard,
} from '../domain/card-model.ts'
import { scryfallImage, toDeckCard, toDeckCardFromRecommendation } from '../domain/card-model.ts'
import { manualCardError, orderedPrintings, preferredPrintingIndex } from '../recommendations.ts'
import {
  clearDeckState,
  deleteSavedDeck,
  duplicateDeckName,
  saveSavedDeck,
  suggestedDeckName,
  type PersistedDeckState,
  type SavedDeck,
} from '../deck-state.ts'
import {
  matchImportedCard,
  missingCardNames,
  parseDeckList,
  type ImportedDeck,
} from '../deck-import.ts'
import { commanderPromotionInfo, promoteDeckCard } from '../domain/commander-promotion.ts'
import type { ActionDeps } from './recommendation-actions.ts'
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

export function addRecommendationCard(deps: ActionDeps, card: Card) {
  const { deck, setBatchAnnouncement, setDeck, setQueue, setSideboard } = deps
  const added: DeckCard = {
    name: card.name,
    layout: card.layout,
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    detail: card.detail,
    producedMana: card.producedMana,
    faces: card.faces,
    power: card.power,
    toughness: card.toughness,
    set: card.set,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    scryfallUri: card.scryfallUri,
    printsUri: card.printsUri,
    image: card.image,
    backImage: card.backImage,
    price: card.price,
    priceUri: card.priceUri,
    tags: card.tags,
    printings: card.printings,
    printing: card.printing ?? 0,
    printingManuallySelected: card.printingManuallySelected,
    finish: card.finish,
  }
  if (deck.length < 100)
    setDeck((list: any) =>
      list.some((item: any) => item.name === card.name) ? list : [...list, added],
    )
  else
    setSideboard((list: any) =>
      list.some((item: any) => item.name === card.name) ? list : [...list, added],
    )
  setQueue((current: any) => current.filter((item: any) => item.name !== card.name))
  setBatchAnnouncement(`${card.name} added from deck-health guidance.`)
}

export function addCollectionCard(deps: ActionDeps, card: ScryfallCard) {
  const {
    commanderDetails,
    deck,
    sideboard,
    setBatchAnnouncement,
    setDeck,
    setQueue,
    setSideboard,
  } = deps
  if (
    manualCardError(
      card,
      [...deck, ...sideboard].map((item: any) => item.name),
      commanderDetails?.colours ?? [],
    )
  )
    return
  const added = toDeckCard(card)
  if (deck.length < 100) setDeck((current: any) => [...current, added])
  else setSideboard((current: any) => [...current, added])
  setQueue((current: any) => current.filter((item: any) => item.name !== added.name))
  setBatchAnnouncement(`${card.name} added from collection browsing.`)
}

export function decide(deps: ActionDeps, card: Card, action: 'add' | 'later' | 'ignore') {
  const { decisions, deck, setDecisions, setDeck, setIgnoredCards, setLiked, setSideboard } = deps
  const previous = decisions[card.name]
  if (previous === action) {
    if (action === 'add') {
      setDeck((list: any) => list.filter((item: any) => item.name !== card.name))
      setSideboard((list: any) => list.filter((item: any) => item.name !== card.name))
    }
    if (action === 'ignore')
      setIgnoredCards((current: any) => current.filter((name: any) => name !== card.name))
    setDecisions((current: any) => {
      const next = { ...current }
      delete next[card.name]
      return next
    })
    return
  }
  if (previous === 'add') {
    setDeck((list: any) => list.filter((item: any) => item.name !== card.name))
    setSideboard((list: any) => list.filter((item: any) => item.name !== card.name))
  }
  if (previous !== 'add' && action === 'add') {
    const added = {
      name: card.name,
      layout: card.layout,
      typeLine: card.typeLine,
      colorIdentity: card.colorIdentity,
      manaCost: card.manaCost,
      manaValue: card.manaValue,
      detail: card.detail,
      producedMana: card.producedMana,
      faces: card.faces,
      power: card.power,
      toughness: card.toughness,
      set: card.set,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      scryfallUri: card.scryfallUri,
      printsUri: card.printsUri,
      image: card.image,
      backImage: card.backImage,
      price: card.price,
      priceUri: card.priceUri,
      tags: card.tags,
      printings: card.printings,
      printing: card.printing ?? 0,
      printingManuallySelected: card.printingManuallySelected,
      finish: card.finish,
    }
    if (deck.length < 100)
      setDeck((list: any) =>
        card.typeLine.includes('Basic Land') || !list.some((item: any) => item.name === card.name)
          ? [...list, added]
          : list,
      )
    else
      setSideboard((list: any) =>
        card.typeLine.includes('Basic Land') || !list.some((item: any) => item.name === card.name)
          ? [...list, added]
          : list,
      )
  }
  if (action === 'ignore') {
    setLiked((current: any) => current.filter((name: any) => name !== card.name))
    setIgnoredCards((current: any) =>
      current.includes(card.name) ? current : [...current, card.name],
    )
  } else setIgnoredCards((current: any) => current.filter((name: any) => name !== card.name))
  setDecisions((current: any) => ({ ...current, [card.name]: action }))
}

export async function promoteToCommander(deps: ActionDeps, candidate: Card | DeckCard) {
  const {
    commander,
    commanderDetails,
    deck,
    sideboard,
    setBatchAnnouncement,
    setDeck,
    setQueue,
    setSideboard,
    start,
  } = deps
  if (commanderNames(commander).includes(candidate.name)) return
  const promotion = commanderPromotionInfo(candidate, deck, commanderDetails?.colours ?? [])
  if (!promotion?.canPromote) return
  const existing = [...deck, ...sideboard].find((card: DeckCard) => card.name === candidate.name)
  const promoted = existing ?? toDeckCardFromRecommendation(candidate as Card)
  const next = promoteDeckCard(deck, sideboard, promoted)
  const loaded = await start(candidate.name, true)
  if (!loaded) return
  setDeck(next.deck)
  setSideboard(next.sideboard)
  setQueue((current: Card[]) => current.filter((card) => card.name !== candidate.name))
  setBatchAnnouncement(`${candidate.name} is now your commander.`)
}

export async function changeArt(
  deps: ActionDeps,
  name: string,
  sources: (string | undefined)[],
  apply: () => void,
) {
  const { setLoadingArt } = deps
  setLoadingArt(`pending:${name}`)
  const loadingTimer = setTimeout(() => setLoadingArt(name), 50)
  await preloadArt(sources)
  clearTimeout(loadingTimer)
  apply()
  setLoadingArt('')
}

export async function cycleCommanderPrinting(deps: ActionDeps, commanderIndex: number) {
  const {
    commander,
    commanderDetails,
    loadingArt,
    setCommanderDetails,
    setDeck,
    setPreferredPrintSet,
    setQueue,
  } = deps
  if (!commanderDetails || commanderDetails.printings[commanderIndex].length < 2 || loadingArt)
    return
  const selection =
    (commanderDetails.selections[commanderIndex] + 1) %
    commanderDetails.printings[commanderIndex].length
  const selected = commanderDetails.printings[commanderIndex][selection]
  const name = commanderNames(commander)[commanderIndex]
  await changeArt(deps, name, [selected.image, selected.art], () => {
    setPreferredPrintSet(selected.set)
    setCommanderDetails(
      (current: any) =>
        current && {
          ...current,
          images: current.images.map((image: any, index: any) =>
            index === commanderIndex ? selected.image : image,
          ),
          art: current.art.map((image: any, index: any) =>
            index === commanderIndex ? (selected.art ?? image) : image,
          ),
          selections: current.selections.map((value: any, index: any) =>
            index === commanderIndex ? selection : value,
          ),
        },
    )
    setDeck((current: any) =>
      current.map((card: any, index: any) =>
        index === commanderIndex
          ? {
              ...card,
              image: selected.image,
              backImage: selected.backImage,
              set: selected.set,
              setName: selected.setName,
              collectorNumber: selected.collectorNumber,
              scryfallUri: selected.scryfallUri,
              price: selected.price,
              priceUri: selected.priceUri,
              printing: selection,
              finish: selected.finish,
            }
          : card,
      ),
    )
    setQueue((current: any) =>
      current.map((card: any) => {
        if (!card.printings?.length) return card
        const matching = preferredPrintingIndex(
          card.printings,
          selected.set,
          card.printing,
          card.printingManuallySelected,
        )
        const printing = card.printings[matching]
        return {
          ...card,
          image: printing.image,
          backImage: printing.backImage,
          set: printing.set,
          setName: printing.setName,
          collectorNumber: printing.collectorNumber,
          scryfallUri: printing.scryfallUri,
          price: printing.price,
          priceUri: printing.priceUri,
          printing: matching,
          finish: printing.finish,
        }
      }),
    )
  })
}

export async function cyclePrinting(deps: ActionDeps, card: Card) {
  const { decisions, loadingArt, setDeck, setQueue, setSelectedGuidanceCard, setSideboard } = deps
  if (!card.printings || card.printings.length < 2 || loadingArt) return
  const index = ((card.printing ?? 0) + 1) % card.printings.length
  const selected = card.printings[index]
  await changeArt(deps, card.name, [selected.image], () => {
    setQueue((current: any) =>
      current.map((item: any) =>
        item.name === card.name
          ? {
              ...item,
              printing: index,
              image: selected.image,
              backImage: selected.backImage,
              set: selected.set,
              setName: selected.setName,
              collectorNumber: selected.collectorNumber,
              scryfallUri: selected.scryfallUri,
              price: selected.price,
              priceUri: selected.priceUri,
              printingManuallySelected: true,
              finish: selected.finish,
            }
          : item,
      ),
    )
    setSelectedGuidanceCard((current: Card | null) =>
      current?.name === card.name
        ? {
            ...current,
            printing: index,
            image: selected.image,
            backImage: selected.backImage,
            set: selected.set,
            setName: selected.setName,
            collectorNumber: selected.collectorNumber,
            scryfallUri: selected.scryfallUri,
            price: selected.price,
            priceUri: selected.priceUri,
            printingManuallySelected: true,
            finish: selected.finish,
          }
        : current,
    )
    if (decisions[card.name] === 'add') {
      const update = (item: DeckCard) =>
        item.name === card.name
          ? {
              ...item,
              set: selected.set,
              setName: selected.setName,
              collectorNumber: selected.collectorNumber,
              scryfallUri: selected.scryfallUri,
              image: selected.image,
              backImage: selected.backImage,
              price: selected.price,
              priceUri: selected.priceUri,
              printing: index,
              printingManuallySelected: true,
              finish: selected.finish,
            }
          : item
      setDeck((current: any) => current.map(update))
      setSideboard((current: any) => current.map(update))
    }
  })
}

export async function cycleDeckPrinting(deps: ActionDeps, cardIndex: number) {
  const { commander, deck, loadingArt, setDeck } = deps
  if (cardIndex < commanderNames(commander).length) {
    await cycleCommanderPrinting(deps, cardIndex)
    return
  }
  const card = deck[cardIndex]
  if (!card.printings || card.printings.length < 2 || loadingArt) return
  const printing = ((card.printing ?? 0) + 1) % card.printings.length
  const selected = card.printings[printing]
  await changeArt(deps, card.name, [selected.image], () =>
    setDeck((current: any) =>
      current.map((item: any, index: any) =>
        index === cardIndex
          ? {
              ...item,
              image: selected.image,
              backImage: selected.backImage,
              set: selected.set,
              setName: selected.setName,
              collectorNumber: selected.collectorNumber,
              scryfallUri: selected.scryfallUri,
              price: selected.price,
              priceUri: selected.priceUri,
              printing,
              printingManuallySelected: true,
              finish: selected.finish,
            }
          : item,
      ),
    ),
  )
}

export async function cycleSideboardPrinting(deps: ActionDeps, cardIndex: number) {
  const { loadingArt, setSideboard, sideboard } = deps
  const card = sideboard[cardIndex]
  if (!card?.printings || card.printings.length < 2 || loadingArt) return
  const printing = ((card.printing ?? 0) + 1) % card.printings.length
  const selected = card.printings[printing]
  await changeArt(deps, card.name, [selected.image], () =>
    setSideboard((current: any) =>
      current.map((item: any, index: any) =>
        index === cardIndex
          ? {
              ...item,
              image: selected.image,
              backImage: selected.backImage,
              set: selected.set,
              setName: selected.setName,
              collectorNumber: selected.collectorNumber,
              scryfallUri: selected.scryfallUri,
              price: selected.price,
              priceUri: selected.priceUri,
              printing,
              printingManuallySelected: true,
              finish: selected.finish,
            }
          : item,
      ),
    ),
  )
}

export async function cycleSelectedDeckCardPrinting(deps: ActionDeps) {
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

export function deckList(deps: ActionDeps, format: ExportFormat) {
  const { commander, deck, sideboard } = deps
  const commanderCount = commanderNames(commander).length
  const section = (cards: DeckCard[]) =>
    cards
      .map((card: any) => {
        const finish = card.finish === 'foil' ? ' *F*' : card.finish === 'etched' ? ' *E*' : ''
        return format === 'plain'
          ? `1 ${card.name}${finish}`
          : format === 'csv'
            ? `1,"${card.name.replaceAll('"', '""')}",${card.set.toUpperCase()},${card.collectorNumber},${card.finish ?? ''}`
            : `1 ${card.name} (${card.set.toUpperCase()}) ${card.collectorNumber}${finish}`
      })
      .join('\n')
  if (format === 'csv')
    return [
      'Quantity,Name,Set,Collector Number,Foil,Board',
      ...deck.map(
        (card: any, index: any) =>
          `${section([card])},${index < commanderCount ? 'Commander' : 'Mainboard'}`,
      ),
      ...sideboard.map((card: any) => `${section([card])},Sideboard`),
    ].join('\n')
  if (format === 'moxfield')
    return `${section(deck.slice(commanderCount))}${sideboard.length ? `\n\nSIDEBOARD:\n${section(sideboard)}` : ''}`
  return `${section(deck)}${sideboard.length ? `\n\nSIDEBOARD:\n${section(sideboard)}` : ''}`
}

export async function copyDeck(deps: ActionDeps) {
  const { exportFormat, setCopied } = deps
  await navigator.clipboard.writeText(deckList(deps, exportFormat))
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}

export function openCollectionCard(deps: ActionDeps, card: ScryfallCard) {
  const {
    openModal,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
  } = deps
  setSelectedDeckCardLocation(null)
  setSelectedGuidanceCard(null)
  setSelectedCollectionCard(toDeckCard(card))
  openModal(deps, 'card')
}

export async function fetchBasic(deps: ActionDeps, name: string) {
  const { basicCardCache } = deps
  const cached = basicCardCache.get(name)
  if (cached) return toDeckCard(cached)
  let card: ScryfallCard
  try {
    card = await fetchScryfallCard(name)
  } catch {
    throw new Error('Basic land unavailable')
  }
  basicCardCache.set(name, card)
  return toDeckCard(card)
}

export async function addBasicLands(deps: ActionDeps, plan: { name: string; count: number }[]) {
  const { closeModal, setBasicLandState, setDeck } = deps
  setBasicLandState('loading')
  try {
    const cards = await Promise.all(
      plan.map(async ({ name, count }) => ({
        card: await fetchBasic(deps, name),
        count,
      })),
    )
    setDeck((current: any) =>
      [
        ...current,
        ...cards.flatMap(({ card, count }) => Array.from({ length: count }, () => ({ ...card }))),
      ].slice(0, 100),
    )
    setBasicLandState('idle')
    closeModal()
  } catch {
    setBasicLandState('error')
  }
}

export function closeCardSearch(deps: ActionDeps) {
  const {
    cardSearchButton,
    closeModal,
    setCardSearch,
    setCardSearchResults,
    setCardSearchState,
    setManualPrinting,
    setManualPrintings,
    setSelectedManualCard,
  } = deps
  closeModal()
  setCardSearch('')
  setCardSearchResults([])
  setSelectedManualCard(null)
  setManualPrintings([])
  setManualPrinting(0)
  setCardSearchState('idle')
  requestAnimationFrame(() => cardSearchButton.current?.focus())
}

export async function selectManualCard(deps: ActionDeps, card: ScryfallCard) {
  const { setManualPrinting, setManualPrintings, setSelectedManualCard } = deps
  setSelectedManualCard(card)
  setManualPrintings([card])
  setManualPrinting(0)
  if (!card.prints_search_uri) return
  const printings = (await fetchScryfallPrintings(card.prints_search_uri)).filter(
    (printing: any) => printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal,
  )
  const selected = printings.findIndex(
    (printing: any) =>
      printing.set === card.set && printing.collector_number === card.collector_number,
  )
  setManualPrintings(printings)
  setManualPrinting(Math.max(0, selected))
}

export async function cycleManualPrinting(deps: ActionDeps) {
  const { loadingArt, manualPrinting, manualPrintings, setManualPrinting, setSelectedManualCard } =
    deps
  if (manualPrintings.length < 2 || loadingArt) return
  const index = (manualPrinting + 1) % manualPrintings.length
  const selected = manualPrintings[index]
  await changeArt(deps, selected.name, [scryfallImage(selected)], () => {
    setSelectedManualCard(selected)
    setManualPrinting(index)
  })
}

export function addManualCard(deps: ActionDeps) {
  const { commanderDetails, deck, selectedManualCard, setDeck, setQueue, setSideboard, sideboard } =
    deps
  if (
    !selectedManualCard ||
    manualCardError(
      selectedManualCard,
      [...deck, ...sideboard].map((card: any) => card.name),
      commanderDetails?.colours ?? [],
    )
  )
    return
  const added = {
    ...toDeckCard(selectedManualCard),
    finish: selectedManualCard.finishes?.includes('nonfoil')
      ? ('nonfoil' as const)
      : selectedManualCard.finishes?.[0],
  }
  if (deck.length < 100) setDeck((current: any) => [...current, added])
  else setSideboard((current: any) => [...current, added])
  setQueue((current: any) => current.filter((item: any) => item.name !== added.name))
  closeCardSearch(deps)
}

export function handleCardSearchKeys(deps: ActionDeps, event: KeyboardEvent<HTMLElement>) {
  const { cardSearchDialog } = deps
  if (event.key === 'Escape') {
    event.preventDefault()
    closeCardSearch(deps)
    return
  }
  const focusable = [
    ...((cardSearchDialog.current as HTMLElement | null)?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled)',
    ) ?? []),
  ]
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const index = focusable.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'ArrowDown' ? Math.min(index + 1, focusable.length - 1) : Math.max(index - 1, 0)
    if (index >= 0 && next !== index) {
      event.preventDefault()
      focusable[next]?.focus()
    }
    return
  }
  if (event.key !== 'Tab' || !focusable.length) return
  const next = event.shiftKey ? focusable.at(-1) : focusable[0]
  if (
    (event.shiftKey && document.activeElement === focusable[0]) ||
    (!event.shiftKey && document.activeElement === focusable.at(-1))
  ) {
    event.preventDefault()
    next?.focus()
  }
}

export async function addOneBasic(deps: ActionDeps, name: string) {
  const { deck, setBasicLandState, setDeck } = deps
  if (deck.length >= 100) return
  try {
    const existing = deck.find((card: any) => card.name === name)
    const added = existing ? { ...existing } : await fetchBasic(deps, name)
    setDeck((current: any) => (current.length < 100 ? [...current, added] : current))
  } catch {
    setBasicLandState('error')
  }
}

export function clearAddedDecision(deps: ActionDeps, name: string) {
  const { setDecisions } = deps
  setDecisions((current: any) => {
    if (current[name] !== 'add') return current
    const next = { ...current }
    delete next[name]
    return next
  })
}

export function positionDeckPreview(
  deps: ActionDeps,
  rowOrEvent: HTMLLIElement | MouseEvent<HTMLLIElement>,
  pointerX = window.innerWidth * 0.5,
) {
  void deps
  const row = 'currentTarget' in rowOrEvent ? rowOrEvent.currentTarget : rowOrEvent
  if (!row || typeof row.getBoundingClientRect !== 'function') return
  const bounds = row.getBoundingClientRect()
  const edge = 16
  const gap = 12
  const previewWidth = Math.min(320, window.innerWidth * 0.25)
  const previewHeight = Math.min(window.innerHeight - edge * 2, (previewWidth * 680) / 488 + 48)
  const maxTop = Math.max(edge, window.innerHeight - previewHeight - edge)
  const top = Math.min(maxTop, Math.max(edge, bounds.top + (bounds.height - previewHeight) / 2))
  const rightPosition = bounds.right + gap
  const leftPosition = window.innerWidth - bounds.left + gap
  const rightFits = rightPosition + previewWidth <= window.innerWidth - edge
  const leftFits = leftPosition + previewWidth <= window.innerWidth - edge
  const showRight = rightFits && (pointerX < window.innerWidth * 0.6 || !leftFits)
  row.style.setProperty('--preview-top', `${top}px`)
  row.style.setProperty(
    '--preview-left',
    showRight
      ? `${Math.max(edge, Math.min(rightPosition, window.innerWidth - previewWidth - edge))}px`
      : 'auto',
  )
  row.style.setProperty(
    '--preview-right',
    showRight
      ? 'auto'
      : `${Math.max(edge, Math.min(leftPosition, window.innerWidth - previewWidth - edge))}px`,
  )
}

export async function hydrateDeckCardDetails(deps: ActionDeps, card: DeckCard) {
  const { setDeck, setSideboard } = deps
  try {
    let fetched: ScryfallCard | undefined
    if (
      !card.setName ||
      !card.scryfallUri ||
      !card.printsUri ||
      (card.faces.length > 1 && !card.backImage) ||
      (cardCanHavePowerToughness(card) && (!card.power || !card.toughness))
    ) {
      const response = await fetchScryfallCollection([
        { set: card.set, collector_number: card.collectorNumber },
      ])
      if (!response.ok) return
      fetched = ((await response.json()) as { data: ScryfallCard[] }).data[0]
      if (!fetched) return
    }
    const printsUri = card.printsUri ?? fetched?.prints_search_uri
    let printings = card.printings
    if (
      (!printings ||
        printings.length < 2 ||
        (card.faces.length > 1 && printings.some((printing) => !printing.backImage))) &&
      printsUri
    ) {
      const options = cardPrintingOptions(await fetchScryfallPrintings(printsUri))
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
      colorIdentity: fetched?.color_identity ?? card.colorIdentity,
      printsUri,
      price: selected?.price ?? fetched?.prices?.usd ?? card.price,
      priceUri: selected?.priceUri ?? fetched?.purchase_uris?.tcgplayer ?? card.priceUri,
      backImage:
        selected?.backImage ?? fetched?.card_faces?.[1]?.image_uris?.normal ?? card.backImage,
      printings,
      printing: selectedIndex >= 0 ? selectedIndex : card.printing,
      finish: selected?.finish ?? card.finish,
    }
    const isSamePrinting = (item: DeckCard) =>
      item.name === card.name &&
      item.set === card.set &&
      item.collectorNumber === card.collectorNumber
    setDeck((current: any) =>
      current.map((item: any) => (isSamePrinting(item) ? { ...item, ...metadata } : item)),
    )
    setSideboard((current: any) =>
      current.map((item: any) => (isSamePrinting(item) ? { ...item, ...metadata } : item)),
    )
  } catch {
    // The modal still shows the locally stored card details when Scryfall is unavailable.
  }
}

export function openGuidanceCard(deps: ActionDeps, card: Card) {
  const {
    openModal,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
  } = deps
  setSelectedDeckCardLocation(null)
  setSelectedCollectionCard(null)
  setSelectedGuidanceCard(card)
  openModal(deps, 'card')
}

export function addSelectedGuidanceCard(deps: ActionDeps) {
  const { selectedGuidanceCard } = deps
  if (!selectedGuidanceCard) return
  addRecommendationCard(deps, selectedGuidanceCard)
  closeDeckCard(deps)
}

export function openDeckCard(deps: ActionDeps, card: DeckCard, location: DeckCardLocation) {
  const {
    openModal,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
  } = deps
  setSelectedGuidanceCard(null)
  setSelectedCollectionCard(null)
  setSelectedDeckCardLocation(location)
  openModal(deps, 'card')
  if (
    !card.setName ||
    !card.scryfallUri ||
    !card.printings ||
    card.printings.length < 2 ||
    (card.faces.length > 1 &&
      (!card.backImage || card.printings?.some((printing) => !printing.backImage))) ||
    (cardCanHavePowerToughness(card) && (!card.power || !card.toughness))
  )
    void hydrateDeckCardDetails(deps, card)
}

export function openCommanderCard(deps: ActionDeps, index: number) {
  const { deck } = deps
  const card = deck[index]
  if (card) openDeckCard(deps, card, { board: 'deck', index })
}

export function closeDeckCard(deps: ActionDeps) {
  const {
    closeModal,
    setPendingCardRemoval,
    setSelectedCollectionCard,
    setSelectedDeckCardLocation,
    setSelectedGuidanceCard,
  } = deps
  setPendingCardRemoval(null)
  setSelectedDeckCardLocation(null)
  setSelectedCollectionCard(null)
  setSelectedGuidanceCard(null)
  closeModal()
}

export function removeSelectedDeckCard(deps: ActionDeps) {
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

export function removeDeckCard(deps: ActionDeps, index: number) {
  const { deck, setDeck, setPendingRemoval } = deps
  const removed = deck[index]
  setPendingRemoval(null)
  setDeck((current: any) => current.filter((_: any, cardIndex: any) => cardIndex !== index))
  clearAddedDecision(deps, removed.name)
}

export function removeSideboardCard(deps: ActionDeps, index: number) {
  const { setSideboard, sideboard } = deps
  const removed = sideboard[index]
  setSideboard((current: any) => current.filter((_: any, cardIndex: any) => cardIndex !== index))
  clearAddedDecision(deps, removed.name)
}

export function moveSideboardCard(deps: ActionDeps, index: number) {
  const { deck, setDeck, setSideboard, sideboard } = deps
  if (deck.length >= 100) return
  const card = sideboard[index]
  setSideboard((current: any) => current.filter((_: any, cardIndex: any) => cardIndex !== index))
  setDeck((current: any) => [...current, card])
}

export function currentState(deps: ActionDeps): PersistedDeckState | null {
  const { currentDeckState } = deps
  return currentDeckState
}

export function openSavedDecks(deps: ActionDeps) {
  const { activeSavedDeckId, activeSubThemes, commander, deckName, openModal, setDeckName, theme } =
    deps
  if (commander && !activeSavedDeckId && !deckName)
    setDeckName(suggestedDeckName(commander, theme, activeSubThemes))
  openModal(deps, 'saved')
}

export function storeDeck(deps: ActionDeps) {
  const { activeSavedDeckId, deckName, savedDecks, setActiveSavedDeckId, setSavedDecks } = deps
  const state = currentState(deps)
  const name = deckName.trim()
  if (!state || !name || duplicateDeckName(savedDecks, name, activeSavedDeckId)) return
  const id = activeSavedDeckId || crypto.randomUUID()
  setSavedDecks(
    saveSavedDeck({
      id,
      name,
      updatedAt: new Date().toISOString(),
      state: { ...state, savedDeckId: id },
    }),
  )
  setActiveSavedDeckId(id)
}

export function loadSavedDeck(deps: ActionDeps, saved: SavedDeck) {
  const {
    navigateView,
    setActiveSavedDeckId,
    setActiveSubThemes,
    setBatchNumber,
    setCollectionGroups,
    setCollectionMode,
    setCollectionPoolSize,
    setCollectionSets,
    setCommander,
    setCommanderDetails,
    setCommanderSubThemes,
    setDecisions,
    setDeck,
    setDeckName,
    setDeckTargets,
    setDeferredCards,
    setDismissedSubThemes,
    setIgnoredCards,
    setLiked,
    setLimitedRecommendations,
    setPreferenceScores,
    setPreferredPrintSet,
    setPrioritizeDeckHealth,
    setQueue,
    setRecommendationStyle,
    setSideboard,
    setTheme,
  } = deps
  const state = saved.state
  setCommander(state.commander)
  setCommanderDetails(state.commanderDetails)
  setTheme(state.theme)
  setRecommendationStyle(state.recommendationStyle)
  setCollectionSets(state.collectionSets)
  setCollectionGroups(state.collectionGroups)
  setCollectionMode(state.collectionMode)
  setPrioritizeDeckHealth(state.prioritizeDeckHealth)
  setCollectionPoolSize(null)
  setQueue(state.queue)
  setLimitedRecommendations(state.limitedRecommendations)
  setDecisions(state.decisions)
  setIgnoredCards(state.ignoredCards)
  setLiked(state.liked)
  setActiveSubThemes(state.activeSubThemes)
  setDismissedSubThemes(state.dismissedSubThemes)
  setPreferenceScores(state.preferenceScores)
  setCommanderSubThemes(state.commanderSubThemes)
  setDeferredCards(state.deferredCards)
  setBatchNumber(state.batchNumber)
  setDeck(state.deck)
  setSideboard(state.sideboard)
  setPreferredPrintSet(state.preferredPrintSet)
  setDeckTargets(state.deckTargets)
  setActiveSavedDeckId(state.savedDeckId || saved.id)
  setDeckName(saved.name)
  navigateView(deps, 'builder', null, true)
}

export function removeSavedDeck(deps: ActionDeps, saved: SavedDeck) {
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

export async function importDeck(deps: ActionDeps) {
  const { closeModal, importSource, setImportError, setImportSource, setImportState } = deps
  setImportState('loading')
  setImportError('')
  try {
    if (/^https?:\/\//i.test(importSource.trim()))
      throw new Error(
        'URL import is unavailable in this client-only app. Paste the exported deck list instead.',
      )
    await applyImportedDeck(deps, parseDeckList(importSource))
    closeModal(true)
    setImportSource('')
    setImportState('idle')
  } catch (error) {
    setImportError(error instanceof Error ? error.message : 'Could not import deck.')
    setImportState('error')
  }
}

export async function applyImportedDeck(deps: ActionDeps, imported: ImportedDeck) {
  const { setActiveSavedDeckId, setDeck, setDeckName, setQueue, setSideboard } = deps
  const commanderEntries = imported.cards.filter(({ board }: any) => board === 'commander')
  if (!commanderEntries.length) throw new Error('Mark commander with a COMMANDER section.')
  if (commanderEntries.reduce((sum: any, card: any) => sum + card.quantity, 0) > 2)
    throw new Error('Commander section must contain one commander or partner pair.')
  const mainCount = imported.cards
    .filter(({ board }: any) => board !== 'sideboard')
    .reduce((sum: any, card: any) => sum + card.quantity, 0)
  if (mainCount > 100) throw new Error('Main deck exceeds 100 cards.')

  const identifiers = imported.cards.map((card: any) =>
    card.set && card.collectorNumber
      ? { set: card.set, collector_number: card.collectorNumber }
      : { name: card.name },
  )
  const fetched: ScryfallCard[] = []
  const unresolved: typeof imported.cards = []
  for (let index = 0; index < identifiers.length; index += 75) {
    const entries = imported.cards.slice(index, index + 75)
    const response = await fetchScryfallCollection(identifiers.slice(index, index + 75))
    if (!response.ok) throw new Error('Scryfall unavailable. Try again.')
    const result = (await response.json()) as {
      data: ScryfallCard[]
      not_found?: { name?: string; set?: string; collector_number?: string }[]
    }
    fetched.push(...result.data)
    unresolved.push(...entries.filter((entry: any) => !matchImportedCard(entry, result.data)))
  }
  if (unresolved.length) {
    const response = await fetchScryfallCollection(unresolved.map(({ name }: any) => ({ name })))
    if (!response.ok) throw new Error('Scryfall unavailable. Try again.')
    const result = (await response.json()) as {
      data: ScryfallCard[]
      not_found?: { name?: string; set?: string; collector_number?: string }[]
    }
    fetched.push(...result.data)
    if (result.not_found?.length)
      throw new Error(
        `Not found: ${missingCardNames(result.not_found, unresolved).join(', ')}. Check spelling, set, and collector number.`,
      )
  }
  const resolved = imported.cards.map((entry: any) => matchImportedCard(entry, fetched))
  const stillMissing = imported.cards.filter((_: any, index: any) => !resolved[index])
  if (stillMissing.length)
    throw new Error(
      `Not found: ${stillMissing.map(({ name }: any) => name).join(', ')}. Check spelling, set, and collector number.`,
    )

  const expanded = imported.cards.flatMap((entry: any, index: any) =>
    Array.from({ length: entry.quantity }, () => ({ entry, card: resolved[index]! })),
  )
  const commanderCards = expanded.filter(({ entry }: any) => entry.board === 'commander')
  if (
    commanderCards.some(
      ({ card }: any) =>
        !card.type_line.includes('Legendary') && !card.type_line.includes('Background'),
    )
  )
    throw new Error('Commander section contains a card that cannot be a commander.')
  const identity = [...new Set(commanderCards.flatMap(({ card }: any) => card.color_identity))]
  const illegal = expanded.find(({ card }: any) =>
    card.color_identity.some((colour: any) => !identity.includes(colour)),
  )
  if (illegal) throw new Error(`${illegal.card.name} is outside commander colour identity.`)

  const name = commanderCards.map(({ card }: any) => card.name).join(' & ')
  const loaded = await deps.start(name)
  if (!loaded) throw new Error('Could not load commander recommendations.')
  const toImportedCard = ({ card }: (typeof expanded)[number]) => toDeckCard(card)
  const importedMain = expanded
    .filter(({ entry }: any) => entry.board !== 'sideboard')
    .sort(
      (a: any, b: any) =>
        Number(b.entry.board === 'commander') - Number(a.entry.board === 'commander'),
    )
    .map(toImportedCard)
  const importedSideboard = expanded
    .filter(({ entry }: any) => entry.board === 'sideboard')
    .map(toImportedCard)
  setDeck(importedMain)
  setSideboard(importedSideboard)
  setQueue((current: any) =>
    current.filter(
      (card: any) => !expanded.some(({ card: importedCard }) => importedCard.name === card.name),
    ),
  )
  setDeckName(imported.name ?? '')
  setActiveSavedDeckId('')
}

export function startOver(deps: ActionDeps) {
  const {
    navigateView,
    recommendationStyle,
    setActiveSavedDeckId,
    setActiveSubThemes,
    setBatchNumber,
    setCollectionGroups,
    setCollectionMode,
    setCollectionPoolSize,
    setCollectionSets,
    setCommander,
    setCommanderDetails,
    setCommanderSubThemes,
    setDecisions,
    setDeck,
    setDeckName,
    setDeckTargets,
    setDeferredCards,
    setDismissedSubThemes,
    setIgnoredCards,
    setLiked,
    setPreferenceScores,
    setPreferredPrintSet,
    setPrioritizeDeckHealth,
    setQueue,
    setSideboard,
    setTheme,
  } = deps
  if (
    !window.confirm(
      'Start over? This clears your current deck and recommendation history. Saved decks remain available.',
    )
  )
    return
  clearDeckState()
  setCommander('')
  setCommanderDetails(null)
  setTheme('')
  setCollectionSets([])
  setCollectionGroups([])
  setCollectionMode('none')
  setPrioritizeDeckHealth(recommendationStyle !== 'story')
  setCollectionPoolSize(null)
  setDeck([])
  setSideboard([])
  setQueue([])
  setDecisions({})
  setIgnoredCards([])
  setLiked([])
  setActiveSubThemes([])
  setDismissedSubThemes([])
  setPreferenceScores({})
  setCommanderSubThemes([])
  setDeferredCards([])
  setBatchNumber(1)
  setPreferredPrintSet('')
  setDeckTargets(defaultDeckTargets)
  setActiveSavedDeckId('')
  setDeckName('')
  navigateView(deps, 'start', null, true)
}
