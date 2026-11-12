import { builderAction } from './builder-action.ts'
import { withinPriceCap } from '../domain/recommendation-tuning.ts'
import { ScryfallRateLimitError } from '../adapters/scryfall.ts'
import { nonfoilFirstIndex, printingOptions } from '../domain/printing.ts'
import { orderedPrintings, preferredPrintingIndex } from '../recommendations.ts'
import type { Card, Printing, ScryfallCard } from '../domain/card-model.ts'
import type { CollectionMode } from '../recommendations.ts'
import type { AppActionContext } from './recommendation-actions.ts'
import { deckJob } from './deck-job.ts'

function buildPrintings(card: Card, result: ScryfallCard[]) {
  return orderedPrintings(card, [
    ...(card.printings?.length === 1 ? card.printings : []),
    ...printingOptions(result),
  ])
}

// Automatic choices never pick a foil or etched finish while a matching nonfoil option exists.
function selectedPrintingIndex(
  card: Card,
  printings: Printing[],
  preferredSet: string,
  selectedCollectionSets: string[],
  selectedCollectionMode: CollectionMode,
  maxPrice?: number | null,
) {
  if (!printings.length) return -1
  if (card.printingManuallySelected || card.printings?.length === 1)
    return printings.findIndex(
      (printing) => printing.image === card.image && printing.finish === card.finish,
    )
  const affordable = (printing: Printing) => withinPriceCap(printing, maxPrice)
  const collectionPrinting =
    selectedCollectionMode !== 'none' && selectedCollectionSets.length
      ? nonfoilFirstIndex(
          printings,
          (printing) => selectedCollectionSets.includes(printing.set) && affordable(printing),
        )
      : -1
  if (collectionPrinting >= 0) return collectionPrinting
  const preferred = preferredPrintingIndex(printings, preferredSet)
  return affordable(printings[preferred]) ? preferred : nonfoilFirstIndex(printings, affordable)
}

function updateQueuedCard(
  deps: AppActionContext,
  offered: Card,
  printings: Printing[],
  selectedIndex: number,
) {
  const current = deps.getCurrentState?.() ?? deps
  builderAction(current, {
    type: 'printing',
    board: 'queue',
    index: current.queue.findIndex((card: Card) => card.name === offered.name),
    name: offered.name,
    printings,
    selection: selectedIndex,
    automatic: true,
  })
}

export async function loadPrintings(
  deps: AppActionContext,
  cards: Card[],
  preferredSet = '',
  selectedCollectionSets: string[] = deps.collectionSets,
  selectedCollectionMode: CollectionMode = deps.collectionMode,
) {
  const job = deckJob(deps)
  deps = job.deps
  const { fetchPrintings } = deps
  for (const offered of cards.slice(0, 8)) {
    if (!job.isCurrent()) return
    if (
      offered.printings &&
      offered.printings.length > 1 &&
      offered.printings.every(
        (printing) =>
          printing.finish &&
          printing.setName &&
          printing.scryfallUri &&
          (offered.faces.length < 2 || printing.backImage),
      )
    )
      continue
    await new Promise((resolve) => setTimeout(resolve, 100))
    let result: ScryfallCard[]
    try {
      result = await fetchPrintings(offered.printsUri)
    } catch (error) {
      // Printing enrichment is optional; keep existing suggestions during the cooldown.
      if (error instanceof ScryfallRateLimitError) return
      throw error
    }
    if (!job.isCurrent()) return
    if (!result.length) continue
    const printings = buildPrintings(offered, result)
    const selectedIndex = selectedPrintingIndex(
      offered,
      printings,
      preferredSet,
      selectedCollectionSets,
      selectedCollectionMode,
      deps.maxPrice,
    )
    updateQueuedCard(deps, offered, printings, selectedIndex)
  }
}
