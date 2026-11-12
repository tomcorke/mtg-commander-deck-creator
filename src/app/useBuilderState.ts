import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersistedDeckState } from '../deck-state.ts'
import { builderPoolKey } from '../domain/builder-settings.ts'
import { restoreBuilderState } from './builder-restore.ts'
import { applyBuilderAction, type BuilderAction } from '../domain/builder-state.ts'
import {
  migrateRecommendationPriority,
  normalizeMaxPrice,
} from '../domain/recommendation-tuning.ts'
import { normalizeRecommendationStyle, type PowerTarget } from '../domain/recommendation-types.ts'
import { isOwnershipMode, ownedQuantities, readOwnedCardList } from '../domain/owned-cards.ts'
import { appStorage } from '../app-storage.ts'

const storedFields = [
  'recommendationStyle',
  'maxPrice',
  'deckBudget',
  'ownershipMode',
  'includeCreature',
  'powerTarget',
  'excludeGameChangers',
  'limitGameChangers',
  'excludeTutors',
  'excludeExtraTurns',
  'excludeUnreleased',
] as const

const isPowerTarget = (value: unknown): value is PowerTarget =>
  value === 'precon' || value === 'upgraded' || value === 'high'

function storedRecommendationStyle(value: unknown, saved: PersistedDeckState | null) {
  return migrateRecommendationPriority(
    value,
    saved?.recommendationStyle === normalizeRecommendationStyle(value)
      ? saved.prioritizeDeckHealth
      : undefined,
  )
}

/** A stored option's value, or undefined when it is not valid for that field. */
function storedOption(
  field: (typeof storedFields)[number],
  value: unknown,
  saved: PersistedDeckState | null,
) {
  if (field === 'recommendationStyle') return storedRecommendationStyle(value, saved)
  if (field === 'maxPrice' || field === 'deckBudget') return normalizeMaxPrice(value)
  if (field === 'powerTarget') return isPowerTarget(value) ? value : undefined
  if (field === 'ownershipMode') return isOwnershipMode(value) ? value : undefined
  return typeof value === 'boolean' ? value : undefined
}

function initialBuilderState(saved: PersistedDeckState | null) {
  const state = restoreBuilderState(
    saved,
    new Date().toISOString().slice(0, 10),
    saved?.savedDeckId || crypto.randomUUID(),
  )
  for (const field of storedFields) {
    try {
      const stored = localStorage.getItem(`option:${field}`)
      if (stored === null) continue
      const value = storedOption(field, JSON.parse(stored), saved)
      if (value !== undefined) Object.assign(state, { [field]: value })
    } catch {
      /* Storage is optional; use the resolved defaults. */
    }
  }
  // Owned cards are the player's, kept apart from any deck.
  const owned = readOwnedCardList(appStorage)
  state.ownedCards = ownedQuantities(owned)
  state.ownedRevision = owned?.updatedAt ?? ''
  return { ...state, committedPoolKey: builderPoolKey(state) }
}

export function useBuilderState(saved: PersistedDeckState | null) {
  const [builderState, setBuilderState] = useState(() => initialBuilderState(saved))
  const currentBuilder = useRef(builderState)
  const getBuilderState = useCallback(() => currentBuilder.current, [])
  const dispatchBuilder = useCallback((action: BuilderAction) => {
    const result = applyBuilderAction(currentBuilder.current, action)
    currentBuilder.current = result.state
    setBuilderState(() => result.state)
    return result
  }, [])
  const writtenOptions = useRef(new Map<string, string>())
  useEffect(() => {
    for (const field of storedFields) {
      try {
        const value = JSON.stringify(builderState[field])
        if (writtenOptions.current.get(field) === value) continue
        localStorage.setItem(`option:${field}`, value)
        writtenOptions.current.set(field, value)
      } catch {
        /* Storage is optional. */
      }
    }
  }, [builderState])
  return {
    ...builderState,
    builderState,
    getBuilderState,
    dispatchBuilder,
    prioritizeDeckHealth: builderState.recommendationStyle !== 'thematic',
  }
}
