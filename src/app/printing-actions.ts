import { withinPriceCap } from '../domain/recommendation-tuning.ts'
import { rolesForCard } from '../deck-analysis.ts'
import { ScryfallRateLimitError } from '../adapters/scryfall.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import {
  orderedPrintings,
  preferredPrintingIndex,
  recommendationScore,
} from '../recommendations.ts'
import { scryfallBackImage, type Card, type ScryfallCard } from '../domain/card-model.ts'
import { recommendedScoreThreshold, type CollectionMode } from '../recommendations.ts'
import type { ActionDeps } from './recommendation-actions.ts'

function scoringContext(
  deps: ActionDeps,
  cards: Card[],
  selectedCollectionSets: string[],
  selectedCollectionMode: CollectionMode,
) {
  const context = buildRecommendationContext(
    { ...deps, collectionSets: selectedCollectionSets, collectionMode: selectedCollectionMode },
    deps.queue,
  )
  const score = (card: Card) =>
    recommendationScore(card, { ...context, cardRoles: rolesForCard(card) })
  const specialCards = new Set(
    [0, 4].flatMap((start) => {
      const recommended = cards
        .slice(start, start + 4)
        .reduce<Card | null>(
          (best, card) => (!best || score(card) > score(best) ? card : best),
          null,
        )
      return recommended && score(recommended) >= recommendedScoreThreshold && Math.random() < 0.5
        ? [recommended]
        : []
    }),
  )
  return { specialCards }
}

function buildPrintings(card: Card, result: ScryfallCard[]) {
  return orderedPrintings(
    card,
    result.flatMap((printing) => {
      const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
      return image
        ? (printing.finishes ?? ['nonfoil']).map((finish) => ({
            image,
            backImage: scryfallBackImage(printing),
            set: printing.set,
            setName: printing.set_name,
            collectorNumber: printing.collector_number,
            scryfallUri: printing.scryfall_uri,
            price:
              (finish === 'etched'
                ? printing.prices?.usd_etched
                : finish === 'foil'
                  ? printing.prices?.usd_foil
                  : printing.prices?.usd) ?? undefined,
            priceUri: printing.purchase_uris?.tcgplayer,
            finish,
          }))
        : []
    }),
  )
}

function selectedPrintingIndex(
  card: Card,
  printings: any[],
  specialCards: Set<Card>,
  preferredSet: string,
  selectedCollectionSets: string[],
  selectedCollectionMode: CollectionMode,
  maxPrice?: number | null,
) {
  if (!printings.length) return -1
  const specialOptions = printings
    .map((printing, index) =>
      (printing.finish === 'foil' || printing.finish === 'etched') &&
      withinPriceCap(printing, maxPrice)
        ? index
        : -1,
    )
    .filter((index) => index >= 0)
  const special =
    specialCards.has(card) && specialOptions.length
      ? specialOptions[Math.floor(Math.random() * specialOptions.length)]
      : -1
  const collectionPrinting =
    !card.printingManuallySelected &&
    selectedCollectionMode !== 'none' &&
    selectedCollectionSets.length
      ? printings.findIndex(
          (printing) =>
            selectedCollectionSets.includes(printing.set) && withinPriceCap(printing, maxPrice),
        )
      : -1
  if (special >= 0) return special
  if (collectionPrinting >= 0) return collectionPrinting
  const preferred = preferredPrintingIndex(printings, preferredSet)
  return withinPriceCap(printings[preferred], maxPrice)
    ? preferred
    : printings.findIndex((printing) => withinPriceCap(printing, maxPrice))
}

function updateQueuedCard(
  deps: ActionDeps,
  offered: Card,
  printings: any[],
  selectedIndex: number,
) {
  const { setQueue } = deps
  const selected = printings[selectedIndex]
  if (!selected) return
  setQueue((current: Card[]) =>
    current.map((item) =>
      item.name === offered.name && !item.printingManuallySelected
        ? {
            ...item,
            printings,
            image: selected.image,
            backImage: selected.backImage,
            set: selected.set,
            setName: selected.setName,
            collectorNumber: selected.collectorNumber,
            scryfallUri: selected.scryfallUri,
            price: selected.price,
            priceUri: selected.priceUri,
            finish: selected.finish,
            printing: selectedIndex,
          }
        : item,
    ),
  )
}

export async function loadPrintings(
  deps: ActionDeps,
  cards: Card[],
  preferredSet = '',
  selectedCollectionSets: string[] = deps.collectionSets,
  selectedCollectionMode: CollectionMode = deps.collectionMode,
) {
  const { fetchPrintings } = deps
  const { specialCards } = scoringContext(
    deps,
    cards,
    selectedCollectionSets,
    selectedCollectionMode,
  )
  for (const offered of cards.slice(0, 8)) {
    if (
      offered.printings?.length &&
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
    if (!result.length) continue
    const printings = buildPrintings(offered, result)
    const selectedIndex = selectedPrintingIndex(
      offered,
      printings,
      specialCards,
      preferredSet,
      selectedCollectionSets,
      selectedCollectionMode,
      deps.maxPrice,
    )
    updateQueuedCard(deps, offered, printings, selectedIndex)
  }
}
