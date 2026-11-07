import '../App.css'

import { useMemo, type CSSProperties } from 'react'
import { pendingDeckData } from '../domain/current-card-data.ts'
import type { DeckWorkspace } from '../autosaves.ts'
import { AppView } from './AppView.tsx'
import { readAppRoute } from './routes.ts'
import { useAppActions } from './useAppActions.ts'
import { useControllerState } from './useControllerState.ts'
import { buildBuilderData } from './useBuilderData.ts'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'

const initialAppRoute = typeof window === 'undefined' ? null : readAppRoute()

function App({ workspace }: { workspace: DeckWorkspace }) {
  const savedDeckState = useMemo(
    () => (workspace.initialState ? pendingDeckData(workspace.initialState) : null),
    [workspace],
  )
  const usableInitialRoute =
    initialAppRoute?.view === 'builder' && !savedDeckState?.commander ? null : initialAppRoute
  const state = useControllerState(savedDeckState, usableInitialRoute, workspace)
  const actions = useAppActions(state)
  const builderData = buildBuilderData(state)
  const themed = state.showBuilder && state.commanderStyling
  return (
    <VisualPreferencesContext.Provider
      value={{
        darkMode: state.darkMode,
        setDarkMode: state.setDarkMode,
        commanderStyling: state.commanderStyling,
        setCommanderStyling: state.setCommanderStyling,
        cardReveals: state.cardReveals,
        setCardReveals: state.setCardReveals,
        cardEffects: state.cardEffects,
        setCardEffects: state.setCardEffects,
        previewScale: state.previewScale,
        setPreviewScale: state.setPreviewScale,
      }}
    >
      <div
        className={`${state.darkMode ? 'dark ' : ''}${themed ? 'commander-themed' : ''}`}
        style={
          {
            colorScheme: state.darkMode ? 'dark' : 'light',
            '--commander-accent': themed ? builderData.primaryTheme[0] : undefined,
            '--commander-highlight': themed ? builderData.secondaryTheme[1] : undefined,
            '--card-preview-scale': state.previewScale,
          } as CSSProperties
        }
      >
        <AppView state={state} actions={actions} builderData={builderData} />
      </div>
    </VisualPreferencesContext.Provider>
  )
}

export default App
