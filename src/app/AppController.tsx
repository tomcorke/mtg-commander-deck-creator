import '../App.css'

import type { CSSProperties } from 'react'
import { loadDeckState } from '../deck-state.ts'
import { AppView } from './AppView.tsx'
import { readAppRoute } from './routes.ts'
import { useAppActions } from './useAppActions.ts'
import { useControllerState } from './useControllerState.ts'
import { buildBuilderData } from './useBuilderData.ts'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'

const savedDeckState = loadDeckState()
const initialAppRoute = typeof window === 'undefined' ? null : readAppRoute()
const usableInitialRoute =
  initialAppRoute?.view === 'builder' && !savedDeckState?.commander ? null : initialAppRoute

function App() {
  const state = useControllerState(savedDeckState, usableInitialRoute)
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
