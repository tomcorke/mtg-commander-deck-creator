import { useEffect, useRef, useState } from 'react'

import type { PersistedDeckState } from '../deck-state.ts'
import type { Card } from '../domain/card-model.ts'
import type { DeferredCard, PowerTarget } from '../recommendations.ts'
import { useStoredOption } from '../shared/hooks.ts'

function useEdhrecRetryState() {
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
    edhrecRetryAttempt,
    setEdhrecRetryAttempt,
    edhrecRetryRemaining,
    setEdhrecRetryRemaining,
    edhrecRetryInFlight,
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
  const edhrecRetry = useEdhrecRetryState()
  const [recommendationStyle, setRecommendationStyle] = useStoredOption<
    'story' | 'balanced' | 'optimized'
  >('recommendationStyle', () => saved?.recommendationStyle ?? 'balanced')
  const [prioritizeDeckHealth, setPrioritizeDeckHealth] = useState(
    saved?.prioritizeDeckHealth ?? true,
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
  const [decisions, setDecisions] = useState<Record<string, 'add' | 'later' | 'ignore'>>({})
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
    ...edhrecRetry,
    recommendationStyle,
    setRecommendationStyle,
    prioritizeDeckHealth,
    setPrioritizeDeckHealth,
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
