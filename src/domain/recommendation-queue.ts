import { recommendationScore } from './recommendation-scoring.ts'
import type {
  CollectionMode,
  DeferredCard,
  RecommendationScoreContext,
  RecommendationStyle,
} from './recommendation-types.ts'

export function batchRecommendations<T extends { name: string; reason: string; typeLine: string }>(
  cards: T[],
  includeCreature: boolean,
) {
  const remaining = [...cards]
  const ordered: T[] = []
  while (remaining.length) {
    const picks: T[] = []
    const take = (test: (card: T) => boolean) => {
      const allowedNewCard = (card: T) =>
        card.reason !== 'Interesting new pick' ||
        !picks.some((pick) => pick.reason === 'Interesting new pick')
      const newReason = (card: T) => !picks.some((pick) => pick.reason === card.reason)
      let index = remaining.findIndex(
        (card) => test(card) && allowedNewCard(card) && newReason(card),
      )
      if (index < 0) index = remaining.findIndex((card) => test(card) && allowedNewCard(card))
      if (index < 0) index = remaining.findIndex(test)
      if (index >= 0) picks.push(...remaining.splice(index, 1))
    }
    if (includeCreature)
      take((card) => card.reason !== 'Land or mana' && card.typeLine.includes('Creature'))
    while (picks.filter((card) => card.reason !== 'Land or mana').length < 3) {
      const count = picks.length
      take((card) => card.reason !== 'Land or mana')
      if (picks.length === count) break
    }
    take((card) => card.reason === 'Land or mana')
    while (picks.length < 4) {
      const count = picks.length
      take(() => true)
      if (picks.length === count) break
    }
    ordered.push(...picks)
  }
  if (
    ordered.length !== cards.length ||
    new Set(ordered.map((card) => card.name)).size !== cards.length
  )
    throw new Error('Recommendation queue lost or duplicated cards')
  return ordered
}

function keepStoryIdentity<T extends { tags: string[]; set?: string; collectionMatch?: boolean }>(
  cards: T[],
  context: RecommendationScoreContext,
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
      const replacement = ordered.findIndex((card, index) => index >= start + 4 && isIdentity(card))
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
  const ranked = [...eligible].sort(
    (left, right) =>
      recommendationScore(right, { ...context, cardRoles: cardRoles(right) }) -
      recommendationScore(left, { ...context, cardRoles: cardRoles(left) }),
  )
  const varied = balanceThemeCoverage(
    batchRecommendations(ranked, includeCreature),
    [context.theme, ...context.activeSubThemes].filter(Boolean),
  )
  return context.recommendationStyle === 'story' ? keepStoryIdentity(varied, context) : varied
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

export function updatePreferenceScores(
  cards: { name: string; tags: string[]; collectionMatch?: boolean }[],
  decisions: Record<string, 'add' | 'later' | 'ignore'>,
  liked: string[],
  current: Record<string, number>,
) {
  const scores = { ...current }
  for (const card of cards) {
    const decision = decisions[card.name]
    const change = decision === 'add' ? 2 : decision === 'ignore' ? -1 : 0
    const likeBoost = decision !== 'ignore' && liked.includes(card.name) ? 4 : 0
    for (const tag of card.tags) scores[tag] = (scores[tag] ?? 0) + change + likeBoost
    if (card.collectionMatch) scores.Collection = (scores.Collection ?? 0) + change + likeBoost
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
    ready: deferred.filter((item) => item.eligibleBatch <= batchNumber).map((item) => item.card),
    waiting: deferred.filter((item) => item.eligibleBatch > batchNumber),
  }
}

export function releaseNextDeferred<T>(
  deferred: DeferredCard<T>[],
  requestedBatch: number,
  hasUnseenCards: boolean,
) {
  const batchNumber =
    !hasUnseenCards && deferred.length
      ? Math.max(requestedBatch, Math.min(...deferred.map((item) => item.eligibleBatch)))
      : requestedBatch
  return { batchNumber, ...releaseDeferred(deferred, batchNumber) }
}

export type RecommendationDecision = 'add' | 'later' | 'ignore'

export function advanceRecommendationQueue<
  T extends {
    name: string
    reason: string
    typeLine: string
    tags: string[]
    set?: string
    collectionMatch?: boolean
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
  recommendationStyle = 'balanced',
  collectionSets = [],
  collectionMode = 'none',
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
  recommendationStyle?: RecommendationStyle
  collectionSets?: string[]
  collectionMode?: CollectionMode
}) {
  const batch = queue.slice(0, 4)
  const pending = [
    ...deferredCards,
    ...deferBatch(batch, decisions, batchNumber, (card) => card.name),
  ]
  const released = releaseNextDeferred(pending, batchNumber + 1, queue.length > 4)
  const scores = updatePreferenceScores(batch, decisions, liked, preferenceScores)
  const rankedSubThemes = extraSubTheme ? [...activeSubThemes, extraSubTheme] : activeSubThemes
  const candidates = [...queue.slice(4), ...released.ready]
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
    batchNumber,
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
