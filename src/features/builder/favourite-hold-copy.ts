import { cardPrice, formatUsd } from '../../domain/deck-price.ts'
import type { FavouriteHold, FavouriteHoldReason } from '../../domain/favourite-holds.ts'
import {
  recommendationScoreFactorMaximums,
  type ManaSupport,
} from '../../domain/recommendation-types.ts'

export const favouriteHoldLabels: Record<FavouriteHoldReason, string> = {
  'mana-support': 'Waits for mana',
  'deck-budget': 'Over deck budget',
  'price-cap': 'Over price limit',
}

export type FavouriteHoldFacts = {
  manaSupport?: ManaSupport
  remainingBudget?: number | null
  maxPrice?: number | null
}

/**
 * One sentence per gate, quoting the numbers ranking used: the mana-fit penalty and the deck's
 * sources, the budget left, or the price limit. Never a verdict on the card itself.
 */
export function favouriteHoldSentences(
  { card, reasons, manaFit }: FavouriteHold<{ price?: string; manaValue?: number }>,
  { manaSupport, remainingBudget, maxPrice }: FavouriteHoldFacts,
) {
  const price = cardPrice(card)
  return reasons.map((reason) => {
    if (reason === 'mana-support') {
      const penalty = `Mana-fit penalty ${manaFit?.penalty ?? 0} / ${recommendationScoreFactorMaximums.manaFitPenalty}`
      const support =
        manaFit?.cause === 'colours' || !manaSupport
          ? 'the deck has few sources of its colours so far'
          : `mana value ${card.manaValue ?? 0} against ${manaSupport.landCount + manaSupport.rampCount} of ${manaSupport.landTarget + manaSupport.rampTarget} land and ramp sources so far`
      return `${penalty}: ${support}. Creatures this far behind stay out of early batches.`
    }
    const cost = price === null ? 'It' : formatUsd(price)
    if (reason === 'deck-budget')
      return remainingBudget != null && remainingBudget > 0
        ? `${cost} is more than the ${formatUsd(remainingBudget)} left in your deck budget, so it queues after cards that fit.`
        : `Your deck budget is spent, so ${price === null ? 'it' : `its ${formatUsd(price)}`} queues after cards that fit.`
    return maxPrice == null
      ? `${cost} is above your price limit, so recommendations leave it out.`
      : `${cost} is above your ${formatUsd(maxPrice)} price limit, so recommendations leave it out.`
  })
}
