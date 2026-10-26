import { gameChangersAtLimit } from './play-style.ts'
import type { BuilderState } from './builder-state.ts'

type PoolSettings = Pick<
  BuilderState,
  | 'commander'
  | 'powerTarget'
  | 'maxPrice'
  | 'excludeGameChangers'
  | 'limitGameChangers'
  | 'excludeTutors'
  | 'excludeExtraTurns'
  | 'excludeUnreleased'
  | 'theme'
  | 'activeSubThemes'
  | 'collectionMode'
  | 'collectionSets'
  | 'deck'
>

/** Settings that decide which cards are fetched; other settings only re-rank the pool. */
export function builderPoolKey(settings: Partial<PoolSettings>) {
  return JSON.stringify([
    settings.commander,
    settings.powerTarget,
    settings.maxPrice ?? null,
    settings.excludeGameChangers ||
      Boolean(settings.limitGameChangers && gameChangersAtLimit(settings.deck ?? [])),
    settings.excludeTutors,
    settings.excludeExtraTurns,
    settings.excludeUnreleased,
    settings.theme,
    [...(settings.activeSubThemes ?? [])].sort(),
    settings.collectionMode ?? 'none',
    [...(settings.collectionSets ?? [])].sort(),
  ])
}
