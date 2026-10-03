import { useEffect, useRef, useState } from 'react'

import { restoredRecommendationDecisions, type PersistedDeckState } from '../deck-state.ts'
import type { Card } from '../domain/card-model.ts'
import {
  normalizeRecommendationStyle,
  type DeferredCard,
  type PowerTarget,
  type RecommendationStyle,
} from '../recommendations.ts'
import {
  migrateRecommendationPriority,
  normalizeMaxPrice,
  type IgnoreReason,
} from '../domain/recommendation-tuning.ts'
import type { TargetKey } from '../deck-analysis.ts'
import { useStoredOption } from '../shared/hooks.ts'

function useEdhrecRequestState(savedDeckId: string) {
  const [signatureDeckKey, setSignatureDeckKey] = useState(() => savedDeckId || crypto.randomUUID())
  const [signatureEpoch, setSignatureEpoch] = useState(0)
  const [edhrecRetryAttempt, setEdhrecRetryAttempt] = useState(0)
  const [edhrecRetryRemaining, setEdhrecRetryRemaining] = useState(0)
  const edhrecRetryInFlight = useRef(false)
  useEffect(() => {
    if (edhrecRetryRemaining <= 0) return
    const timer = window.setTimeout(
      () => setEdhrecRetryRemaining((remaining) => Math.max(0, remaining - 1)),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [edhrecRetryRemaining])
  return {
    signatureDeckKey,
    setSignatureDeckKey,
    signatureEpoch,
    setSignatureEpoch,
    edhrecRetryAttempt,
    setEdhrecRetryAttempt,
    edhrecRetryRemaining,
    setEdhrecRetryRemaining,
    edhrecRetryInFlight,
  }
}

function useRecommendationTuning(saved: PersistedDeckState | null) {
  const [recommendationStyle, setRecommendationStyle] = useStoredOption<RecommendationStyle>(
    'recommendationStyle',
    () => migrateRecommendationPriority(saved?.recommendationStyle, saved?.prioritizeDeckHealth),
    (value) =>
      migrateRecommendationPriority(
        value,
        saved?.recommendationStyle === normalizeRecommendationStyle(value)
          ? saved.prioritizeDeckHealth
          : undefined,
      ),
  )
  const prioritizeDeckHealth = recommendationStyle !== 'thematic'
  const [maxPrice, setMaxPrice] = useStoredOption<number | null>(
    'maxPrice',
    () => saved?.maxPrice ?? null,
    normalizeMaxPrice,
  )
  const [focusedRole, setFocusedRole] = useState<TargetKey | null>(null)
  const [ignoreReasons, setIgnoreReasons] = useState<Record<string, IgnoreReason>>(
    saved?.ignoreReasons ?? {},
  )
  return {
    recommendationStyle,
    setRecommendationStyle,
    prioritizeDeckHealth,
    maxPrice,
    setMaxPrice,
    focusedRole,
    setFocusedRole,
    ignoreReasons,
    setIgnoreReasons,
  }
}

export function useRecommendationState(saved: PersistedDeckState | null) {
  const [queue, setQueue] = useState<Card[]>(saved?.queue ?? [])
  const [recommendationState, setRecommendationState] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  )
  const [recommendationLoadingStep, setRecommendationLoadingStep] = useState<
    'commander' | 'recommendations'
  >('commander')
  const [recommendationLoadingTitle, setRecommendationLoadingTitle] = useState(
    'Finding commander details…',
  )
  const [limitedRecommendations, setLimitedRecommendations] = useState(
    saved?.limitedRecommendations ?? false,
  )
  const [includeCreature, setIncludeCreature] = useStoredOption('includeCreature', () => true)
  const [powerTarget, setPowerTarget] = useStoredOption<PowerTarget>('powerTarget', () => 'precon')
  const [excludeGameChangers, setExcludeGameChangers] = useStoredOption(
    'excludeGameChangers',
    () => true,
  )
  const [excludeTutors, setExcludeTutors] = useStoredOption('excludeTutors', () => true)
  const [excludeExtraTurns, setExcludeExtraTurns] = useStoredOption('excludeExtraTurns', () => true)
  const [excludeUnreleased, setExcludeUnreleased] = useStoredOption('excludeUnreleased', () => true)
  const [decisions, setDecisions] = useState(() => restoredRecommendationDecisions(saved))
  const [ignoredCards, setIgnoredCards] = useState<string[]>(saved?.ignoredCards ?? [])
  const [liked, setLiked] = useState<string[]>(saved?.liked ?? [])
  const [activeSubThemes, setActiveSubThemes] = useState<string[]>(saved?.activeSubThemes ?? [])
  const [dismissedSubThemes, setDismissedSubThemes] = useState<string[]>(
    saved?.dismissedSubThemes ?? [],
  )
  const [showSubThemePicker, setShowSubThemePicker] = useState(false)
  const [subThemeSearch, setSubThemeSearch] = useState('')
  const [preferenceScores, setPreferenceScores] = useState<Record<string, number>>(
    saved?.preferenceScores ?? {},
  )
  const [deferredCards, setDeferredCards] = useState<DeferredCard<Card>[]>(
    saved?.deferredCards ?? [],
  )
  const [batchNumber, setBatchNumber] = useState(saved?.batchNumber ?? 1)
  const [batchAnnouncement, setBatchAnnouncement] = useState('')

  return {
    queue,
    setQueue,
    recommendationState,
    setRecommendationState,
    recommendationLoadingStep,
    setRecommendationLoadingStep,
    recommendationLoadingTitle,
    setRecommendationLoadingTitle,
    limitedRecommendations,
    setLimitedRecommendations,
    ...useEdhrecRequestState(saved?.savedDeckId ?? ''),
    ...useRecommendationTuning(saved),
    includeCreature,
    setIncludeCreature,
    powerTarget,
    setPowerTarget,
    excludeGameChangers,
    setExcludeGameChangers,
    excludeTutors,
    setExcludeTutors,
    excludeExtraTurns,
    setExcludeExtraTurns,
    excludeUnreleased,
    setExcludeUnreleased,
    decisions,
    setDecisions,
    ignoredCards,
    setIgnoredCards,
    liked,
    setLiked,
    activeSubThemes,
    setActiveSubThemes,
    dismissedSubThemes,
    setDismissedSubThemes,
    showSubThemePicker,
    setShowSubThemePicker,
    subThemeSearch,
    setSubThemeSearch,
    preferenceScores,
    setPreferenceScores,
    deferredCards,
    setDeferredCards,
    batchNumber,
    setBatchNumber,
    batchAnnouncement,
    setBatchAnnouncement,
  }
}

export type RecommendationState = ReturnType<typeof useRecommendationState>
