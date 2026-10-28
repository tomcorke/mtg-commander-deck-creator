import { rolesForCard, type AnalysisCard } from './deck-analysis.ts'

const combinations = (n: number, k: number): bigint => {
  if (k < 0 || k > n) return 0n
  let result = 1n
  for (let i = 1; i <= Math.min(k, n - k); i++) result = (result * BigInt(n - i + 1)) / BigInt(i)
  return result
}

/** Exact land-only baseline; assumptions and proof: docs/land-guidance-proposal-142.md. */
export function landDropProbability(size: number, lands: number, turn: number): number {
  if (
    !Number.isInteger(size) ||
    !Number.isInteger(lands) ||
    !Number.isInteger(turn) ||
    size < 8 ||
    lands < 0 ||
    lands > size ||
    turn < 1 ||
    turn + 7 > size
  )
    throw new RangeError('Invalid land-drop inputs')
  const seen = 7 + turn
  let favourable = 0n
  for (let k = turn; k <= Math.min(lands, seen); k++)
    favourable += combinations(lands, k) * combinations(size - lands, seen - k)
  return Number(favourable) / Number(combinations(size, seen))
}

/** Editorial likelihood bands, not deck-quality thresholds or target recommendations. */
export function landLikelihood(probability: number) {
  if (probability < 0.2) return 'Very unlikely'
  if (probability < 0.4) return 'Unlikely'
  if (probability < 0.6) return 'About even'
  if (probability < 0.8) return 'Likely'
  if (probability < 0.95) return 'Very likely'
  return 'Almost certain'
}

export function landDropContext(deck: AnalysisCard[], commanderCount: number) {
  const library = deck.slice(commanderCount)
  if (deck.length !== 100 || ![1, 2].includes(commanderCount))
    return { message: 'Provisional: complete the 100-card deck to calculate land-drop context.' }
  if (
    library.some(
      (card) =>
        card.dataStatus ||
        !card.typeLine ||
        (card.layout === 'modal_dfc' &&
          (card.faces.length !== 2 || card.faces.some((face) => !face.typeLine))),
    )
  )
    return { message: 'Land-drop context is unavailable until library card data is complete.' }
  const lands = library.filter((card) => rolesForCard(card).includes('lands')).length
  const optionalLands = library.filter(
    (card) =>
      card.layout === 'modal_dfc' &&
      card.faces.some((face) => face.typeLine.includes('Land')) &&
      card.faces.some((face) => !face.typeLine.includes('Land')),
  ).length
  return {
    size: library.length,
    lands,
    optionalLands,
    turns: [1, 2, 3, 4].map((turn) => ({
      turn,
      label: landLikelihood(landDropProbability(library.length, lands, turn)),
    })),
  }
}
