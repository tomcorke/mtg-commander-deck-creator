import { useState } from 'react'
import { randomItems, selectableThemes } from '../domain/commander-catalog.ts'

export function useCommanderState() {
  const [search, setSearch] = useState('')
  // Start screen only: creature types after the first, which become sub-themes of a new deck.
  const [extraCreatureTypes, setExtraCreatureTypes] = useState<string[]>([])
  const [visibleThemes, setVisibleThemes] = useState(() => randomItems(selectableThemes, 6))
  const [colours, setColours] = useState<string[]>([])
  const [rulesText, setRulesText] = useState('')
  const [maxManaValue, setMaxManaValue] = useState<number | null>(null)
  const [commanderSets, setCommanderSets] = useState<string[]>([])
  return {
    rulesText,
    setRulesText,
    maxManaValue,
    setMaxManaValue,
    commanderSets,
    setCommanderSets,
    search,
    setSearch,
    extraCreatureTypes,
    setExtraCreatureTypes,
    visibleThemes,
    setVisibleThemes,
    colours,
    setColours,
  }
}
export type CommanderState = ReturnType<typeof useCommanderState>
