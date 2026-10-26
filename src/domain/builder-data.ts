import { preferredPrintingIndex } from './recommendation-scoring.ts'
import { applyCurrentCardData } from './card-data.ts'
import { commanderNames } from './commander-catalog.ts'
import type { Card, DeckCard, Printing } from './card-model.ts'
import type { BuilderAction, BuilderState } from './builder-state.ts'

export function withBuilderPrinting<T extends DeckCard>(
  card: T,
  printings: Printing[],
  index: number,
  manual: boolean,
): T {
  const selected = printings[index]
  if (!selected) return card
  return {
    ...card,
    printings,
    printing: index,
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
    ...(manual ? { printingManuallySelected: true } : {}),
  }
}

export function applyBuilderPrinting(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'printing' }>,
): BuilderState {
  const { board, index, printings, selection } = action
  if (!printings[selection]) return state
  const current = state[board][index]
  if (!current || current.name !== action.name) return state
  if (
    action.automatic &&
    current.printingManuallySelected &&
    (current.image !== printings[selection].image || current.finish !== printings[selection].finish)
  )
    return state
  const updated = withBuilderPrinting(current, printings, selection, !action.automatic)
  const result = {
    ...state,
    [board]: state[board].map((card, position) => (position === index ? updated : card)),
  }
  if (board === 'queue' && state.decisions[current.name] === 'add' && !action.automatic) {
    const update = (card: DeckCard) =>
      card.name === current.name ? withBuilderPrinting(card, printings, selection, true) : card
    result.deck = state.deck.map(update)
    result.sideboard = state.sideboard.map(update)
  }
  if (
    board === 'deck' &&
    index < commanderNames(state.commander).length &&
    state.commanderDetails
  ) {
    const selected = printings[selection]
    result.preferredPrintSet = selected.set
    result.commanderDetails = {
      ...state.commanderDetails,
      images: state.commanderDetails.images.map((image, position) =>
        position === index ? selected.image : image,
      ),
      art: state.commanderDetails.art.map((image, position) =>
        position === index ? (selected.art ?? image) : image,
      ),
      selections: state.commanderDetails.selections.map((value, position) =>
        position === index ? selection : value,
      ),
    }
    result.queue = state.queue.map((card) =>
      card.printings?.length
        ? withBuilderPrinting(
            card,
            card.printings,
            preferredPrintingIndex(
              card.printings,
              selected.set,
              card.printing,
              card.printingManuallySelected,
            ),
            false,
          )
        : card,
    )
  }
  return result
}

export function applyBuilderHydration(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'hydrate' }>,
): BuilderState {
  const results = new Map(action.results)
  const update = <T extends DeckCard>(card: T): T =>
    card.dataStatus === 'pending' ? applyCurrentCardData(card, results) : card
  const deck = state.deck.map(update)
  const commanders = deck.slice(0, commanderNames(state.commander).length)
  const commanderDetails =
    state.commanderDetails && commanders.every((card) => card.colorIdentity && !card.dataStatus)
      ? {
          ...state.commanderDetails,
          colours: [...new Set(commanders.flatMap((card) => card.colorIdentity!))],
        }
      : state.commanderDetails
  return {
    ...state,
    deck,
    commanderDetails,
    sideboard: state.sideboard.map(update),
    queue: state.queue.map(update),
    deferredCards: state.deferredCards.map((entry) => ({ ...entry, card: update(entry.card) })),
  }
}

export function retryBuilderData(state: BuilderState): BuilderState {
  const retry = <T extends DeckCard>(card: T): T =>
    card.dataStatus === 'unavailable' ||
    card.commanderLegality === undefined ||
    card.colorIdentity === undefined ||
    !card.manaValueKnown ||
    card.gameChanger === undefined
      ? { ...card, dataStatus: 'pending' }
      : card
  return {
    ...state,
    deck: state.deck.map(retry),
    sideboard: state.sideboard.map(retry),
    queue: state.queue.map(retry),
    deferredCards: state.deferredCards.map((entry) => ({
      ...entry,
      card: retry(entry.card) as Card,
    })),
  }
}
