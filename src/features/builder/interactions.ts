import type { MouseEvent } from 'react'

import { focusedRecommendations } from '../../domain/recommendation-tuning.ts'
import { rolesForCard, targetLabels, type TargetKey } from '../../deck-analysis.ts'
import { builderAction, type BuilderActionHost } from '../../app/builder-action.ts'
import type { BuilderAction, BuilderActionResult } from '../../domain/builder-state.ts'
import type { RecommendationProgress } from '../../app/recommendation-actions.ts'
import type { Card, ScryfallCard } from '../../domain/card-model.ts'
import { type CollectionMode } from '../../recommendations.ts'
export function mergeSearchCards(
  current: ScryfallCard[],
  incoming: ScryfallCard[],
  replace: boolean,
) {
  return [
    ...new Map(
      [...(replace ? [] : current), ...incoming].map((card) => [card.name, card]),
    ).values(),
  ]
}

export type BuilderInteractionDeps = Record<string, any> &
  BuilderActionHost & {
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
    const image = card.querySelector('.offered-image')?.getBoundingClientRect()
    // No lift while the pointer is above the art, so it never rises into the decision buttons.
    const proximity =
      image && event.clientY < image.top
        ? 0
        : Math.max(0, 1 - Math.abs(event.clientX - (left + width / 2)) / Math.max(width * 1.5, 1))
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

async function settleInteractionSettings(
  deps: BuilderInteractionDeps,
  result: BuilderActionResult,
  previewRole = result.state.focusedRole,
) {
  const next = result.state
  if (result.fetchRequests.length) {
    deps.setPendingSubThemes?.([])
    await deps.start(deps.commander, true, {
      batchNumber: next.batchNumber,
      deferredCards: next.deferredCards,
      preferenceScores: next.preferenceScores,
    })
    return
  }
  deps.setBatchAnnouncement(`Recommendations updated for batch ${next.batchNumber}.`)
  void deps.loadPrintings(
    focusedRecommendations(next.queue, previewRole, rolesForCard).slice(0, 8),
    next.collectionSets[0] || next.preferredPrintSet,
  )
}

async function commitInteractionSettings(
  deps: BuilderInteractionDeps,
  action: BuilderAction,
  previewRole = deps.focusedRole,
) {
  if (deps.recommendationState === 'loading' || deps.recommendationRefreshInFlight.current) return
  deps.recommendationRefreshInFlight.current = true
  try {
    const before = deps.getBuilderState()
    const result = builderAction(deps, action)
    if (result.state !== before) await settleInteractionSettings(deps, result, previewRole)
  } finally {
    deps.recommendationRefreshInFlight.current = false
  }
}

export async function refreshRecommendationSettings(
  deps: BuilderInteractionDeps,
  previewRole = deps.focusedRole,
) {
  if (!deps.getBuilderState().recommendationOptionsChanged) return
  await commitInteractionSettings(deps, { type: 'commitSettings' }, previewRole)
}

export async function chooseRoleFocus(deps: BuilderInteractionDeps, role: TargetKey | null) {
  if (deps.recommendationState !== 'idle' || deps.recommendationRefreshInFlight.current) return
  const nextRole = role === deps.focusedRole ? null : role
  await commitInteractionSettings(deps, { type: 'focus', role }, nextRole)
  deps.setBatchAnnouncement(
    nextRole ? `Recommendations focused on ${targetLabels[nextRole]}.` : 'Role focus cleared.',
  )
}

export async function clearCompletedRoleFocus(deps: BuilderInteractionDeps) {
  if (deps.recommendationState !== 'idle') return
  const role = deps.getBuilderState().focusedRole
  await commitInteractionSettings(deps, { type: 'completeFocus' }, null)
  if (role && !deps.getBuilderState().focusedRole) deps.setBatchAnnouncement('Role focus cleared.')
}

export async function nextBatch(deps: BuilderInteractionDeps, extraSubTheme = '') {
  if (deps.recommendationState === 'loading' || deps.recommendationRefreshInFlight.current) return
  deps.recommendationRefreshInFlight.current = true
  try {
    const before = deps.getBuilderState()
    // Sub-theme changes wait here so the current batch stays on screen until the user moves on.
    const result = builderAction(deps, { type: 'nextBatch', extraSubTheme })
    const next = result.state
    if (next.batchNumber === before.batchNumber) {
      await settleInteractionSettings(deps, result)
      return
    }
    const focusedRole = next.focusedRole
    const focusedQueue = focusedRecommendations(next.queue, focusedRole, rolesForCard)
    const focusedRoleName = focusedRole
      ? targetLabels[focusedRole].toLowerCase().replace(/s$/, '')
      : ''
    deps.setBatchAnnouncement(
      focusedQueue.length
        ? `Recommendation batch ${next.batchNumber} loaded: ${focusedQueue
            .slice(0, 4)
            .map((card) => card.name)
            .join(', ')}.`
        : focusedRole
          ? `No more ${focusedRoleName} suggestions right now.`
          : 'No recommendations currently eligible. Deferred cards will return after their waiting period.',
    )
    void deps.loadPrintings(
      focusedQueue.slice(0, 8),
      next.collectionSets[0] || next.preferredPrintSet,
    )
  } finally {
    deps.recommendationRefreshInFlight.current = false
  }
}
