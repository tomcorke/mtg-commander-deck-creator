import { useEffect, useSyncExternalStore } from 'react'

import { appStorage } from '../app-storage.ts'
import { loadSavedDecks } from '../deck-state.ts'
import type { DeckWorkspace } from '../autosaves.ts'

export function useWorkspaceState(
  workspace: DeckWorkspace,
  setSavedDecks: (value: ReturnType<typeof loadSavedDecks>) => void,
) {
  const autosave = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot)
  useEffect(() => {
    const refresh = () => {
      void workspace.refresh()
      setSavedDecks(loadSavedDecks())
    }
    const unsubscribe = appStorage().onChange(refresh)
    window.addEventListener('focus', refresh)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', refresh)
    }
  }, [workspace, setSavedDecks])
  return { workspace, autosave }
}
