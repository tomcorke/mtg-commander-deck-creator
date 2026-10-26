import { useEffect, useEffectEvent } from 'react'
import type { ScryfallCard } from '../domain/card-model.ts'
import { cardDataKey, refreshCardData } from '../domain/current-card-data.ts'
import type { ControllerState } from './useControllerState.ts'

export function useCurrentCardData(state: ControllerState) {
  const cards = [
    ...state.deck,
    ...state.sideboard,
    ...state.queue.slice(0, 4),
    ...state.deferredCards.map(({ card }) => card),
    ...state.queue.slice(4),
  ].filter((card) => card.dataStatus === 'pending')
  const pendingKey = [...new Set(cards.map(cardDataKey))].sort().join('|')
  const workspaceId = state.autosave.id
  const finish = useEffectEvent(
    (
      commander: string,
      id: string,
      signal: AbortSignal,
      results: ReadonlyMap<string, ScryfallCard>,
    ) => {
      if (
        signal.aborted ||
        state.workspace.getSnapshot().id !== id ||
        state.commander !== commander
      )
        return
      state.dispatchBuilder({ type: 'hydrate', results: [...results] })
    },
  )
  const refresh = useEffectEvent(async (id: string, signal: AbortSignal) => {
    if (!cards.length) return
    const commander = state.commander
    const results = await refreshCardData(cards, signal)
    finish(commander, id, signal, results)
  })
  useEffect(() => {
    if (!pendingKey) return
    const controller = new AbortController()
    void refresh(workspaceId, controller.signal).catch(() => undefined)
    return () => controller.abort()
  }, [workspaceId, pendingKey])
}
