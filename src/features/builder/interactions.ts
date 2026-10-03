import type { MouseEvent } from 'react'

import { focusedRecommendations, type IgnoreReason } from '../../domain/recommendation-tuning.ts'
import { analyseDeck, rolesForCard, type TargetKey } from '../../deck-analysis.ts'
import { buildRecommendationContext } from '../../app/recommendation-context.ts'
import {
  recommendationPoolKey,
  type RecommendationProgress,
} from '../../app/recommendation-actions.ts'
import type { Card } from '../../domain/card-model.ts'
import {
  advanceRecommendationQueue,
  deferBatch,
  rankRecommendationCards,
  updatePreferenceScores,
  type CollectionMode,
  type RecommendationStyle,
} from '../../recommendations.ts'
export type BuilderInteractionDeps = Record<string, any> & {
  start: (
    name: string,
    preserveDeck?: boolean,
    progress?: RecommendationProgress,
  ) => Promise<boolean>
  loadPrintings: (
    cards: Card[],
    preferredSet?: string,
    collectionSets?: string[],
    collectionMode?: CollectionMode,
  ) => Promise<void>
}

export function fanCards(event: MouseEvent<HTMLDivElement>) {
  const cards = event.currentTarget.querySelectorAll<HTMLElement>('.card-offer')
  cards.forEach((card) => {
    const { left, width } = card.getBoundingClientRect()
    const proximity = Math.max(
      0,
      1 - Math.abs(event.clientX - (left + width / 2)) / Math.max(width * 1.5, 1),
    )
    const image = card.querySelector('.offered-image')?.getBoundingClientRect()
    card.style.setProperty('--pointer-proximity', proximity.toFixed(3))
    card.style.cursor =
      image &&
      event.clientX >= image.left &&
      event.clientX <= image.right &&
      event.clientY >= image.top &&
      event.clientY <= image.bottom
        ? 'pointer'
        : ''
  })
}

export function resetFan(event: MouseEvent<HTMLDivElement>) {
  event.currentTarget.querySelectorAll<HTMLElement>('.card-offer').forEach((card) => {
    card.style.removeProperty('--pointer-proximity')
    card.style.cursor = ''
  })
}

export function clickCardImage(
  event: MouseEvent<HTMLElement>,
  card: Card,
  decide: (card: Card, action: 'add' | 'later' | 'ignore') => void,
) {
  if ((event.target as HTMLElement).closest('button')) return
  const image = event.currentTarget.querySelector('.offered-image')?.getBoundingClientRect()
  if (
    image &&
    event.clientX >= image.left &&
    event.clientX <= image.right &&
    event.clientY >= image.top &&
    event.clientY <= image.bottom
  )
    decide(card, 'add')
}

export async function refreshRecommendationSettings(
  deps: BuilderInteractionDeps,
  previewRole = deps.focusedRole,
) {
  if (!deps.recommendationOptionsChanged || deps.recommendationState === 'loading') return
  if (deps.recommendationRefreshInFlight.current) return
  deps.recommendationRefreshInFlight.current = true
  try {
    const batch = focusedRecommendations<Card>(deps.queue, deps.focusedRole, rolesForCard).slice(
      0,
      4,
    )
    const progress: RecommendationProgress = {
      batchNumber: deps.batchNumber,
      deferredCards: [
        ...deps.deferredCards,
        ...deferBatch(
          batch.filter((card) => deps.decisions[card.name] === 'later'),
          deps.decisions,
          deps.batchNumber,
          (card) => card.name,
        ),
      ],
      preferenceScores: updatePreferenceScores(
        batch,
        deps.decisions,
        deps.liked,
        deps.preferenceScores,
        deps.ignoreReasons,
        [deps.theme, ...deps.activeSubThemes],
      ),
    }
    deps.setPreferenceScores(progress.preferenceScores)
    deps.setDeferredCards(progress.deferredCards)
    deps.setDecisions({})
    deps.setIgnoreReasons?.({})
    deps.setLiked((current: string[]) =>
      current.filter((name) => !batch.some((card) => card.name === name)),
    )
    if (deps.recommendationPoolKey.current !== recommendationPoolKey(deps)) {
      await deps.start(deps.commander, true, progress)
      return
    }
    const excluded = new Set([
      ...deps.ignoredCards,
      ...[...deps.deck, ...deps.sideboard].map((card: Card) => card.name),
      ...progress.deferredCards.map(({ card }) => card.name),
    ])
    // Refresh the preview without spending undecided cards or advancing the waiting period.
    const candidates: Card[] = deps.queue.filter((card: Card) => !excluded.has(card.name))
    const context = buildRecommendationContext({ ...deps, ...progress }, candidates)
    const queue = rankRecommendationCards(candidates, context, deps.includeCreature, rolesForCard)
    deps.setQueue(queue)
    deps.setRecommendationOptionsChanged(false)
    deps.setBatchAnnouncement(`Recommendations updated for batch ${progress.batchNumber}.`)
    void deps.loadPrintings(
      focusedRecommendations(queue, previewRole, rolesForCard).slice(0, 8),
      deps.collectionSets[0] || deps.preferredPrintSet,
    )
  } finally {
    deps.recommendationRefreshInFlight.current = false
  }
}

