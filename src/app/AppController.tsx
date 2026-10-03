import '../App.css'

import type { CSSProperties } from 'react'
import type { DeckWorkspace } from '../autosaves.ts'
import { AppView } from './AppView.tsx'
import { readAppRoute } from './routes.ts'
import { useAppActions } from './useAppActions.ts'
import { useControllerState } from './useControllerState.ts'
import { buildBuilderData } from './useBuilderData.ts'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'

const initialAppRoute = typeof window === 'undefined' ? null : readAppRoute()

function App({ workspace }: { workspace: DeckWorkspace }) {
  const savedDeckState = workspace.initialState
  const usableInitialRoute =
    initialAppRoute?.view === 'builder' && !savedDeckState?.commander ? null : initialAppRoute
  const state = useControllerState(savedDeckState, usableInitialRoute, workspace)
  const actions = useAppActions(state)
  const builderData = buildBuilderData(state)
  return (
    <VisualPreferencesContext.Provider
      value={{
        darkMode: state.darkMode,
        setDarkMode: state.setDarkMode,
        commanderStyling: state.commanderStyling,
        setCommanderStyling: state.setCommanderStyling,
        cardEffects: state.cardEffects,
        setCardEffects: state.setCardEffects,
      }}
    >
      <div
        className={`${state.darkMode ? 'dark ' : ''}${state.showBuilder && state.commanderStyling ? 'commander-themed' : ''}`}
        style={
          {
            colorScheme: state.darkMode ? 'dark' : 'light',
            '--commander-accent': state.showBuilder ? builderData.primaryTheme[0] : undefined,
            '--commander-highlight': state.showBuilder ? builderData.secondaryTheme[1] : undefined,
          } as CSSProperties
        }
      >
        <AppView state={state} actions={actions} builderData={builderData} />
      </div>
    </VisualPreferencesContext.Provider>
  )
}

export default App
