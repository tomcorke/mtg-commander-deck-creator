import { defaultDeckTargets, rolesForCard, type DeckTargets } from '../deck-analysis.ts'
import type { Card, DeckCard } from './card-model.ts'
import { cardConstructionError } from './commander-construction.ts'
import { commanderNames } from './commander-catalog.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import {
  batchRecommendations,
  cardScoreBreakdown,
  rankRecommendationCards,
  releaseDeferred,
} from './recommendation-queue.ts'
import { focusedRecommendations, withinPriceCap } from './recommendation-tuning.ts'
import type {
  CollectionMode,
  DeferredCard,
  RecommendationScoreBreakdown,
  RecommendationStyle,
} from './recommendation-types.ts'

/** Bumped whenever scoring or ranking changes the order produced from the same inputs. */
export const recommendationScoringVersion = 1

/** FNV-1a hash of a seed string, as an unsigned 32-bit integer. */
const hashSeed = (seed: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index++)
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193)
  return hash >>> 0
}

/** Mulberry32: a small deterministic generator of fractions in [0, 1). */
function seededRandom(seed: string) {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** One fraction in [0, 1) fixed by the seed. */
export const seededFraction = (seed: string) => seededRandom(seed)()

/** Fisher–Yates shuffle with a seeded generator: the same seed always gives the same order. */
export function seededShuffle<T>(items: readonly T[], seed: string) {
  const random = seededRandom(seed)
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled
}

/** Keep live EDHREC evidence when another source finds the same Oracle identity. */
export function mergeRecommendationCandidates(primary: Card[], additions: Card[]) {
  const merged: Card[] = []
  const oracles = new Map<string, number>()
  const names = new Map<string, number>()
  for (const card of [...primary, ...additions]) {
    const name = card.name.toLowerCase()
    const index = (card.oracleId ? oracles.get(card.oracleId) : undefined) ?? names.get(name)
    if (index !== undefined) {
      if (merged[index].localIndexSnapshot && !card.localIndexSnapshot) {
        merged[index] = card
        if (card.oracleId) oracles.set(card.oracleId, index)
        names.set(name, index)
      }
      continue
    }
    if (card.oracleId) oracles.set(card.oracleId, merged.length)
    names.set(name, merged.length)
    merged.push(card)
  }
  return merged
}

/** The fallback pool when EDHREC is unavailable: shuffled main and mana pools, batched. */
export function fallbackPool(main: Card[], mana: Card[], includeCreature: boolean, seed: string) {
  return batchRecommendations(
    mergeRecommendationCandidates(
      seededShuffle(main, `${seed}:main`),
      seededShuffle(mana, `${seed}:mana`),
    ),
    includeCreature,
  )
}

/** Collection cards lead in prefer mode and replace the pool in only mode. */
export function mergeCollectionCandidates(
  offered: Card[],
  collection: Card[],
  mode: CollectionMode,
) {
  if (mode === 'only') return collection
  const names = new Set(collection.map(({ name }) => name))
  return [...collection, ...offered.filter(({ name }) => !names.has(name))]
}

/** A provider result: the cards it returned, or the error it failed with. */
export type SourceOutcome = { cards: Card[] } | { error: string }

/** Ordered source results for one pool build, already converted to cards. */
export type CandidateSnapshots = {
  edhrec?: SourceOutcome
  fallback?: { main: Card[]; mana: Card[] }
  theme?: Card[]
  roleGap?: Card[]
  collection?: SourceOutcome
}

export type PreparedCandidates = { pool: Card[]; limited: boolean; error?: string }

/**
 * Pure version of the app's pool build: EDHREC first, the seeded fallback when EDHREC fails or
 * returns fewer than four legal cards, then theme and role-gap additions, then the collection.
 */
export function prepareCandidates(
  snapshots: CandidateSnapshots,
  options: {
    identity: string[]
    includeCreature: boolean
    collectionMode: CollectionMode
    collectionSets: string[]
    seed: string
  },
): PreparedCandidates {
  const { identity, collectionMode, collectionSets } = options
  if (collectionMode === 'only' && !collectionSets.length)
    return {
      pool: [],
      limited: true,
      error: 'Select at least one collection for Only collection mode.',
    }
  let pool: Card[] = []
  let limited = collectionMode === 'only'
  if (collectionMode !== 'only') {
    const edhrec =
      snapshots.edhrec && 'cards' in snapshots.edhrec
        ? snapshots.edhrec.cards.filter((card) => !cardConstructionError(card, [], identity))
        : []
    if (edhrec.length >= 4) pool = edhrec
    else {
      pool = fallbackPool(
        snapshots.fallback?.main ?? [],
        snapshots.fallback?.mana ?? [],
        options.includeCreature,
        options.seed,
      )
      limited = true
    }
    pool = mergeRecommendationCandidates(pool, snapshots.theme ?? [])
    pool = mergeRecommendationCandidates(pool, snapshots.roleGap ?? [])
  }
  if (collectionMode !== 'none' && collectionSets.length) {
    const collection = snapshots.collection
    if (collection && 'cards' in collection)
      pool = mergeCollectionCandidates(pool, collection.cards, collectionMode)
    else if (collectionMode === 'only')
      return {
        pool: [],
        limited,
        error: collection?.error ?? 'Collection unavailable',
      }
  }
  return { pool, limited }
}

/** Everything that decides the queue for one pool, as plain data. */
export type RecommendState = {
  commander: string
  identity: string[]
  pool: Card[]
  deck: DeckCard[]
  sideboard: Card[]
  ignoredCards: string[]
  deferredCards: DeferredCard<Card>[]
  batchNumber: number
  preferenceScores: Record<string, number>
  theme: string
  activeSubThemes: string[]
  recommendationStyle: RecommendationStyle
  prioritizeDeckHealth: boolean
  includeCreature: boolean
  maxPrice: number | null
  collectionMode: CollectionMode
  collectionSets: string[]
  deckTargets?: DeckTargets
  focusedRole?: string | null
}

export type ExclusionReason =
  'illegal' | 'ignored' | 'deferred' | 'in-deck' | 'over-price-cap' | 'outside-collection'

export type ScoredCard = {
  name: string
  position: number
  scoringVersion: number
  source: string
  breakdown: RecommendationScoreBreakdown
  /** Score factors that contributed, in breakdown order. */
  codes: (keyof RecommendationScoreBreakdown)[]
}

export type Recommendation = {
  queue: Card[]
  /** The visible batch. Later batches are provisional: they re-rank as the queue advances. */
  batch: Card[]
  deferredCards: DeferredCard<Card>[]
  error?: string
  scores: ScoredCard[]
  exclusions: { name: string; reason: ExclusionReason; detail?: string }[]
}

type Rank = typeof rankRecommendationCards<Card>

/** Rank a prepared pool against the deck and settings. Same input, same output. */
export function recommend(
  state: RecommendState,
  rank: Rank = rankRecommendationCards,
): Recommendation {
  const exclusions: Recommendation['exclusions'] = []
  const legal = state.pool.filter((card) => {
    const detail = cardConstructionError(card, [], state.identity)
    if (detail) exclusions.push({ name: card.name, reason: 'illegal', detail })
    return !detail
  })
  if (legal.length < 4)
    return {
      queue: [],
      batch: [],
      deferredCards: state.deferredCards,
      scores: [],
      exclusions,
      error:
        state.collectionMode === 'only'
          ? 'Your chosen sets have too few legal cards.'
          : 'Too few recommendation cards',
    }
  const offered = new Map(legal.map((card) => [card.name, card]))
  // Keep off-pool deferrals so restoring settings also restores their original waiting period.
  const deferredCards = releaseDeferred(
    state.deferredCards.map((entry) => ({
      ...entry,
      card: offered.get(entry.card.name) ?? entry.card,
      available:
        offered.has(entry.card.name) &&
        withinPriceCap(offered.get(entry.card.name)!, state.maxPrice),
    })),
    state.batchNumber,
  ).waiting
  const ignored = new Set(state.ignoredCards)
  const deferred = new Set(deferredCards.map(({ card }) => card.name))
  const owned = new Set([...state.deck, ...state.sideboard].map(({ name }) => name))
  const candidates = legal.filter((card) => {
    const reason: ExclusionReason | undefined = ignored.has(card.name)
      ? 'ignored'
      : deferred.has(card.name)
        ? 'deferred'
        : owned.has(card.name)
          ? 'in-deck'
          : undefined
    if (reason) exclusions.push({ name: card.name, reason })
    return !reason
  })
  const context = buildRecommendationContext(
    { ...state, deckTargets: state.deckTargets ?? defaultDeckTargets },
    candidates,
    state.deck,
  )
  const queue = rank(candidates, context, state.includeCreature, rolesForCard)
  const queued = new Set(queue)
  for (const card of candidates)
    if (!queued.has(card))
      exclusions.push({
        name: card.name,
        reason: withinPriceCap(card, state.maxPrice) ? 'outside-collection' : 'over-price-cap',
      })
  const scores = queue.map((card, position) => {
    const breakdown = cardScoreBreakdown(card, context, rolesForCard)
    return {
      name: card.name,
      position,
      scoringVersion: recommendationScoringVersion,
      source: card.reason,
      breakdown,
      codes: (Object.keys(breakdown) as (keyof RecommendationScoreBreakdown)[]).filter(
        (key) => key !== 'total' && breakdown[key] !== 0,
      ),
    }
  })
  return {
    queue,
    batch: focusedRecommendations(queue, state.focusedRole, rolesForCard).slice(0, 4),
    deferredCards,
    scores,
    exclusions,
  }
}

export type CardExplanation =
  | { status: 'commander' }
  | { status: 'not-in-pool' }
  | { status: 'excluded'; reason: ExclusionReason | 'too-few-cards'; detail?: string }
  | ({ status: 'ranked' } & ScoredCard)

/** Why a card is, or is not, in the queue. Read-only: it reruns `recommend`. */
export function explainCard(state: RecommendState, name: string): CardExplanation {
  const key = name.toLowerCase()
  const matches = (card: { name: string }) => card.name.toLowerCase() === key
  if (commanderNames(state.commander).some((commander) => commander.toLowerCase() === key))
    return { status: 'commander' }
  if (!state.pool.some(matches)) return { status: 'not-in-pool' }
  const result = recommend(state)
  const excluded = result.exclusions.find(matches)
  if (excluded) return { status: 'excluded', reason: excluded.reason, detail: excluded.detail }
  const scored = result.scores.find(matches)
  return scored
    ? { status: 'ranked', ...scored }
    : { status: 'excluded', reason: 'too-few-cards', detail: result.error }
}
