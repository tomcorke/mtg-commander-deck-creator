import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { buildRecommendationContext } from './recommendation-context.ts'
import {
  completeSignatureResults,
  loadSignatureResults,
  signatureRetryAt,
  watchSignatureResults,
} from './signature-actions.ts'
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

const observeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}

export function useSignatureRecommendations(state: ControllerState) {
  const visible = useSyncExternalStore(observeVisibility, () => !document.hidden)
  const [completed, setCompleted] = useState<{ key: string; results: SignatureResult[] } | null>(
    null,
  )
  const enabled =
    visible &&
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
    if (key !== jobKey || !enabled || document.hidden) return Infinity
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
    if (!signal.aborted && results.length) setCompleted({ key: jobKey, results })
    return signatureRetryAt(state.signatureDeckKey, seeds)
  })
  useEffect(() => {
    if (!enabled || seedKey === '[]') return
    const controller = new AbortController()
    const pause = () => {
      if (document.hidden) controller.abort()
    }
    document.addEventListener('visibilitychange', pause)
    watchSignatureResults(() => load(key, controller.signal), controller.signal)
    return () => {
      document.removeEventListener('visibilitychange', pause)
      controller.abort()
    }
  }, [key, seedKey, enabled])

  const applied = useRef(completed)
  // Apply after React commits: a response racing a deck switch sees the new context, not a stale closure.
  useLayoutEffect(() => {
    if (!completed || completed.key !== key || !enabled || applied.current === completed) return
    applied.current = completed // Apply once; a later queue removal must not resurrect these cards.
    state.setQueue((queue) => mergeSignatureResults(queue, completed.results, state))
    completeSignatureResults(state.signatureDeckKey, completed.results)
  }, [completed, enabled, key, state])
}
