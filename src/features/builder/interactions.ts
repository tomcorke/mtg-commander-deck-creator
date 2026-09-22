import type { MouseEvent } from 'react'

import { analyseDeck, deckRoleBoosts, rolesForCard } from '../../deck-analysis.ts'
import type { Card } from '../../domain/card-model.ts'
import { commanderNames } from '../../domain/commander-catalog.ts'
import {
  advanceRecommendationQueue,
  type CollectionMode,
  type RecommendationStyle,
} from '../../recommendations.ts'
export type BuilderInteractionDeps = Record<string, any> & {
  start: (name: string, preserveDeck?: boolean) => Promise<boolean>
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

export async function nextBatch(deps: BuilderInteractionDeps, extraSubTheme = '') {
  const {
    recommendationOptionsChanged,
    start,
    commander,
    setRecommendationOptionsChanged,
    queue,
    deck,
    prioritizeDeckHealth,
    deckTargets,
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
  if (recommendationOptionsChanged) {
    if (await start(commander, true)) setRecommendationOptionsChanged(false)
    return
  }
  const batch: Card[] = queue.slice(0, 4)
  const analysis = analyseDeck(deck)
  const roleBoosts: Record<string, number> = prioritizeDeckHealth
    ? deckRoleBoosts(deck.length, analysis.counts, deckTargets)
    : {}
  roleBoosts.lands = 0
  const pickedTags = new Set([
    ...deck.slice(commanderNames(commander).length).flatMap((card: Card) => card.tags),
    ...Object.entries(preferenceScores as Record<string, number>)
      .filter(([, score]) => score > 0)
      .map(([tag]) => tag),
  ])
  const next = advanceRecommendationQueue({
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
    recommendationStyle: recommendationStyle as RecommendationStyle,
    collectionSets,
    collectionMode: collectionMode as CollectionMode,
  })
  setPreferenceScores(next.preferenceScores)
  setDeferredCards(next.deferredCards)
  setBatchNumber(next.batchNumber)
  setQueue(next.queue)
  setDecisions({})
  setLiked((current: string[]) =>
    current.filter((name) => !batch.some((card: Card) => card.name === name)),
  )
  setBatchAnnouncement(
    next.queue.length
      ? `Recommendation batch ${next.batchNumber} loaded: ${next.queue
          .slice(0, 4)
          .map((card) => card.name)
          .join(', ')}.`
      : 'No recommendations currently eligible. Deferred cards will return after their waiting period.',
  )
  void loadPrintings(next.queue.slice(0, 8), collectionSets[0] || preferredPrintSet)
}
