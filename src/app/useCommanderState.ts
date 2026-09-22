import { useState } from 'react'

import type { PersistedDeckState } from '../deck-state.ts'
import type { CommanderDetails } from '../domain/card-model.ts'
import {
  defaultCommanders,
  randomItems,
  randomThree,
  selectableThemes,
} from '../domain/commander-catalog.ts'

export function useCommanderState(saved: PersistedDeckState | null) {
  const [commander, setCommander] = useState(saved?.commander ?? '')
  const [commanderDetails, setCommanderDetails] = useState<CommanderDetails | null>(
    saved?.commanderDetails ?? null,
  )
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState(saved?.theme ?? '')
  const [visibleThemes, setVisibleThemes] = useState(() => randomItems(selectableThemes, 6))
  const [colours, setColours] = useState<string[]>([])
  const [matches, setMatches] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState(() => randomThree(defaultCommanders))
  const [suggestionPool, setSuggestionPool] = useState(defaultCommanders)
  const [commanderCosts, setCommanderCosts] = useState<Record<string, string>>({})
  const [commanderImages, setCommanderImages] = useState<Record<string, string[]>>({})
  const [commanderSubThemes, setCommanderSubThemes] = useState<string[]>(
    saved?.commanderSubThemes ?? [],
  )

  return {
    commander,
    setCommander,
    commanderDetails,
    setCommanderDetails,
    search,
    setSearch,
    theme,
    setTheme,
    visibleThemes,
    setVisibleThemes,
    colours,
    setColours,
    matches,
    setMatches,
    suggestions,
    setSuggestions,
    suggestionPool,
    setSuggestionPool,
    commanderCosts,
    setCommanderCosts,
    commanderImages,
    setCommanderImages,
    commanderSubThemes,
    setCommanderSubThemes,
  }
}

export type CommanderState = ReturnType<typeof useCommanderState>
