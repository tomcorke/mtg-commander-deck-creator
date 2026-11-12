import { useCallback, useRef, useState } from 'react'

import { loadSavedDecks, type PersistedDeckState } from '../deck-state.ts'
import type { AppHistoryState, AppModal } from './routes.ts'
import { usePendingConfirmation, useStoredOption } from '../shared/hooks.ts'
export function useUiState(
  saved: PersistedDeckState | null,
  initialRoute: Pick<AppHistoryState, 'view' | 'modal'> | null,
  initialDeckName?: string,
) {
  const [showBuilder, setShowBuilder] = useState(
    () => (initialRoute?.view ?? (saved?.commander ? 'builder' : 'start')) === 'builder',
  )
  const [activeModal, setActiveModal] = useState<AppModal | null>(() => initialRoute?.modal ?? null)
  const [darkMode, setDarkMode] = useStoredOption(
    'darkMode',
    () => localStorage.getItem('theme') !== 'light',
  )
  const [commanderStyling, setCommanderStyling] = useStoredOption('commanderStyling', () => true)
  const [cardReveals, setCardReveals] = useStoredOption('cardReveals', () => true)
  const [cardEffects, setCardEffects] = useStoredOption('cardEffects', () => true)
  const [previewScale, setPreviewScale] = useStoredOption('previewScale', () => 1)
  const [pendingSubThemes, setPendingSubThemes] = useState<string[]>([])
  const pendingReviewChanges = useRef(false)
  const setPendingReviewChanges = useCallback((pending: boolean) => {
    pendingReviewChanges.current = pending
  }, [])
  const reviewNavigation = useRef<'back' | 'hash' | (() => void) | null>(null)
  const reviewNavigationAllowed = useRef(false)
  const [showReviewExitPrompt, setShowReviewExitPrompt] = useState(false)
  const [savedDecks, setSavedDecks] = useState(loadSavedDecks)
  const [activeSavedDeckId, setActiveSavedDeckId] = useState(saved?.savedDeckId ?? '')
  const [deckName, setDeckName] = useState(
    () =>
      initialDeckName ?? loadSavedDecks().find(({ id }) => id === saved?.savedDeckId)?.name ?? '',
  )
  const [pendingSavedDeckRemoval, setPendingSavedDeckRemoval] = usePendingConfirmation('')
  const historyReady = useRef(false)

  return {
    showBuilder,
    setShowBuilder,
    activeModal,
    setActiveModal,
    darkMode,
    setDarkMode,
    commanderStyling,
    setCommanderStyling,
    cardReveals,
    setCardReveals,
    cardEffects,
    setCardEffects,
    previewScale,
    setPreviewScale,
    ...useFirstUseState(saved),
    pendingSubThemes,
    setPendingSubThemes,
    pendingReviewChanges,
    setPendingReviewChanges,
    reviewNavigation,
    reviewNavigationAllowed,
    showReviewExitPrompt,
    setShowReviewExitPrompt,
    savedDecks,
    setSavedDecks,
    activeSavedDeckId,
    setActiveSavedDeckId,
    deckName,
    setDeckName,
    pendingSavedDeckRemoval,
    setPendingSavedDeckRemoval,
    historyReady,
    ...useImportState(),
  }
}

/** New-deck setup: the play-style step, the first batch, and the optional guide. */
function useFirstUseState(saved: PersistedDeckState | null) {
  const [awaitingPlayStyle, setAwaitingPlayStyle] = useState(saved?.playStylePending ?? false)
  // The batch on which Skip kept the current settings; its summary says so until the next batch.
  const [playStyleSkippedBatch, setPlayStyleSkippedBatch] = useState<number | null>(null)
  const [firstBatchPending, setFirstBatchPending] = useState(saved?.firstBatchPending ?? false)
  const [showIntroGuide, setShowIntroGuide] = useState(false)
  const [introGuideRequested, setIntroGuideRequested] = useStoredOption(
    'introGuideRequested',
    () => true,
    (value) => value === true,
  )
  const [newDeckGuidePending, setNewDeckGuidePending] = useState(false)
  const [firstBatchFocusPending, setFirstBatchFocusPending] = useState(false)
  const resetFirstUse = useCallback(() => {
    setAwaitingPlayStyle(false)
    setPlayStyleSkippedBatch(null)
    setShowIntroGuide(false)
    setNewDeckGuidePending(false)
    setFirstBatchFocusPending(false)
    setFirstBatchPending(false)
  }, [])
  return {
    awaitingPlayStyle,
    setAwaitingPlayStyle,
    playStyleSkippedBatch,
    setPlayStyleSkippedBatch,
    resetFirstUse,
    firstBatchPending,
    setFirstBatchPending,
    showIntroGuide,
    setShowIntroGuide,
    introGuideRequested,
    setIntroGuideRequested,
    newDeckGuidePending,
    setNewDeckGuidePending,
    firstBatchFocusPending,
    setFirstBatchFocusPending,
  }
}

function useImportState() {
  const [importSource, setImportSource] = useState('')
  const [importState, setImportState] = useState<'idle' | 'loading' | 'error' | 'missing'>('idle')
  const [importError, setImportError] = useState('')
  const [importFoundCount, setImportFoundCount] = useState(0)
  return {
    importSource,
    setImportSource,
    importState,
    setImportState,
    importError,
    setImportError,
    importFoundCount,
    setImportFoundCount,
  }
}

export type UiState = ReturnType<typeof useUiState>
