import { useEffect, useEffectEvent, useLayoutEffect, useState } from 'react'
import { buildRecommendationContext } from './recommendation-context.ts'
import { loadSignatureResults } from './signature-actions.ts'
import {
  cardNameKey,
  mergeSignatureResults,
  selectSignatureSeeds,
  type SignatureResult,
} from '../domain/signature-recommendations.ts'
import type { ControllerState } from './useControllerState.ts'

export function signatureContextKey(state: ControllerState) {
  return JSON.stringify([
    state.signatureDeckKey,
    state.signatureEpoch,
    state.commander,
    state.deck.map(({ name }) => name),
    state.sideboard.map(({ name }) => name),
    state.ignoredCards,
    state.theme,
    state.activeSubThemes,
    state.recommendationStyle,
    state.prioritizeDeckHealth,
    state.deckTargets,
    state.includeCreature,
    state.powerTarget,
    state.excludeGameChangers,
    state.excludeTutors,
    state.excludeExtraTurns,
    state.excludeUnreleased,
    state.collectionMode,
    state.collectionSets,
    state.commanderDetails?.colours,
    state.recommendationOptionsChanged,
  ])
}

export function useSignatureRecommendations(state: ControllerState) {
  const [completed, setCompleted] = useState<{ key: string; results: SignatureResult[] } | null>(
    null,
  )
  const enabled =
    state.showBuilder &&
    state.recommendationState === 'idle' &&
    !state.recommendationOptionsChanged &&
    Boolean(state.commanderDetails) &&
    state.deck.length < 100 &&
    state.queue.length >= 4
  const seeds = selectSignatureSeeds(
    state.commander,
    state.deck,
    buildRecommendationContext(state.currentDeckState ?? {}, state.queue),
  )
  const seedKey = JSON.stringify(seeds.map((seed) => [seed.card.name, seed.theme, seed.page]))
  const key = JSON.stringify([signatureContextKey(state), seedKey])
  const load = useEffectEvent(async (jobKey: string, signal: AbortSignal) => {
    if (key !== jobKey) return
    const excluded = new Set(
      [
        ...state.deck,
        ...state.sideboard,
        ...state.queue,
        ...state.deferredCards.map(({ card }) => card),
      ]
        .map(({ name }) => cardNameKey(name))
        .concat(state.ignoredCards.map(cardNameKey)),
    )
    const results = await loadSignatureResults(state.signatureDeckKey, seeds, excluded, signal)
    if (!signal.aborted) setCompleted({ key: jobKey, results })
  })
  useEffect(() => {
    if (!enabled || seedKey === '[]') return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void load(key, controller.signal).catch(() => undefined)
    }, 2000)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, seedKey, enabled])

  // Apply after React commits: a response racing a deck switch sees the new context, not a stale closure.
  useLayoutEffect(() => {
    if (!completed || completed.key !== key || !enabled) return
    state.setQueue((queue) => mergeSignatureResults(queue, completed.results, state))
  }, [completed, enabled, key, state])
}
