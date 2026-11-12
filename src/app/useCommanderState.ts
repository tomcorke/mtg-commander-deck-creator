import { useState } from 'react'
import type { ColourMatch } from '../domain/colour-identity.ts'

export function useCommanderState() {
  const [search, setSearch] = useState('')
  // Start screen only: creature types after the first, which become sub-themes of a new deck.
  const [extraCreatureTypes, setExtraCreatureTypes] = useState<string[]>([])
  const [colours, setColours] = useState<string[]>([])
  // Start screen only: how the chosen colours match a commander's identity (#482).
  const [colourMatch, setColourMatch] = useState<ColourMatch>('exactly')
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
    colours,
    setColours,
    colourMatch,
    setColourMatch,
  }
}
export type CommanderState = ReturnType<typeof useCommanderState>
