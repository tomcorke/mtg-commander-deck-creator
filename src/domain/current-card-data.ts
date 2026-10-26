import { resolveScryfallIdentifiers, type ScryfallFetcher } from '../adapters/scryfall.ts'
import { cardNameKey, type DeckCard, type ScryfallCard } from './card-model.ts'
import { cardDataKey } from './card-data.ts'
export { cardDataKey, pendingDeckData, currentCardData, applyCurrentCardData } from './card-data.ts'

export const currentDataBatchSize = 75
export const currentDataRequestLimit = 20
export async function refreshCardData(
  cards: DeckCard[],
  signal: AbortSignal,
  fetcher: ScryfallFetcher = fetch,
  failOnError = false,
) {
  const unique = [...new Map(cards.map((card) => [cardDataKey(card), card])).values()]
  const results = new Map<string, ScryfallCard>()
  // ponytail: at most 20 paced collection requests per load; oversized queues stay unverified.
  const bounded = unique.slice(0, currentDataBatchSize * currentDataRequestLimit)
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  for (let index = 0; index < bounded.length; index += currentDataBatchSize) {
    signal.throwIfAborted()
    const batch = bounded.slice(index, index + currentDataBatchSize)
    try {
      const response = await resolveScryfallIdentifiers(
        batch.map((card) => (card.oracleId ? { oracle_id: card.oracleId } : { name: card.name })),
        fetcher,
        timeout,
        { background: true },
      )
      for (const card of batch) {
        const fresh = response.data.find((candidate) =>
          card.oracleId
            ? candidate.oracle_id === card.oracleId
            : cardNameKey(candidate.name) === cardNameKey(card.name),
        )
        if (fresh) results.set(cardDataKey(card), fresh)
      }
    } catch (error) {
      signal.throwIfAborted()
      if (failOnError) throw error
      // One failure stops this load. No retry storm, and no card or recovery data is deleted.
      break
    }
  }
  signal.throwIfAborted()
  return results
}
