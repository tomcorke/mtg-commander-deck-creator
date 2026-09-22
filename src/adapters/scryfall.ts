import type { ScryfallCard, ScryfallSet } from '../domain/card-model'

export type ScryfallIdentifier = { name?: string; set?: string; collector_number?: string }
export type ScryfallFetcher = typeof fetch
export type CollectionFilters = {
  excludeGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
}

type CardListResponse = {
  data: ScryfallCard[]
  has_more?: boolean
  next_page?: string
}

const collectionResponse = (response: Response) =>
  response.ok || (response.status !== 429 && response.status < 500)

export async function fetchScryfallCollection(
  identifiers: ScryfallIdentifier[],
  fetcher: ScryfallFetcher = fetch,
  pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetcher('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      })
      if (collectionResponse(response)) return response
    } catch (error) {
      if (attempt === 2) throw error
    }
    if (attempt < 2) await pause(500 * 2 ** attempt)
  }
  throw new Error('Scryfall unavailable')
}

export async function fetchScryfallCard<T extends ScryfallCard = ScryfallCard>(
  name: string,
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
) {
  const response = await fetcher(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
    { signal },
  )
  if (!response.ok) throw new Error('Scryfall card unavailable')
  return (await response.json()) as T
}

export async function fetchScryfallCardsByIdentifiers(
  identifiers: ScryfallIdentifier[],
  fetcher: ScryfallFetcher = fetch,
) {
  const response = await fetchScryfallCollection(identifiers, fetcher)
  if (!response.ok) throw new Error('Scryfall unavailable')
  return ((await response.json()) as CardListResponse).data
}

export async function fetchScryfallPrintings(uri: string, fetcher: ScryfallFetcher = fetch) {
  const response = await fetcher(uri)
  if (!response.ok) return []
  return ((await response.json()) as CardListResponse).data
}

export async function searchScryfall(
  query: string,
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
  order?: string,
) {
  const response = await fetcher(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards${order ? `&order=${order}` : ''}`,
    { signal },
  )
  if (response.status === 404) return []
  if (!response.ok) throw new Error('Scryfall unavailable')
  return ((await response.json()) as CardListResponse).data
}

export async function fetchScryfallSets(fetcher: ScryfallFetcher = fetch) {
  const response = await fetcher('https://api.scryfall.com/sets')
  if (!response.ok) throw new Error('Scryfall sets unavailable')
  const result = (await response.json()) as { data: ScryfallSet[] }
  return result.data
    .filter((set) => set.set_type !== 'token' && set.set_type !== 'memorabilia')
    .sort((left, right) => (right.released_at ?? '').localeCompare(left.released_at ?? ''))
}

export async function fetchScryfallCollectionCards(
  identityColours: string[],
  selectedSets: string[],
  filters: CollectionFilters,
  fetcher: ScryfallFetcher = fetch,
) {
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    filters.excludeGameChangers && '-is:gamechanger',
    filters.excludeTutors && '-otag:tutor',
    filters.excludeExtraTurns && '-otag:extra-turn',
    filters.excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const setQuery = selectedSets.map((code) => `set:${code}`).join(' or ')
  const query = `id<=${identity} legal:commander -is:commander (${setQuery}) ${bracketFilters}`
  const cards: ScryfallCard[] = []
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=set`

  while (url) {
    const response = await fetcher(url)
    if (!response.ok) {
      if (response.status === 404 && !cards.length) return []
      throw new Error('Scryfall unavailable')
    }
    const result = (await response.json()) as CardListResponse
    cards.push(...result.data)
    url = result.has_more && result.next_page ? result.next_page : ''
  }

  return cards.filter(
    (card, index, all) => all.findIndex((item) => item.name === card.name) === index,
  )
}
