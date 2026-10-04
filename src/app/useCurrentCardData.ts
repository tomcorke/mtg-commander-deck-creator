import { useEffect, useEffectEvent } from 'react'
import type { Card, DeckCard, ScryfallCard } from '../domain/card-model.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { applyCurrentCardData, cardDataKey, refreshCardData } from '../domain/current-card-data.ts'
import type { ControllerState } from './useControllerState.ts'

function applyRefreshedData(state: ControllerState, results: ReadonlyMap<string, ScryfallCard>) {
  const update = <T extends DeckCard>(card: T): T =>
    card.dataStatus === 'pending' ? applyCurrentCardData(card, results) : card
  state.setDeck((current) => current.map(update))
  state.setSideboard((current) => current.map(update))
  state.setQueue((current: Card[]) => current.map(update))
  state.setDeferredCards((current) =>
    current.map((entry) => ({ ...entry, card: update(entry.card) })),
  )
  const commanders = state.deck.slice(0, commanderNames(state.commander).length).map(update)
  if (commanders.every((card) => card.colorIdentity && !card.dataStatus))
    state.setCommanderDetails((current) =>
      current
        ? {
            ...current,
            colours: [...new Set(commanders.flatMap((card) => card.colorIdentity!))],
          }
        : current,
    )
}

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
      applyRefreshedData(state, results)
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
