import { useEffect, useMemo, useState } from 'react'
import { loadComboIndex } from '../../adapters/combo-index.ts'
import type { DeckCard } from '../../domain/card-model.ts'
import {
  findDeckCombos,
  type ComboIndex,
  type ComboIndexMetadata,
  type DeckCombos,
} from '../../domain/combo-index.ts'

export type DeckComboState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; metadata: ComboIndexMetadata; matches: DeckCombos }

/** Loads Spellbook combo data once, then matches the current main deck (sideboard excluded). */
export function useDeckCombos(
  deck: DeckCard[],
  commanderCount: number,
  commanderColours: string[],
): DeckComboState {
  const [index, setIndex] = useState<ComboIndex | null | undefined>()
  useEffect(() => {
    let current = true
    loadComboIndex().then(
      (loaded) => current && setIndex(loaded),
      () => current && setIndex(null),
    )
    return () => {
      current = false
    }
  }, [])
  return useMemo(() => {
    if (index === undefined) return { status: 'loading' }
    if (index === null) return { status: 'unavailable' }
    return {
      status: 'ready',
      metadata: index.metadata,
      matches: findDeckCombos(index, {
        commanders: deck.slice(0, commanderCount),
        cards: deck.slice(commanderCount),
        identity: commanderColours,
      }),
    }
  }, [index, deck, commanderCount, commanderColours])
}
