import type { EdhrecCommanderPage } from '../adapters/edhrec.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import { cardNameKey, isScryfallCard, type ScryfallCard } from './card-model.ts'
import { applyBuilderHydration } from './builder-data.ts'
import { cardDataKey } from './card-data.ts'
import type { BuilderState, BuilderActionResult } from './builder-state.ts'
import { builderPoolKey } from './builder-settings.ts'
import {
  mergeSignatureResults,
  selectSignatureSeeds,
  signatureEntries,
  signatureLimits,
  type SignatureSeed,
} from './signature-recommendations.ts'
import type { SeedEvidence } from './recommendation-types.ts'

export type FetchOutcome =
  | 'success'
  | 'success-empty'
  | 'partial'
  | 'invalid'
  | 'transient-failure'
  | 'permanent-failure'
  | 'cancelled'
export type FetchResponse = {
  outcome: FetchOutcome
  page?: EdhrecCommanderPage
  cards?: ScryfallCard[]
  hydration?: [string, ScryfallCard][]
}
export type SignatureRequest =
  | { kind: 'current-data'; boundary: 'nextBatch'; cards: BuilderState['deck'] }
  | { kind: 'signature-page'; boundary: 'nextBatch'; seed: SignatureSeed; excluded: string[] }
  | {
      kind: 'signature-cards'
      boundary: 'nextBatch'
      seeds: SignatureSeed[]
      evidence: SeedEvidence[]
      names: string[]
    }
export type PlannedFetch = {
  id: string
  generation: string
  boundaryId: number
  attempt: number
  request: SignatureRequest
  response?: FetchResponse
}
export type FetchBoundary = {
  id: number
  generation: string
  extraSubTheme: string
  stage: 'hydration' | 'pages' | 'cards'
}

/** Only recommendation context changes invalidate reserved signature work. Queue/transport timing does not. */
export function fetchGeneration(state: BuilderState) {
  return JSON.stringify([
    state.fetchEpoch,
    state.signatureDeckKey,
    state.today,
    state.commander,
    builderPoolKey(state),
    state.deck,
    state.sideboard,
    state.ignoredCards,
    state.theme,
    state.activeSubThemes,
    state.recommendationStyle,
    state.deckTargets,
    state.includeCreature,
    state.maxPrice,
    state.focusedRole,
    state.commanderDetails?.colours,
  ])
}
const retryable = (work: PlannedFetch) =>
  work.response && ['transient-failure', 'cancelled'].includes(work.response.outcome)
const key = (request: SignatureRequest) =>
  request.kind === 'current-data'
    ? `current-data:${request.cards.map(cardDataKey).join('|')}`
    : request.kind === 'signature-page'
      ? `${request.kind}:${request.seed.page}:${cardNameKey(request.seed.card.name)}`
      : `${request.kind}:${request.names.map(cardNameKey).join('|')}`

function reserve(state: BuilderState, requests: SignatureRequest[]): BuilderActionResult {
  const boundary = state.fetchBoundary!
  const work = requests.map((request, index): PlannedFetch => ({
    id: `${state.signatureDeckKey}:${state.fetchEpoch}:${boundary.id}:${request.kind}:${index}`,
    boundaryId: boundary.id,
    generation: boundary.generation,
    request,
    attempt: 1 + state.completedFetches.filter((item) => key(item.request) === key(request)).length,
  }))
  return { state: { ...state, pendingFetches: work }, fetchRequests: work }
}

/** Atomic reservations: a repeated plan for an unsettled boundary cannot spend quota twice. */
export function planFetches(state: BuilderState, extraSubTheme = ''): BuilderActionResult {
  if (state.fetchBoundary) return { state, fetchRequests: [] }
  const generation = fetchGeneration(state)
  const cards = [
    ...state.deck,
    ...state.sideboard,
    ...state.queue,
    ...state.deferredCards.map(({ card }) => card),
  ].filter((card) => card.dataStatus === 'pending')
  if (cards.length)
    return reserve(
      {
        ...state,
        fetchSequence: state.fetchSequence + 1,
        fetchBoundary: {
          id: state.fetchSequence + 1,
          generation,
          extraSubTheme,
          stage: 'hydration',
        },
      },
      [{ kind: 'current-data', boundary: 'nextBatch', cards }],
    )
  return planPages(state, extraSubTheme)
}

