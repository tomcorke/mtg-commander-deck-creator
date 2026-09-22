import '../App.css'

import { loadDeckState } from '../deck-state.ts'
import { AppView } from './AppView.tsx'
import { readAppRoute } from './routes.ts'
import { useAppActions } from './useAppActions.ts'
import { useControllerState } from './useControllerState.ts'
import { buildBuilderData } from './useBuilderData.ts'

const savedDeckState = loadDeckState()
const initialAppRoute = typeof window === 'undefined' ? null : readAppRoute()
const usableInitialRoute =
  initialAppRoute?.view === 'builder' && !savedDeckState?.commander ? null : initialAppRoute

function App() {
  const state = useControllerState(savedDeckState, usableInitialRoute)
  const actions = useAppActions(state)
  const builderData = buildBuilderData(state)
  return <AppView state={state} actions={actions} builderData={builderData} />
}

export default App
