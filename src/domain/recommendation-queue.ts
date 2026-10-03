import {
  compareRecommendationScores,
  recommendationScoreBreakdown,
} from './recommendation-scoring.ts'
import {
  focusedRecommendations,
  withinPriceCap,
  type IgnoreReason,
} from './recommendation-tuning.ts'
import { recommendationScoreFactorMaximums } from './recommendation-types.ts'
import type {
  CollectionMode,
  DeferredCard,
  RecommendationScoreContext,
  RecommendationStyle,
} from './recommendation-types.ts'

function takeNextRecommendation<T extends { reason: string }>(
  remaining: T[],
  picks: T[],
  test: (card: T) => boolean,
  style: RecommendationStyle,
) {
  const allowedNewCard = (card: T) =>
    style === 'competitive' ||
    card.reason !== 'Interesting new pick' ||
    picks.filter((pick) => pick.reason === 'Interesting new pick').length <
      (style === 'fun' ? 2 : 1)
  const newReason = (card: T) =>
    style === 'competitive' || !picks.some((pick) => pick.reason === card.reason)
  let index = remaining.findIndex((card) => test(card) && allowedNewCard(card) && newReason(card))
  if (index < 0) index = remaining.findIndex((card) => test(card) && allowedNewCard(card))
  if (index < 0) index = remaining.findIndex(test)
  if (index >= 0) picks.push(...remaining.splice(index, 1))
}

function nextRecommendationBatch<T extends { reason: string; typeLine: string }>(
  remaining: T[],
  includeCreature: boolean,
  canUse: (card: T) => boolean,
  style: RecommendationStyle,
) {
  const picks: T[] = []
  const take = (test: (card: T) => boolean) => takeNextRecommendation(remaining, picks, test, style)
  if (includeCreature)
    take(
      (card) =>
        canUse(card) && card.reason !== 'Land or mana' && card.typeLine.includes('Creature'),
    )
  while (
    style !== 'competitive' &&
    picks.filter((card) => card.reason !== 'Land or mana').length < 3
  ) {
    const count = picks.length
    take((card) => canUse(card) && card.reason !== 'Land or mana')
    if (picks.length === count) break
  }
  if (style !== 'competitive') take((card) => card.reason === 'Land or mana')
  while (picks.length < 4) {
    const count = picks.length
    take(style === 'competitive' ? () => true : canUse)
    if (picks.length === count) take(() => true)
    if (picks.length === count) break
  }
  return picks
}

export function batchRecommendations<T extends { name: string; reason: string; typeLine: string }>(
  cards: T[],
  includeCreature: boolean,
  canUse: (card: T) => boolean = () => true,
  style: RecommendationStyle = 'balanced',
) {
  const remaining = [...cards]
  const ordered: T[] = []
  while (remaining.length)
    ordered.push(...nextRecommendationBatch(remaining, includeCreature, canUse, style))
  if (
    ordered.length !== cards.length ||
    new Set(ordered.map((card) => card.name)).size !== cards.length
  )
    throw new Error('Recommendation queue lost or duplicated cards')
  return ordered
}

function keepThemeIdentity<T extends { tags: string[]; set?: string; collectionMatch?: boolean }>(
  cards: T[],
  context: RecommendationScoreContext,
  canUse: (card: T) => boolean = () => true,
) {
  const isIdentity = (card: T) =>
    Boolean(
      card.collectionMatch ||
      (card.set && context.collectionSets?.includes(card.set)) ||
      [context.theme, ...context.activeSubThemes]
        .filter(Boolean)
        .some((theme) => card.tags.includes(theme)),
    )
  const ordered = [...cards]
  for (let start = 0; start < ordered.length; start += 4) {
    const batch = ordered.slice(start, start + 4)
    if (ordered.slice(start).filter(isIdentity).length < Math.min(3, batch.length)) continue
    while (batch.filter((card) => !isIdentity(card)).length > 1) {
      const replacement = ordered.findIndex(
        (card, index) => index >= start + 4 && canUse(card) && isIdentity(card),
      )
      const displaced = batch.findLastIndex((card) => !isIdentity(card))
      if (replacement < 0 || displaced < 0) break
      ;[ordered[start + displaced], ordered[replacement]] = [
        ordered[replacement],
        ordered[start + displaced],
      ]
      batch[displaced] = ordered[start + displaced]
    }
  }
  return ordered
}

export function rankRecommendationCards<
  T extends {
    name: string
    reason: string
    typeLine: string
    tags: string[]
    set?: string
    collectionMatch?: boolean
    price?: string
  },
