import { useEffect, useState } from 'react'
import {
  discoverCommanders,
  shuffleCommanders,
  type CommanderSuggestion,
  type DiscoveryFilters,
} from '../domain/commander-discovery.ts'

export function useCommanderDiscovery(filters: DiscoveryFilters, active: boolean) {
  const [pool, setPool] = useState<CommanderSuggestion[]>([])
  const [suggestions, setSuggestions] = useState<CommanderSuggestion[]>([])
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [error, setError] = useState('')
  const identity = [...filters.colours].sort().join('')
  const search = filters.search.trim().length >= 2 ? filters.search.trim() : ''
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setStatus('loading')
    setSuggestions([])
    setError('')
    const timer = setTimeout(
      () => {
        void discoverCommanders(
          { theme: filters.theme, colours: [...identity], search },
          controller.signal,
        )
          .then((cards) => {
            if (controller.signal.aborted) return
            setPool(cards)
            setSuggestions(shuffleCommanders(cards))
            setStatus('idle')
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return
            setPool([])
            setSuggestions([])
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
  }, [active, filters.theme, identity, search])
  return { suggestions, status, error, reshuffle: () => setSuggestions(shuffleCommanders(pool)) }
}
