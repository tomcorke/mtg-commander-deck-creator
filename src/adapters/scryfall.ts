import type { ScryfallCard, ScryfallSet } from '../domain/card-model'

export type ScryfallIdentifier = { name?: string; set?: string; collector_number?: string }
export type ScryfallFetcher = typeof fetch
export type CollectionFilters = {
  excludeGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
}

export type CardCollectionResponse = {
  data: ScryfallCard[]
  not_found?: ScryfallIdentifier[]
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

type CacheValue = ScryfallCard | ScryfallCard[]
type RequestJob = { controller: AbortController; users: number; settled: boolean }
type PendingValue = { job: RequestJob; promise: Promise<CacheValue | undefined> }
type SessionCache = {
  values: Map<string, { value: CacheValue; expiresAt: number }>
  pending: Map<string, PendingValue>
}

export const scryfallCacheLifetime = 15 * 60_000
const sessions = new WeakMap<ScryfallFetcher, SessionCache>()

// Clearing data does not clear the provider cooldown or interrupt existing consumers.
export function clearScryfallCache(fetcher: ScryfallFetcher = fetch) {
  sessions.delete(fetcher)
}

function sessionCache(fetcher: ScryfallFetcher) {
  let cache = sessions.get(fetcher)
  if (!cache) {
    cache = { values: new Map(), pending: new Map() }
    sessions.set(fetcher, cache)
  }
  return cache
}

const identifierKey = ({ name, set, collector_number }: ScryfallIdentifier) =>
  set && collector_number
    ? `printing:${set.toLowerCase()}:${collector_number}`
    : `name:${name?.trim().toLowerCase()}`

function cachedValue(cache: SessionCache, key: string) {
  const entry = cache.values.get(key)
  if (entry && entry.expiresAt > Date.now()) return entry.value
  cache.values.delete(key)
}

function rememberValue(cache: SessionCache, key: string, value: CacheValue) {
  cache.values.delete(key)
  cache.values.set(key, {
    value: structuredClone(value),
    expiresAt: Date.now() + scryfallCacheLifetime,
  })
  // ponytail: cap at 2,000 session entries; use a byte budget if printing lists grow too large.
  if (cache.values.size > 2_000) cache.values.delete(cache.values.keys().next().value!)
}

function rememberPrintings(cache: SessionCache, cards: ScryfallCard[]) {
  for (const card of cards)
    if (card.set && card.collector_number) rememberValue(cache, identifierKey(card), card)
}

function rememberResult(cache: SessionCache, key: string, value: CacheValue) {
  rememberValue(cache, key, value)
  rememberPrintings(cache, Array.isArray(value) ? value : [value])
  if (key.startsWith('name:') && !Array.isArray(value))
    rememberValue(cache, identifierKey({ name: value.name }), value)
}

function registerPending(
  cache: SessionCache,
  key: string,
  job: RequestJob,
  result: Promise<CacheValue | undefined>,
) {
  const pending: PendingValue = {
    job,
    promise: result.then(
      (value) => {
        job.settled = true
        if (cache.pending.get(key) !== pending) return value
        cache.pending.delete(key)
        if (value !== undefined && !job.controller.signal.aborted) rememberResult(cache, key, value)
        return value
      },
      (error) => {
        job.settled = true
        if (cache.pending.get(key) === pending) cache.pending.delete(key)
        throw error
      },
    ),
  }
  cache.pending.set(key, pending)
  return pending
}

function waitForValue(cache: SessionCache, pending: PendingValue, signal?: AbortSignal) {
  const { job } = pending
  job.users++
  return new Promise<CacheValue | undefined>((resolve, reject) => {
    let released = false
    const release = () => {
      if (released) return
      released = true
      signal?.removeEventListener('abort', abort)
      if (--job.users === 0 && !job.settled) {
        job.controller.abort()
        for (const [key, value] of cache.pending) if (value.job === job) cache.pending.delete(key)
      }
    }
    const abort = () => {
      release()
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', abort, { once: true })
    pending.promise.then(
      (value) => {
        release()
        resolve(structuredClone(value))
      },
      (error) => {
        release()
        reject(error)
      },
    )
    if (signal?.aborted) abort()
  })
}

function cachedRequest(
  cache: SessionCache,
  key: string,
  load: (signal: AbortSignal) => Promise<CacheValue | undefined>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  const value = cachedValue(cache, key)
  if (value !== undefined) return Promise.resolve(structuredClone(value))
  let pending = cache.pending.get(key)
  if (!pending) {
    const job = { controller: new AbortController(), users: 0, settled: false }
    pending = registerPending(cache, key, job, load(job.controller.signal))
  }
  return waitForValue(cache, pending, signal)
}

const collectionResponse = (response: Response) => response.ok || response.status < 500

export async function fetchScryfallCollection(
  identifiers: ScryfallIdentifier[],
  fetcher: ScryfallFetcher = fetch,
  pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  signal?: AbortSignal,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await requestScryfall('https://api.scryfall.com/cards/collection', fetcher, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
        signal,
      })
      if (collectionResponse(response)) return response
    } catch (error) {
      if (signal?.aborted || error instanceof ScryfallRateLimitError || attempt === 2) throw error
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
  const card = await cachedRequest(
    sessionCache(fetcher),
    identifierKey({ name }),
    async (sharedSignal) => {
      const response = await requestScryfall(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
        fetcher,
        { signal: sharedSignal },
      )
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error('Scryfall card unavailable')
      return (await response.json()) as ScryfallCard
    },
    signal,
  )
  signal?.throwIfAborted()
  if (!card) throw new Error('Scryfall card unavailable')
  return card as T
}

function matchingCard(identifier: ScryfallIdentifier, cards: ScryfallCard[]) {
  const key = identifierKey(identifier)
  return cards.find((card) =>
    identifier.set && identifier.collector_number
      ? identifierKey(card) === key
      : identifierKey({ name: card.name }) === key ||
        identifierKey({ name: card.name.split(' // ')[0] }) === key,
  )
}

export async function resolveScryfallIdentifiers(
  identifiers: ScryfallIdentifier[],
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
): Promise<CardCollectionResponse> {
  signal?.throwIfAborted()
  const cache = sessionCache(fetcher)
  const unique = new Map(identifiers.map((identifier) => [identifierKey(identifier), identifier]))
  const cached = new Map([...unique.keys()].map((key) => [key, cachedValue(cache, key)]))
  const missing = [...unique].filter(
    ([key]) => cached.get(key) === undefined && !cache.pending.has(key),
  )
  let previous: Promise<unknown> = Promise.resolve()
  for (let index = 0; index < missing.length; index += 75) {
    const batch = missing.slice(index, index + 75)
    const job = { controller: new AbortController(), users: 0, settled: false }
    const result = previous.then(async () => {
      const response = await fetchScryfallCollection(
        batch.map(([, identifier]) => identifier),
        fetcher,
        undefined,
        job.controller.signal,
      )
      if (!response.ok) throw new Error('Scryfall unavailable')
      return ((await response.json()) as CardCollectionResponse).data
    })
    previous = result
    for (const [key, identifier] of batch)
      registerPending(
        cache,
        key,
        job,
        result.then((cards) => matchingCard(identifier, cards)),
      )
  }
  const cards = await Promise.all(
    [...unique].map(([key]) => {
      const value = cached.get(key)
      return value !== undefined
        ? Promise.resolve(structuredClone(value) as ScryfallCard)
        : (waitForValue(cache, cache.pending.get(key)!, signal) as Promise<
            ScryfallCard | undefined
          >)
    }),
  )
  signal?.throwIfAborted()
  return {
    data: cards.filter((card): card is ScryfallCard => card !== undefined),
    not_found: [...unique.values()].filter((_, index) => !cards[index]),
  }
}

export async function fetchScryfallCardsByIdentifiers(
  identifiers: ScryfallIdentifier[],
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
) {
  return (await resolveScryfallIdentifiers(identifiers, fetcher, signal)).data
}

export async function fetchScryfallPrintings(
  uri: string,
  fetcher: ScryfallFetcher = fetch,
  signal?: AbortSignal,
) {
  const cards = await cachedRequest(
    sessionCache(fetcher),
    `printings:${uri}`,
    async (sharedSignal) => {
      const printings: ScryfallCard[] = []
      let url = uri
      while (url) {
        const response = await requestScryfall(url, fetcher, { signal: sharedSignal })
        if (!response.ok) return undefined
        const result = (await response.json()) as CardListResponse
        printings.push(...result.data)
        url = result.has_more && result.next_page ? result.next_page : ''
      }
      return printings
    },
    signal,
  )
  signal?.throwIfAborted()
  return (cards ?? []) as ScryfallCard[]
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
  const cache = sessionCache(fetcher)
  const params = new URLSearchParams({ q: query, unique: 'cards', order, page: String(page) })
  const response = await requestScryfall(
    `https://api.scryfall.com/cards/search?${params}`,
    fetcher,
    { signal },
  )
  if (response.status === 404) return { data: [], total_cards: 0, has_more: false }
  if (!response.ok) throw new Error('Scryfall unavailable. Try again.')
  const result = (await response.json()) as CardListResponse
  signal?.throwIfAborted()
  rememberPrintings(cache, result.data)
  return result
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
  const cache = sessionCache(fetcher)
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

  rememberPrintings(cache, cards)
  return cards.filter(
    (card, index, all) => all.findIndex((item) => item.name === card.name) === index,
  )
}