>(
  cards: T[],
  context: RecommendationScoreContext,
  includeCreature: boolean,
  cardRoles: (card: T) => string[] = () => [],
) {
  const eligible =
    context.collectionMode === 'only' && context.collectionSets?.length
      ? cards.filter(
          (card) =>
            card.collectionMatch || (card.set && context.collectionSets?.includes(card.set)),
        )
      : cards
  const affordable = eligible.filter((card) => withinPriceCap(card, context.maxPrice))
  const scores = new Map<T, ReturnType<typeof recommendationScoreBreakdown>>()
  const score = (card: T) => {
    if (!scores.has(card))
      scores.set(
        card,
        recommendationScoreBreakdown(card, { ...context, cardRoles: cardRoles(card) }),
      )
    return scores.get(card)!
  }
  const ranked = [...affordable].sort((left, right) =>
    compareRecommendationScores(score(left), score(right)),
  )
  const canUse = (card: T) =>
    !card.typeLine.includes('Creature') ||
    score(card).manaFitPenalty > -recommendationScoreFactorMaximums.manaFitPenalty / 2
  const style = context.recommendationStyle ?? 'balanced'
  const batches = batchRecommendations(ranked, includeCreature, canUse, style)
  if (style === 'competitive') return batches
  const varied = balanceThemeCoverage(
    batches,
    [context.theme, ...context.activeSubThemes].filter(Boolean),
    canUse,
  )
  return style === 'thematic' ? keepThemeIdentity(varied, context, canUse) : varied
}

export function selectSubTheme(activeSubThemes: string[], name: string) {
  const next = activeSubThemes.includes(name)
    ? activeSubThemes
    : [...activeSubThemes, name].slice(0, 2)
  return { activeSubThemes: next, refreshRecommendations: next.length !== activeSubThemes.length }
}

export function balanceThemeCoverage<T extends { tags: string[]; reason: string }>(
  cards: T[],
  themes: string[],
  canUse: (card: T) => boolean = () => true,
) {
  if (themes.length < 2) return cards
  const ordered = [...cards]
  for (let start = 0; start < ordered.length; start += 4)
    for (const theme of themes) {
      if (ordered.slice(start, start + 4).some((card) => card.tags.includes(theme))) continue
      const batch = ordered.slice(start, start + 4)
      const replacement = ordered.findIndex(
        (card, index) =>
          index >= start + 4 &&
          canUse(card) &&
          card.tags.includes(theme) &&
          card.reason !== 'Land or mana' &&
          (card.reason !== 'Interesting new pick' ||
            !batch.some((item) => item.reason === 'Interesting new pick')),
      )
      const displaced = batch.findLastIndex(
        (card) =>
          card.reason !== 'Land or mana' &&
          !card.tags.includes(theme) &&
          !themes.some(
            (other) =>
              other !== theme &&
              card.tags.includes(other) &&
              batch.filter((item) => item.tags.includes(other)).length === 1,
          ),
      )
      if (replacement >= 0 && displaced >= 0)
        [ordered[start + displaced], ordered[replacement]] = [
          ordered[replacement],
          ordered[start + displaced],
        ]
    }
  return ordered
}

const ignorePreferenceChanges: Record<IgnoreReason, number> = {
  'Not my style': -3,
  'Too expensive': 0,
  'Off-theme': -2,
  'Have something similar': -2,
}

function preferenceChange(decision: RecommendationDecision, reason?: IgnoreReason) {
  if (decision === 'add') return 2
  if (decision !== 'ignore') return 0
  return reason ? ignorePreferenceChanges[reason] : -1
}

function reinforceThemes(scores: Record<string, number>, themes: string[]) {
  for (const theme of themes.filter(Boolean)) scores[theme] = (scores[theme] ?? 0) + 2
}

export function updatePreferenceScores(
  cards: { name: string; tags: string[]; collectionMatch?: boolean }[],
  decisions: Record<string, 'add' | 'later' | 'ignore'>,
  liked: string[],
  current: Record<string, number>,
  reasons: Record<string, IgnoreReason> = {},
  themes: string[] = [],
) {
  const scores = { ...current }
  for (const card of cards) {
    const decision = decisions[card.name]
    const reason = reasons[card.name]
    const change = preferenceChange(decision, reason)
    const likeBoost = decision !== 'ignore' && liked.includes(card.name) ? 4 : 0
    for (const tag of card.tags) scores[tag] = (scores[tag] ?? 0) + change + likeBoost
    if (card.collectionMatch) scores.Collection = (scores.Collection ?? 0) + change + likeBoost
    if (decision === 'ignore' && reason === 'Off-theme') reinforceThemes(scores, themes)
  }
  return scores
}