function planPages(state: BuilderState, extraSubTheme = ''): BuilderActionResult {
  const generation = fetchGeneration(state)
  const prior = state.completedFetches.filter((work) => work.generation === generation)
  const seeds =
    state.commanderDetails && state.deck.length < 100
      ? selectSignatureSeeds(
          state.commander,
          state.deck,
          buildRecommendationContext(
            { ...state, prioritizeDeckHealth: state.recommendationStyle !== 'thematic' },
            state.queue,
          ),
        )
      : []
  const requests: SignatureRequest[] = seeds
    .filter((seed) => {
      const last = prior.findLast(
        (work) =>
          work.request.kind === 'signature-page' &&
          key(work.request) ===
            key({ kind: 'signature-page', boundary: 'nextBatch', seed, excluded: [] }),
      )
      return !last || retryable(last)
    })
    .slice(0, Math.max(0, signatureLimits.seedsPerDeck - state.signatureQuota.pages))
    .map((seed) => ({
      kind: 'signature-page',
      boundary: 'nextBatch',
      seed,
      excluded: blockedNames(state),
    }))
  const next = {
    ...state,
    fetchSequence: state.fetchSequence + 1,
    fetchBoundary: {
      id: state.fetchSequence + 1,
      generation,
      extraSubTheme,
      stage: 'pages' as const,
    },
    signatureQuota: {
      ...state.signatureQuota,
      pages: state.signatureQuota.pages + requests.length,
    },
  }
  if (requests.length) return reserve(next, requests)
  return planCards(next)
}

function planCards(state: BuilderState): BuilderActionResult {
  const generation = state.fetchBoundary!.generation
  const excluded = new Set(blockedNames(state))
  for (const work of state.completedFetches)
    if (
      work.generation === generation &&
      work.request.kind === 'signature-cards' &&
      !retryable(work)
    )
      work.request.names.forEach((name) => excluded.add(cardNameKey(name)))
  const evidence: SeedEvidence[] = []
  const seeds: SignatureSeed[] = []
  // Completed work is appended in reservation order, never arrival order.
  for (const work of state.completedFetches) {
    if (
      work.generation !== generation ||
      work.request.kind !== 'signature-page' ||
      !work.response?.page
    )
      continue
    const entries = signatureEntries(
      work.response.page,
      work.request.seed,
      new Set([...excluded, ...work.request.excluded]),
    )
    if (entries.length) {
      evidence.push(...entries)
      seeds.push(work.request.seed)
    }
  }
  const names = [...new Set(evidence.map(({ name }) => name))].slice(
    0,
    signatureLimits.seedsPerPass * signatureLimits.namesPerSeed,
  )
  const request: SignatureRequest = {
    kind: 'signature-cards',
    boundary: 'nextBatch',
    seeds,
    evidence,
    names,
  }
  const previous = state.completedFetches.findLast(
    (work) => work.generation === generation && key(work.request) === key(request),
  )
  const next = { ...state, fetchBoundary: { ...state.fetchBoundary!, stage: 'cards' as const } }
  if (
    !names.length ||
    state.signatureQuota.cards >= signatureLimits.postsPerDeck ||
    (previous && !retryable(previous))
  )
    return { state: next, fetchRequests: [] }
  return reserve(
    { ...next, signatureQuota: { ...state.signatureQuota, cards: state.signatureQuota.cards + 1 } },
    [request],
  )
}

