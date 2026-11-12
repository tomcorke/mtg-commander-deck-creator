import { useEffect, useState } from 'react'
import type { ScryfallCard } from '../domain/card-model.ts'
import {
  discoverCommanders,
  discoverPartners,
  type CommanderDiscovery,
  type CommanderMatches,
  type DiscoveryFilters,
} from '../domain/commander-discovery.ts'
import { pageWindow } from '../shared/pagination.ts'

export const commanderPageSize = 12

const emptyDiscovery: CommanderDiscovery = { commanders: [], more: false }

export function useCommanderDiscovery(filters: DiscoveryFilters, active: boolean) {
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
  const { start, end } = pageWindow(found.commanders.length, commanderPageSize, page)
  const broader = found.broader
  const broaderWindow = pageWindow(broader?.commanders.length ?? 0, commanderPageSize, broaderPage)
  return {
    suggestions: found.commanders.slice(start, end),
    count: found.commanders.length,
    more: found.more,
    page,
    setPage,
    /** A curated theme's separately labelled rules-text matches, paged on their own. */
    broader: broader && {
      heading: broader.heading,
      suggestions: broader.commanders.slice(broaderWindow.start, broaderWindow.end),
      count: broader.commanders.length,
      more: broader.more,
      page: broaderPage,
      setPage: setBroaderPage,
    },
    status,
    error,
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
