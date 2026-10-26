import { useEffect, useRef, useState } from 'react'

export function useRecommendationState(initialLimitedRecommendations = false) {
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
    initialLimitedRecommendations,
  )
  const [showSubThemePicker, setShowSubThemePicker] = useState(false)
  const [subThemeSearch, setSubThemeSearch] = useState('')
  const [batchAnnouncement, setBatchAnnouncement] = useState('')
  return {
    signatureEpoch,
    setSignatureEpoch,
    edhrecRetryAttempt,
    setEdhrecRetryAttempt,
    edhrecRetryRemaining,
    setEdhrecRetryRemaining,
    edhrecRetryInFlight,
    recommendationState,
    setRecommendationState,
    recommendationLoadingStep,
    setRecommendationLoadingStep,
    recommendationLoadingTitle,
    setRecommendationLoadingTitle,
    limitedRecommendations,
    setLimitedRecommendations,
    showSubThemePicker,
    setShowSubThemePicker,
    subThemeSearch,
    setSubThemeSearch,
    batchAnnouncement,
    setBatchAnnouncement,
  }
}

export type RecommendationState = ReturnType<typeof useRecommendationState>
