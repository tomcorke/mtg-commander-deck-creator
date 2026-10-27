import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { executeSignatureFetch } from '../../src/app/signature-actions.ts'
import type { PlannedFetch } from '../../src/domain/builder-fetches.ts'
import type { Outcome, Pins, ReplayResult, Request } from './data.ts'

const responseSchema = z.strictObject({
  status: z.number().int().min(200).max(599),
  headers: z.array(z.tuple([z.string(), z.string()])),
  body: z.string(),
})
export type RequestStore = (request: Request, signal: AbortSignal) => Promise<ReplayResult>

/** Record only approved JSON endpoints. Redirects and image requests never leave this transport. */
export function transportRequest(
  input: string | URL | globalThis.Request,
  init: RequestInit | undefined,
  pins: Pins,
): Request {
  const url = new URL(String(input))
  const method = init?.method ?? 'GET'
  if (!(
    (url.origin === 'https://api.scryfall.com' &&
      url.pathname === '/cards/collection' &&
      method === 'POST') ||
    (url.origin === 'https://json.edhrec.com' &&
      /^\/pages\/(cards|commanders)\/[a-z0-9-]+\.json$/.test(url.pathname) &&
      method === 'GET')
  ))
    throw new Error('Unsupported deckbuild transport endpoint')
  return {
    provider: url.hostname,
    endpoint: `${url.origin}${url.pathname}`,
    method,
    query: {
      parameters: [...url.searchParams],
      headers: [
        ...new Headers({
          ...Object.fromEntries(new Headers(init?.headers)),
          'User-Agent':
            'CommanderCreator-Deckbuild/1.0 (https://github.com/tomcorke/mtg-commander-deck-creator)',
        }),
      ].sort(),
      redirect: 'error',
    },
    body: init?.body ? String(init.body) : null,
    ordering: null,
    pagination: null,
    today: pins.today,
    snapshotId: pins.snapshotId,
  }
}

/** One serial request per occurrence; pacing is shared across fresh per-work adapter clients. */
export function liveProvider(fetcher: typeof fetch = fetch) {
  let lastDispatch = 0
  let cooldown = 0
  return async (request: Request, signal: AbortSignal): Promise<Outcome> => {
    try {
      await delay(Math.max(0, lastDispatch + 1000 - Date.now(), cooldown - Date.now()), undefined, {
        signal,
      })
      lastDispatch = Date.now()
      const query = request.query as { parameters: [string, string][]; headers: [string, string][] }
      const url = new URL(request.endpoint)
      for (const [key, value] of query.parameters) url.searchParams.append(key, value)
      const response = await fetcher(url, {
        method: request.method,
        headers: query.headers,
        body: request.body as string | null,
        redirect: 'error',
        signal,
      })
      const body = await response.text()
      const retry = response.headers.get('retry-after')
      if (response.status === 429 || retry) {
        const seconds = retry === null ? NaN : Number(retry)
        const until = Number.isFinite(seconds)
          ? Date.now() + seconds * 1000
          : Date.parse(retry ?? '')
        cooldown = Math.max(cooldown, Number.isFinite(until) ? until : Date.now() + 30000)
      }
      return {
        status: 'success',
        value: { status: response.status, headers: [...response.headers], body },
      }
    } catch {
      return {
        status: 'failure',
        kind: signal.aborted ? 'cancelled' : 'network',
        detail: 'Transport unavailable',
      }
    }
  }
}

export class StoreError extends Error {}

export async function executeStoredFetch(
  work: PlannedFetch,
  pins: Pins,
  request: RequestStore,
  signal: AbortSignal,
) {
  // Fresh identity prevents adapter caches/cooldowns from skipping recorded occurrences or depending on wall time.
  let stop: ReplayResult | undefined
  let storeError: unknown
  let cancelled = false
  const pending: Promise<ReplayResult>[] = []
  const fetcher: typeof fetch = async (input, init) => {
    let result: ReplayResult
    try {
      const operation = request(
        transportRequest(input, init, pins),
        AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
      )
      pending.push(operation)
      result = await operation
    } catch (error) {
      if (!signal.aborted) storeError = error
      throw error
    }
    if (result.status === 'incomplete') {
      stop = result
      throw new Error('Replay incomplete')
    }
    if (result.outcome.status === 'failure') {
      cancelled ||= result.outcome.kind === 'cancelled'
      throw new TypeError('Recorded transport failure')
    }
    try {
      const value = responseSchema.parse(result.outcome.value)
      return new Response([204, 205, 304].includes(value.status) ? null : value.body, {
        status: value.status,
        headers: value.headers,
      })
    } catch (error) {
      storeError = error
      throw error
    }
  }
  const response = await executeSignatureFetch(work, signal, fetcher)
  // A subscriber may abort before its transport finishes recording. Join it before sealing the store.
  await Promise.allSettled(pending)
  if (storeError) throw new StoreError(String(storeError))
  return stop?.status === 'incomplete'
    ? { status: 'incomplete' as const, detail: stop }
    : {
        status: 'complete' as const,
        response: cancelled ? { outcome: 'transient-failure' as const } : response,
      }
}