export async function chooseRoleFocus(deps: BuilderInteractionDeps, role: TargetKey | null) {
  if (deps.recommendationState !== 'idle' || deps.recommendationRefreshInFlight.current) return
  const nextRole = role === deps.focusedRole ? null : role
  await refreshRecommendationSettings({ ...deps, recommendationOptionsChanged: true }, nextRole)
  deps.setFocusedRole(nextRole)
  deps.setBatchAnnouncement(
    nextRole ? `Recommendations focused on ${nextRole}.` : 'Recommendation focus cleared.',
  )
}

export async function clearCompletedRoleFocus(deps: BuilderInteractionDeps) {
  const role: TargetKey | null = deps.focusedRole
  if (
    role &&
    deps.recommendationState === 'idle' &&
    !deps.recommendationOptionsChanged &&
    analyseDeck(deps.deck).counts[role] >= deps.deckTargets[role]
  )
    await chooseRoleFocus(deps, null)
}

export async function nextBatch(deps: BuilderInteractionDeps, extraSubTheme = '') {
  if (deps.recommendationOptionsChanged) {
    await refreshRecommendationSettings(deps)
    return
  }
  const {
    queue,
    preferenceScores,
    deferredCards,
    batchNumber,
    decisions,
    liked,
    activeSubThemes,
    theme,
    includeCreature,
    recommendationStyle,
    collectionSets,
    collectionMode,
    setPreferenceScores,
    setDeferredCards,
    setBatchNumber,
    setQueue,
    setDecisions,
    setLiked,
    setBatchAnnouncement,
    preferredPrintSet,
    loadPrintings,
  } = deps
  const batch = focusedRecommendations<Card>(queue, deps.focusedRole, rolesForCard).slice(0, 4)
  const { roleBoosts, pickedTags, manaSupport } = buildRecommendationContext(deps, queue)
  const next = advanceRecommendationQueue<Card>({
    queue,
    deferredCards,
    batchNumber,
    decisions,
    liked,
    preferenceScores,
    pickedTags,
    activeSubThemes,
    extraSubTheme,
    theme,
    includeCreature,
    roleBoosts,
    cardRoles: (card: any) => rolesForCard(card),
    manaSupport,
    recommendationStyle: recommendationStyle as RecommendationStyle,
    collectionSets,
    collectionMode: collectionMode as CollectionMode,
    maxPrice: deps.maxPrice,
    focusedRole: deps.focusedRole,
    ignoreReasons: deps.ignoreReasons as Record<string, IgnoreReason>,
  })
  setPreferenceScores(next.preferenceScores)
  setDeferredCards(next.deferredCards)
  setBatchNumber(next.batchNumber)
  setQueue(next.queue)
  setDecisions({})
  deps.setIgnoreReasons?.({})
  setLiked((current: string[]) =>
    current.filter((name) => !batch.some((card: Card) => card.name === name)),
  )
  const focusedQueue = focusedRecommendations(next.queue, deps.focusedRole, rolesForCard)
  setBatchAnnouncement(
    focusedQueue.length
      ? `Recommendation batch ${next.batchNumber} loaded: ${focusedQueue
          .slice(0, 4)
          .map((card) => card.name)
          .join(', ')}.`
      : 'No recommendations currently eligible. Deferred cards will return after their waiting period.',
  )
  void loadPrintings(focusedQueue.slice(0, 8), collectionSets[0] || preferredPrintSet)
}
