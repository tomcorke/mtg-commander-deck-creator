import { curveBucket, type AnalysisCard } from '../../deck-analysis.ts'

/** Names the commanders the curve counts, so an early bar is not mistaken for a deck card (#508). */
export function commanderCurveNote(commanders: AnalysisCard[]) {
  const values = commanders.filter((card) => curveBucket(card) !== null).map((c) => c.manaValue)
  if (!values.length) return ''
  if (commanders.length === 1) return `Includes your commander (mana value ${values[0]}).`
  if (values.length === 1) return `Includes one commander (mana value ${values[0]}).`
  return `Includes both commanders (mana values ${values[0]} and ${values[1]}).`
}
