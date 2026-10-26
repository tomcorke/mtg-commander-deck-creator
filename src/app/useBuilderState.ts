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

const storedFields = [
  'recommendationStyle',
  'maxPrice',
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
      const value: unknown = JSON.parse(stored)
      if (field === 'recommendationStyle') state[field] = storedRecommendationStyle(value, saved)
      else if (field === 'maxPrice') state[field] = normalizeMaxPrice(value)
      else if (field === 'powerTarget') {
        if (isPowerTarget(value)) state[field] = value
      } else if (typeof value === 'boolean') state[field] = value
    } catch {
      /* Storage is optional; use the resolved defaults. */
    }
  }
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
