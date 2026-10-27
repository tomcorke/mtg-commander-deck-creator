import { buildEdhrecRecommendations, excludedByOptions } from './recommendation-sources.ts'
import type { EdhrecEntry, RecommendationOptions } from './recommendation-types.ts'
import { defaultDeckTargets, rolesForCard, type DeckTargets } from '../deck-analysis.ts'
import { toCard, type ScryfallCard, type Card, type DeckCard } from './card-model.ts'
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
  BatchPlacementReason,
} from './recommendation-types.ts'

/** Bumped whenever scoring or ranking changes the order produced from the same inputs. */
export const recommendationScoringVersion = 3

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

export type RawCandidate = {
  card: ScryfallCard
  reason: string
  localIndexSnapshot?: boolean
  collectionMatch?: boolean
}

/** Ordered provider records, including empty/partial successes; fatal failures bypass optional-source fallback (for example, rate limits). */
export type SourceOutcome = { cards: RawCandidate[] } | { error: string; fatal?: boolean }

/** Ordered source results for one pool build, before conversion. Mechanic and role-gap snapshots contain the bounded search selections. */
export type CandidateSnapshots = {
  edhrec?: { entries: EdhrecEntry[]; cards: ScryfallCard[] } | { error: string; fatal?: boolean }
  fallback?: { main: SourceOutcome; mana: SourceOutcome }
  theme?: SourceOutcome
  mechanic?: SourceOutcome
  roleGap?: SourceOutcome
  collection?: SourceOutcome
}

export type PreparedCandidates = { pool: Card[]; limited: boolean; error?: string }

/**
 * Pure version of the app's pool build: EDHREC first, the seeded fallback when EDHREC fails or
 * returns fewer than four legal cards, then theme, mechanic and role-gap additions, then the collection.
 */
export type CandidatePreparationOptions = {
  identity: string[]
  includeCreature: boolean
  collectionMode: CollectionMode
  collectionSets: string[]
  seed: string
  today: string
  excludeGameChangers?: boolean
  excludeTutors?: boolean
  excludeExtraTurns?: boolean
  excludeUnreleased?: boolean
  powerTarget?: RecommendationOptions['powerTarget']
}

function prepareCoreCandidates(
  snapshots: CandidateSnapshots,
  options: CandidatePreparationOptions,
  policy: RecommendationOptions,
  convert: (source?: SourceOutcome) => Card[],
): PreparedCandidates {
  const edhrec =
    snapshots.edhrec && 'cards' in snapshots.edhrec
      ? buildEdhrecRecommendations(
          snapshots.edhrec.entries,
          snapshots.edhrec.cards.filter((card) =>
            card.color_identity?.every((colour) => options.identity.includes(colour)),
          ),
          policy,
        ).filter((card) => !cardConstructionError(card, [], options.identity))
      : []
  let pool: Card[] = edhrec
  const limited = edhrec.length < 4
  if (limited) {
    const failure = [snapshots.fallback?.main, snapshots.fallback?.mana].find(
      (source) => source && 'error' in source,
    )
    if (failure && 'error' in failure) return { pool: [], limited, error: failure.error }
    pool = fallbackPool(
      convert(snapshots.fallback?.main),
      convert(snapshots.fallback?.mana),
      options.includeCreature,
      options.seed,
    )
  }
  for (const source of [snapshots.theme, snapshots.mechanic, snapshots.roleGap])
    pool = mergeRecommendationCandidates(pool, convert(source))
  return { pool, limited }
}

function prepareSource(source: SourceOutcome | undefined, policy: RecommendationOptions): Card[] {
  if (!source || !('cards' in source)) return []
  return source.cards
    .filter(({ card }) => !excludedByOptions(card, policy))
    .map(({ card, reason, ...provenance }) => ({ ...toCard(card, reason), ...provenance }))
}

export function prepareCandidates(
  snapshots: CandidateSnapshots,
  options: CandidatePreparationOptions,
): PreparedCandidates {
  const { collectionMode, collectionSets } = options
  if (collectionMode === 'only' && !collectionSets.length)
    return {
      pool: [],
      limited: true,
      error: 'Select at least one collection for Only collection mode.',
    }
  const policy = {
    excludeGameChangers: false,
    excludeTutors: false,
    excludeExtraTurns: false,
    excludeUnreleased: false,
    powerTarget: 'upgraded' as const,
    ...options,
  }
  const convert = (source?: SourceOutcome) => prepareSource(source, policy)
  const sources =
    collectionMode === 'only'
      ? [snapshots.collection]
      : [
          snapshots.edhrec,
          snapshots.theme,
          snapshots.mechanic,
          snapshots.roleGap,
          ...(collectionMode !== 'none' && collectionSets.length ? [snapshots.collection] : []),
        ]
  const fatal = sources.find((source) => source && 'error' in source && source.fatal)
  if (fatal && 'error' in fatal)
    return { pool: [], limited: collectionMode === 'only', error: fatal.error }
  const core =
    collectionMode === 'only'
      ? { pool: [], limited: true }
      : prepareCoreCandidates(snapshots, options, policy, convert)
  if (core.error) return core
  let { pool } = core
  const { limited } = core
  if (collectionMode === 'none' || !collectionSets.length) return core
  const collection = snapshots.collection
  if (collection && 'cards' in collection)
    pool = mergeCollectionCandidates(
      pool,
      convert(collection).map((card) => ({ ...card, collectionMatch: true })),
      collectionMode,
    )
  else if (collectionMode === 'only')
    return { pool: [], limited, error: collection?.error ?? 'Collection unavailable' }

  return { pool, limited }
}

/** Everything that decides the queue for one pool, as plain data. */
export type RecommendState = {
  commander: string
  identity: string[]
  pool: Card[]
  deck: DeckCard[]
  sideboard: DeckCard[]
  ignoredCards: string[]
  deferredCards: DeferredCard<Card>[]
  batchNumber: number
  preferenceScores: Record<string, number>
  theme: string
  activeSubThemes: string[]
  recommendationStyle: RecommendationStyle
  powerTarget?: RecommendationOptions['powerTarget']
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
  /** Selection and rearrangement steps that affected this card, in algorithm order. */
  placementReasons: BatchPlacementReason[]
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
  const placements = new Map<Card, BatchPlacementReason[]>()
  const queue = rank(candidates, context, state.includeCreature, rolesForCard, (card, reason) => {
    const reasons = placements.get(card) ?? []
    if (!reasons.includes(reason)) reasons.push(reason)
    placements.set(card, reasons)
  })
  const batch = focusedRecommendations(queue, state.focusedRole, rolesForCard).slice(0, 4)
  if (state.focusedRole)
    for (const card of batch) placements.set(card, [...(placements.get(card) ?? []), 'focus'])
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
      placementReasons: placements.get(card) ?? [],
      codes: (Object.keys(breakdown) as (keyof RecommendationScoreBreakdown)[]).filter(
        (key) => key !== 'total' && breakdown[key] !== 0,
      ),
    }
  })
  return {
    queue,
    batch,
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
