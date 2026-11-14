import { curveBucket, type AnalysisCard } from '../../deck-analysis.ts'

/** Nonland, non-commander main-deck spells needed before the sidebar offers land guidance. */
export const landGuidanceSpellGate = 10

/**
 * Which deck-target actions the sidebar offers (#328). The play-style step keeps none: role rows
 * are static bars, and land guidance waits for the step to close and for 10 spells, checked live.
 */
export function deckTargetActions({
  awaitingPlayStyle,
  deck,
  commanderCount,
}: {
  awaitingPlayStyle: boolean
  deck: readonly AnalysisCard[]
  commanderCount: number
}) {
  const spellCount = deck.slice(commanderCount).filter((card) => curveBucket(card) !== null).length
  return {
    roleFocus: !awaitingPlayStyle,
    landGuidance: !awaitingPlayStyle && spellCount >= landGuidanceSpellGate,
    spellCount,
  }
}

export const landGuidanceLaterNote = (spellCount: number) =>
  `Land guidance starts at ${landGuidanceSpellGate} spells (${spellCount} of ${landGuidanceSpellGate}).`
