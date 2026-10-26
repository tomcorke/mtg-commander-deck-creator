import { refreshCardData } from '../domain/current-card-data.ts'
import { builderAction, type BuilderActionHost } from './builder-action.ts'
import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import { fetchScryfallCardsByIdentifiers } from '../adapters/scryfall.ts'
import { ProviderRequestError } from '../adapters/request-scheduler.ts'
import { edhrecSlug } from '../domain/card-model.ts'
import type { PlannedFetch, FetchResponse } from '../domain/builder-fetches.ts'

export function resetSignatureContext(
  deps: Record<string, any> & BuilderActionHost,
  deckKey?: string,
) {
  deps.setSignatureEpoch?.((epoch: number) => epoch + 1)
  builderAction(deps, (state) => ({
    type: 'data',
    changes: {
      fetchEpoch: state.fetchEpoch + 1,
      ...(deckKey ? { signatureDeckKey: deckKey } : {}),
    },
  }))
}

/** One transport attempt per reservation; retries are decisions at a later boundary. */
export async function executeSignatureFetch(
  work: PlannedFetch,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<FetchResponse> {
  const request = work.request
  try {
    if (request.kind === 'current-data') {
      const results = await refreshCardData(request.cards, signal, fetcher, true)
      return { outcome: results.size ? 'success' : 'success-empty', hydration: [...results] }
    }
    if (request.kind === 'signature-page') {
      const page = await fetchEdhrecPage(
        request.seed.page,
        edhrecSlug(undefined, request.seed.card.name),
        fetcher,
        signal,
        { background: true },
      )
      return {
        outcome: page.container.json_dict.cardlists.some((list) => list.cardviews.length)
          ? 'success'
          : 'success-empty',
        page,
      }
    }
    const cards = await fetchScryfallCardsByIdentifiers(
      request.names.map((name) => ({ name })),
      fetcher,
      signal,
      { background: true },
    )
    return {
      outcome: !cards.length
        ? 'success-empty'
        : cards.length < request.names.length
          ? 'partial'
          : 'success',
      cards,
    }
  } catch (error) {
    return { outcome: transportFailure(error, signal) }
  }
}

function transportFailure(error: unknown, signal: AbortSignal): FetchResponse['outcome'] {
  if (signal.aborted) return 'cancelled'
  if (error instanceof ProviderRequestError)
    return error.transient ? 'transient-failure' : 'permanent-failure'
  return 'invalid'
}
