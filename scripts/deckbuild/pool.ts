import { fetchDeckDoctorCandidates } from '../../src/app/recommendation-actions.ts'
import type { AppActionContext } from '../../src/app/builder-action.ts'
import { applyBuilderAction, type BuilderState } from '../../src/domain/builder-state.ts'
import { builderPoolKey } from '../../src/domain/builder-settings.ts'
import { fetchEdhrecPage } from '../../src/adapters/edhrec.ts'
import {
  fetchScryfallCardsByIdentifiers,
  fetchScryfallCollectionCards,
  searchScryfall,
} from '../../src/adapters/scryfall.ts'
import type { Pins } from './data.ts'
import { executeStoredOperation, type RequestStore } from './provider.ts'
import { initialStateSchema } from './builder-contract.ts'

/** Reuse the app's complete live candidate loader; local browser-index data is deliberately absent. */
export async function retrieveStoredPool(
  initial: BuilderState,
  pins: Pins,
  request: RequestStore,
  signal: AbortSignal,
) {
  let state = initial
  let requests = 0
  let limited = false
  const result = await executeStoredOperation(pins, request, signal, async (transport) => {
    const fetcher: typeof fetch = (input, init) => {
      if (++requests > 100 || signal.aborted) {
        limited = true
        throw new Error('Pool retrieval limit')
      }
      return transport(input, init)
    }
    const noop = () => {}
    const deps: AppActionContext = {
      ...state,
      builderState: state,
      getBuilderState: () => state,
      dispatchBuilder: (action) => {
        const applied = applyBuilderAction(state, action)
        state = applied.state
        return applied
      },
      setLimitedRecommendations: noop,
      setCollectionState: noop,
      setCollectionError: noop,
      setCollectionPoolSize: noop,
      fetchCard: async (name: string) => {
        const cards = await fetchScryfallCardsByIdentifiers([{ name }], fetcher, signal)
        const card = cards.find((card) => card.name === name)
        if (!card) throw new Error(`Missing pool commander: ${name}`)
        return card
      },
      fetchCards: (identifiers: { name: string }[]) =>
        fetchScryfallCardsByIdentifiers(identifiers, fetcher, signal),
      fetchEdhrec: (slug: string) => fetchEdhrecPage('commanders', slug, fetcher, signal),
      searchCards: (query: string, _: unknown, order: string, pages = 1) =>
        searchScryfall(query, fetcher, signal, order, pages),
      fetchCollection: (
        ...args: [
          Parameters<typeof fetchScryfallCollectionCards>[0],
          Parameters<typeof fetchScryfallCollectionCards>[1],
          Parameters<typeof fetchScryfallCollectionCards>[2],
        ]
      ) => fetchScryfallCollectionCards(...args, fetcher),
    }
    const pool = await fetchDeckDoctorCandidates(deps)
    return { outcome: 'success' as const, pool }
  })
  if (signal.aborted || limited)
    return { status: 'limit' as const, detail: signal.aborted ? 'runtime' : 'pool-requests' }
  if (result.status === 'incomplete') return result
  if (!('pool' in result.response)) return { status: 'invalid' as const, detail: result.response }
  return {
    status: 'ready' as const,
    state: applyBuilderAction(state, {
      type: 'poolLoaded',
      queue: initialStateSchema.shape.queue.parse(result.response.pool),
      deferredCards: state.deferredCards,
      poolKey: builderPoolKey(state),
    }).state,
  }
}
