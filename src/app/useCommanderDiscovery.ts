import { useEffect, useState } from 'react'
import {
  discoverCommanders,
  type CommanderSuggestion,
  type DiscoveryFilters,
} from '../domain/commander-discovery.ts'
import { pageWindow } from '../shared/pagination.ts'

export const commanderPageSize = 12

export function useCommanderDiscovery(filters: DiscoveryFilters, active: boolean) {
  const [pool, setPool] = useState<CommanderSuggestion[]>([])
  const [more, setMore] = useState(false)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [error, setError] = useState('')
  const identity = [...filters.colours].sort().join('')
  const search = filters.search.trim().length >= 2 ? filters.search.trim() : ''
  const creatureTypes = filters.creatureTypes ?? []
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setStatus('loading')
    setPool([])
    setMore(false)
    setPage(0)
    setError('')
    const timer = setTimeout(
      () => {
        void discoverCommanders(
          { theme: filters.theme, colours: [...identity], search, creatureTypes },
          controller.signal,
        )
          .then((found) => {
            if (controller.signal.aborted) return
            setPool(found.commanders)
            setMore(found.more)
            setStatus('idle')
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return
            setStatus('error')
            setError(error instanceof Error ? error.message : 'Commander suggestions unavailable.')
          })
      },
      search ? 250 : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, filters.theme, identity, search, creatureTypes.join('|')])
  const { start, end } = pageWindow(pool.length, commanderPageSize, page)
  return {
    suggestions: pool.slice(start, end),
    count: pool.length,
    more,
    page,
    setPage,
    status,
    error,
  }
}
