import { useRef, useState } from 'react'

import { loadSavedDecks, type PersistedDeckState } from '../deck-state.ts'
import type { AppHistoryState, AppModal } from './routes.ts'
import { usePendingConfirmation, useStoredOption } from '../shared/hooks.ts'
export function useUiState(
  saved: PersistedDeckState | null,
  initialRoute: Pick<AppHistoryState, 'view' | 'modal'> | null,
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
  const [cardEffects, setCardEffects] = useStoredOption('cardEffects', () => true)
  const [recommendationOptionsChanged, setRecommendationOptionsChanged] = useState(false)
  const [savedDecks, setSavedDecks] = useState(loadSavedDecks)
  const [activeSavedDeckId, setActiveSavedDeckId] = useState(saved?.savedDeckId ?? '')
  const [deckName, setDeckName] = useState(
    () => loadSavedDecks().find(({ id }) => id === saved?.savedDeckId)?.name ?? '',
  )
  const [pendingSavedDeckRemoval, setPendingSavedDeckRemoval] = usePendingConfirmation('')
  const [importSource, setImportSource] = useState('')
  const [importState, setImportState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [importError, setImportError] = useState('')
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
    cardEffects,
    setCardEffects,
    recommendationOptionsChanged,
    setRecommendationOptionsChanged,
    savedDecks,
    setSavedDecks,
    activeSavedDeckId,
    setActiveSavedDeckId,
    deckName,
    setDeckName,
    pendingSavedDeckRemoval,
    setPendingSavedDeckRemoval,
    importSource,
    setImportSource,
    importState,
    setImportState,
    importError,
    setImportError,
    historyReady,
  }
}

export type UiState = ReturnType<typeof useUiState>
