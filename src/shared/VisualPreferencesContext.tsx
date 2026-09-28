import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

export type VisualPreferences = {
  darkMode: boolean
  setDarkMode: Dispatch<SetStateAction<boolean>>
  commanderStyling: boolean
  setCommanderStyling: Dispatch<SetStateAction<boolean>>
  cardEffects: boolean
  setCardEffects: Dispatch<SetStateAction<boolean>>
}

export const VisualPreferencesContext = createContext<VisualPreferences | null>(null)

export function useVisualPreferences() {
  const preferences = useContext(VisualPreferencesContext)
  if (!preferences) throw new Error('VisualPreferencesContext is missing from the app tree.')
  return preferences
}