export function deferBatch<T>(
  batch: T[],
  decisions: Record<string, 'add' | 'later' | 'ignore'>,
  batchNumber: number,
  name: (card: T) => string,
) {
  return batch.flatMap((card): DeferredCard<T>[] => {
    const decision = decisions[name(card)]
    if (decision === 'add' || decision === 'ignore') return []
    return [{ card, eligibleBatch: batchNumber + (decision === 'later' ? 4 : 3) }]
  })
}

export function releaseDeferred<T>(deferred: DeferredCard<T>[], batchNumber: number) {
  return {
    ready: deferred
      .filter((item) => item.available !== false && item.eligibleBatch <= batchNumber)
      .map((item) => item.card),
    waiting: deferred.filter(
      (item) => item.available === false || item.eligibleBatch > batchNumber,
    ),
  }
}

export type RecommendationDecision = 'add' | 'later' | 'ignore'

function transitionBatch<T extends { name: string }>(
  queue: T[],
  deferredCards: DeferredCard<T>[],
  batchNumber: number,
  decisions: Record<string, RecommendationDecision>,
  focusedRole: string | null | undefined,
  cardRoles: (card: T) => string[],
) {
  const focused = focusedRecommendations(queue, focusedRole, cardRoles)
  const batch = focused.slice(0, 4)
  const batchNames = new Set(batch.map((card) => card.name))
  const remaining = queue.filter((card) => !batchNames.has(card.name))
  const pending = [
    ...deferredCards,
    ...deferBatch(batch, decisions, batchNumber, (card) => card.name),
  ]
  const nextBatchNumber = batchNumber + 1
  const released = {
    batchNumber: nextBatchNumber,
    ...releaseDeferred(pending, nextBatchNumber),
  }
  return { batch, released, candidates: [...remaining, ...released.ready] }
}

export function advanceRecommendationQueue<
  T extends {
    name: string
    reason: string
    typeLine: string
    tags: string[]
    set?: string
    collectionMatch?: boolean
    price?: string
  },
>({
  queue,
  deferredCards,
  batchNumber,
  decisions,
  liked,
  preferenceScores,
  pickedTags = new Set(),
  activeSubThemes,
  extraSubTheme = '',
  theme,
  includeCreature,
  roleBoosts = {},
  cardRoles = () => [],
  manaSupport,
  recommendationStyle = 'balanced',
  collectionSets = [],
  collectionMode = 'none',
  maxPrice,
  focusedRole,
  ignoreReasons = {},
}: {
  queue: T[]
  deferredCards: DeferredCard<T>[]
  batchNumber: number
  decisions: Record<string, RecommendationDecision>
  liked: string[]
  preferenceScores: Record<string, number>
  pickedTags?: Set<string>
  activeSubThemes: string[]
  extraSubTheme?: string
  theme: string
  includeCreature: boolean
  roleBoosts?: Record<string, number>
  cardRoles?: (card: T) => string[]
  manaSupport?: RecommendationScoreContext['manaSupport']
  recommendationStyle?: RecommendationStyle
  collectionSets?: string[]
  collectionMode?: CollectionMode
  maxPrice?: number | null
  focusedRole?: string | null
  ignoreReasons?: Record<string, IgnoreReason>
}) {
  const { batch, released, candidates } = transitionBatch(
    queue,
    deferredCards,
    batchNumber,
    decisions,
    focusedRole,
    cardRoles,
  )
  const rankedSubThemes = extraSubTheme ? [...activeSubThemes, extraSubTheme] : activeSubThemes
  const scores = updatePreferenceScores(batch, decisions, liked, preferenceScores, ignoreReasons, [
    theme,
    ...rankedSubThemes,
  ])
  const roleSupply = Object.fromEntries(
    Object.keys(roleBoosts).map((role) => [
      role,
      candidates.filter((card) => cardRoles(card).includes(role)).length,
    ]),
  )
  const context: RecommendationScoreContext = {
    theme,
    activeSubThemes: rankedSubThemes,
    pickedTags: new Set([
      ...pickedTags,
      ...Object.entries(scores)
        .filter(([, score]) => score > 0)
        .map(([tag]) => tag),
    ]),
    preferenceScores: scores,
    neededRoles: new Set(Object.keys(roleBoosts).filter((role) => (roleBoosts[role] ?? 0) > 0)),
    cardRoles: [],
    recommendationStyle,
    collectionSets,
    collectionMode,
    roleBoosts,
    roleSupply,
    batchNumber: released.batchNumber,
    manaSupport,
    maxPrice,
  }
  return {
    queue: rankRecommendationCards(candidates, context, includeCreature, cardRoles),
    deferredCards: released.waiting,
    batchNumber: released.batchNumber,
    preferenceScores: scores,
  }
}

export function freshRecommendationCycle() {
  return { deferredCards: [], batchNumber: 1 } as { deferredCards: never[]; batchNumber: number }
}
