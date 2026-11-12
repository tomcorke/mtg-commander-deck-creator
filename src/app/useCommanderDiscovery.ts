import { useEffect, useState } from 'react'
import {
  discoverCommanders,
  type CommanderDiscovery,
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