export function settleFetch(
  state: BuilderState,
  id: string,
  response: FetchResponse,
): BuilderActionResult {
  const boundary = state.fetchBoundary
  const work = state.pendingFetches.find((item) => item.id === id)
  if (!boundary || !work || work.response || work.generation !== fetchGeneration(state))
    return { state, fetchRequests: [] }
  const valid = validateResponse(work, response)
  const pending = state.pendingFetches.map((item) =>
    item.id === id ? { ...item, response: valid } : item,
  )
  if (pending.some((item) => !item.response))
    return { state: { ...state, pendingFetches: pending }, fetchRequests: [] }
  let next: BuilderState = {
    ...state,
    pendingFetches: [],
    completedFetches: [...state.completedFetches, ...pending],
  }
  if (boundary.stage === 'hydration') {
    const results = pending.flatMap((item) => item.response?.hydration ?? [])
    if (
      pending.every(
        (item) =>
          item.response && ['success', 'success-empty', 'partial'].includes(item.response.outcome),
      )
    )
      next = applyBuilderHydration(next, { type: 'hydrate', results })
    return planPages({ ...next, fetchBoundary: null }, boundary.extraSubTheme)
  }
  if (boundary.stage === 'pages') return planCards(next)
  return { state: next, fetchRequests: [] }
}

/** Merge after feedback, deferral release and advancement, so short/exhausted queues consume no new arrivals. */
export function mergeBoundaryResults(state: BuilderState, boundaryId: number): BuilderState {
  let queue = state.queue
  for (const item of state.completedFetches.filter(
    (work) => work.boundaryId === boundaryId && work.generation === fetchGeneration(state),
  )) {
    if (item.request.kind !== 'signature-cards') continue
    const request = item.request
    const cards = item.response?.cards ?? []
    const results = request.names.flatMap((name) => {
      const raw = cards.find((card) => cardNameKey(card.name) === cardNameKey(name))
      return raw
        ? [
            {
              raw,
              seeds: request.seeds,
              evidence: request.evidence.filter(
                (entry) => cardNameKey(entry.name) === cardNameKey(name),
              ),
            },
          ]
        : []
    })
    queue = mergeSignatureResults(queue, results, state, true)
  }
  return { ...state, queue }
}

function validateResponse(work: PlannedFetch, response: FetchResponse): FetchResponse {
  if (!['success', 'success-empty', 'partial'].includes(response.outcome))
    return { outcome: response.outcome }
  if (work.request.kind === 'signature-page') {
    const lists = response.page?.container?.json_dict?.cardlists
    if (
      !Array.isArray(lists) ||
      !lists.every(
        (list) =>
          list &&
          typeof list.tag === 'string' &&
          Array.isArray(list.cardviews) &&
          list.cardviews.every(
            (card) =>
              card &&
              typeof card.name === 'string' &&
              card.name.length > 0 &&
              [card.lift, card.synergy, card.num_decks].every(
                (value) => value === undefined || Number.isFinite(value),
              ),
          ),
      )
    )
      return { outcome: 'invalid' }
    return { outcome: response.outcome, page: response.page }
  }
  if (work.request.kind === 'current-data') {
    const hydration = Array.isArray(response.hydration)
      ? response.hydration.filter(
          (entry) =>
            Array.isArray(entry) && typeof entry[0] === 'string' && isScryfallCard(entry[1]),
        )
      : []
    return { outcome: response.outcome, hydration }
  }
  if (!Array.isArray(response.cards)) return { outcome: 'invalid' }
  const cards = response.cards.filter(isScryfallCard)
  return {
    cards,
    outcome:
      cards.length === response.cards.length
        ? response.outcome
        : cards.length
          ? 'partial'
          : 'invalid',
  }
}

function blockedNames(state: BuilderState): string[] {
  return [
    ...state.deck,
    ...state.sideboard,
    ...state.queue,
    ...state.deferredCards.map(({ card }) => card),
  ]
    .map(({ name }) => cardNameKey(name))
    .concat(state.ignoredCards.map(cardNameKey))
}
