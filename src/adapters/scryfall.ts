import type { ScryfallCard, ScryfallSet } from '../domain/card-model'

export type ScryfallIdentifier = { name?: string; set?: string; collector_number?: string }
export type ScryfallFetcher = typeof fetch
export type CollectionFilters = {
  excludeGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
}

export type CardListResponse = {
  data: ScryfallCard[]
  has_more?: boolean
  next_page?: string
  total_cards?: number
  warnings?: string[]
}

export class ScryfallRateLimitError extends Error {
  readonly retryAt: number
  readonly estimated: boolean

  constructor(retryAt: number, estimated: boolean) {
    const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
    const unit = seconds >= 60 ? 'minute' : 'second'
    const divisor = unit === 'minute' ? 60 : 1
    const wait = new Intl.RelativeTimeFormat('en', { numeric: 'always' }).format(
      Math.ceil(seconds / divisor),
      unit,
    )
    super(
      `Scryfall rate limit reached (HTTP 429). ${
        seconds
          ? `Try again ${wait} (after ${new Date(retryAt).toLocaleString()}).`
          : 'Try again now.'
      }${estimated ? ' No usable retry time was exposed; this wait is an estimate.' : ''}`,
    )
    this.name = 'ScryfallRateLimitError'
    this.retryAt = retryAt
    this.estimated = estimated
  }
}

function rateLimitError(response: Response) {
  const value = response.headers.get('Retry-After')?.trim() ?? ''
  const serverDate = Date.parse(response.headers.get('Date') ?? '')
  const reference = Number.isFinite(serverDate) ? serverDate : Date.now()
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : /[a-z]/i.test(value)
      ? (Date.parse(value) - reference) / 1000
      : NaN
  const retryAt = Date.now() + Math.max(0, seconds) * 1000
  const estimated = !Number.isFinite(retryAt) || Number.isNaN(new Date(retryAt).getTime())
  // ponytail: one-minute estimate when headers are missing/hidden; server advice takes precedence.
  return new ScryfallRateLimitError(estimated ? Date.now() + 60_000 : retryAt, estimated)
}

// ponytail: cooldown is per client/tab; use BroadcastChannel if multi-tab coordination becomes necessary.
const rateLimits = new WeakMap<ScryfallFetcher, ScryfallRateLimitError>()

async function requestScryfall(input: string, fetcher: ScryfallFetcher, init?: RequestInit) {
  init?.signal?.throwIfAborted()
  const cooldown = rateLimits.get(fetcher)
  if (cooldown && cooldown.retryAt > Date.now())
    throw new ScryfallRateLimitError(cooldown.retryAt, cooldown.estimated)
  const response = await fetcher(input, init)
  if (response.status === 429) {
    const error = rateLimitError(response)
    const previous = rateLimits.get(fetcher)
    const limit = !previous || error.retryAt >= previous.retryAt ? error : previous
    rateLimits.set(fetcher, limit)
    throw new ScryfallRateLimitError(limit.retryAt, limit.estimated)
  }
  return response
}

const collectionResponse = (response: Response) => response.ok || response.status < 500

export async function fetchScryfallCollection(
  identifiers: ScryfallIdentifier[],
  fetcher: ScryfallFetcher = fetch,
  pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await requestScryfall('https://api.scryfall.com/cards/collection', fetcher, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      })
      if (collectionResponse(response)) return response
    } catch (error) {
      if (error instanceof ScryfallRateLimitError || attempt === 2) throw error
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
  const response = await requestScryfall(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
    fetcher,
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

export async function fetchScryfallPrintings(
  uri: string,
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
) {
  const response = await requestScryfall(uri, fetcher, { signal })
  if (!response.ok) return []
  return ((await response.json()) as CardListResponse).data
}

export async function searchScryfall(
  query: string,
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
  order?: string,
) {
  return (await searchScryfallPage(query, fetcher, signal, order)).data
}

export async function searchScryfallPage(
  query: string,
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
  order = 'name',
  page = 1,
): Promise<CardListResponse> {
  const params = new URLSearchParams({ q: query, unique: 'cards', order, page: String(page) })
  const response = await requestScryfall(
    `https://api.scryfall.com/cards/search?${params}`,
    fetcher,
    { signal },
  )
  if (response.status === 404) return { data: [], total_cards: 0, has_more: false }
  if (!response.ok) throw new Error('Scryfall unavailable. Try again.')
  return (await response.json()) as CardListResponse
}

export async function fetchScryfallSets(fetcher: ScryfallFetcher = fetch) {
  const response = await requestScryfall('https://api.scryfall.com/sets', fetcher)
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
    const response = await requestScryfall(url, fetcher)
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
