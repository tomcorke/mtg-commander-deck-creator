import { useEffect, useState } from 'react'
import type { ScryfallCard } from '../domain/card-model.ts'
import {
  discoverCommanders,
  discoverPartners,
  orderByDeckCount,
  type CommanderDiscovery,
  type CommanderMatches,
  type CommanderSort,
  type CommanderSuggestion,
  type DiscoveryFilters,
} from '../domain/commander-discovery.ts'
import { pageWindow } from '../shared/pagination.ts'
import { useEdhrecDeckCounts } from './useEdhrecDeckCounts.ts'

export const commanderPageSize = 12

const emptyDiscovery: CommanderDiscovery = { commanders: [], more: false }

/**
 * Commander suggestions for `filters`, paged. With `deckCounts`, tiles get EDHREC deck counts, and
 * the popularity sort orders by them (#514): it reads every loaded commander's identity page, then
 * reorders once when all have settled, so tiles move at most once.
 */
export function useCommanderDiscovery(
  filters: DiscoveryFilters,
  active: boolean,
  deckCounts = false,
) {
  const [found, setFound] = useState(emptyDiscovery)
  const [page, setPage] = useState(0)
  const [broaderPage, setBroaderPage] = useState(0)
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [error, setError] = useState('')
  const identity = [...filters.colours].sort().join('')
  const colourMatch = filters.colourMatch ?? 'exactly'
  const search = filters.search.trim().length >= 2 ? filters.search.trim() : ''
  const creatureTypes = filters.creatureTypes ?? []
  const rulesText = (filters.rulesText ?? '').trim().length >= 2 ? filters.rulesText!.trim() : ''
  const maxManaValue = filters.maxManaValue ?? null
  const sets = (filters.sets ?? []).join('|')
  const sort = filters.sort
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setStatus('loading')
    setFound(emptyDiscovery)
    setPage(0)
    setBroaderPage(0)
    setError('')
    const timer = setTimeout(
      () => {
        void discoverCommanders(
          {
            theme: filters.theme,
            colours: [...identity],
            colourMatch,
            search,
            creatureTypes,
            rulesText,
            maxManaValue,
            sets: sets ? sets.split('|') : [],
            sort,
          },
          controller.signal,
        )
          .then((discovery) => {
            if (controller.signal.aborted) return
            setFound(discovery)
            setStatus('idle')
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return
            setStatus('error')
            setError(error instanceof Error ? error.message : 'Commander suggestions unavailable.')
          })
      },
      search || rulesText ? 250 : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [
    active,
    filters.theme,
    identity,
    colourMatch,
    search,
    creatureTypes.join('|'),
    rulesText,
    maxManaValue,
    sets,
    sort,
  ])
  const broader = found.broader
  const shown = useShownCommanders(deckCounts ? (sort ?? null) : undefined, found, status, [
    page,
    broaderPage,
  ])
  return {
    suggestions: shown.suggestions,
    count: found.commanders.length,
    more: found.more,
    page,
    setPage,
    /** A curated theme's separately labelled rules-text matches, paged on their own. */
    broader: broader && {
      heading: broader.heading,
      suggestions: shown.broader,
      count: broader.commanders.length,
      more: broader.more,
      page: broaderPage,
      setPage: setBroaderPage,
    },
    status,
    error,
    deckCount: shown.deckCount,
    /**
     * For the popularity sort: `rank` while identity pages load (Scryfall's EDHREC rank order),
     * then `decks` once suggestions follow deck counts.
     */
    popularity: shown.ranked ? ('decks' as const) : ('rank' as const),
  }
}

/**
 * The shown page of each section, with deck counts for their tiles; `sort` is undefined when tiles
 * show none. The popularity sort reads every loaded commander's identity page and reorders once all
 * have settled (#514); other sorts never reorder, so they read only the shown pages' identities.
 */
function useShownCommanders(
  sort: CommanderSort | null | undefined,
  found: CommanderDiscovery,
  status: 'loading' | 'idle' | 'error',
  [page, broaderPage]: [number, number],
) {
  const pageOf = (commanders: CommanderSuggestion[], at: number) => {
    const { start, end } = pageWindow(commanders.length, commanderPageSize, at)
    return commanders.slice(start, end)
  }
  const byDeckCount = sort === 'popularity'
  const broader = found.broader?.commanders ?? []
  const counted =
    sort === undefined
      ? []
      : byDeckCount
        ? [...found.commanders, ...broader]
        : [...pageOf(found.commanders, page), ...pageOf(broader, broaderPage)]
  const { deckCount, pending } = useEdhrecDeckCounts(counted.map(({ card }) => card))
  const ranked = byDeckCount && status === 'idle' && !pending
  const order = (commanders: CommanderSuggestion[]) =>
    ranked ? orderByDeckCount(commanders, deckCount) : commanders
  return {
    suggestions: pageOf(order(found.commanders), page),
    broader: pageOf(order(broader), broaderPage),
    deckCount,
    ranked,
  }
}

/** Legal second commanders for `first`, paged like commander discovery; idle without a card. */
export function usePartnerDiscovery(first: ScryfallCard | null) {
  const [found, setFound] = useState<CommanderMatches>({ commanders: [], more: false })
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!first) return
    const controller = new AbortController()
    setStatus('loading')
    setFound({ commanders: [], more: false })
    setPage(0)
    setError('')
    discoverPartners(first, controller.signal)
      .then((partners) => {
        if (controller.signal.aborted) return
        setFound(partners)
        setStatus('idle')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setStatus('error')
        setError(reason instanceof Error ? reason.message : 'Partner suggestions unavailable.')
      })
    return () => controller.abort()
  }, [first])
  const { start, end } = pageWindow(found.commanders.length, commanderPageSize, page)
  return {
    suggestions: found.commanders.slice(start, end),
    all: found.commanders,
    count: found.commanders.length,
    more: found.more,
    page,
    setPage,
    status,
    error,
  }
}
