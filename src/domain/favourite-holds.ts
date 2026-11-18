import { exceedsDeckBudget } from './deck-price.ts'
import { cardScoreBreakdown, rankingEligible, waitsForManaSupport } from './recommendation-queue.ts'
import { isTopThemeFavourite, manaFitDetail, type ManaFitCause } from './recommendation-scoring.ts'
import { withinPriceCap } from './recommendation-tuning.ts'
import type { RecommendationScoreCard, RecommendationScoreContext } from './recommendation-types.ts'

/**
 * Why a majority-inclusion commander theme favourite is held back (#632). Each reason is the
 * same gate ranking applies: the mana-fit creature screen, the deck budget partition and the
 * per-card price cap.
 */
export type FavouriteHoldReason = 'mana-support' | 'deck-budget' | 'price-cap'

export type FavouriteHold<T> = {
  card: T
  /** Gates in the order ranking applies them; a card can wait for more than one. */
  reasons: FavouriteHoldReason[]
  /** Present for mana-support: the score penalty and its larger cause. */
  manaFit?: { penalty: number; cause: ManaFitCause }
}

type HoldCard = RecommendationScoreCard & { name: string; typeLine: string; price?: string }

/** The queue gates holding a card back: the mana-fit creature screen and the deck budget. */
function queuedHold<T extends HoldCard>(
  card: T,
  context: RecommendationScoreContext,
  cardRoles: (card: T) => string[],
): FavouriteHold<T>[] {
  const manaHeld = waitsForManaSupport(card, cardScoreBreakdown(card, context, cardRoles))
  const reasons: FavouriteHoldReason[] = [
    ...(manaHeld ? (['mana-support'] as const) : []),
    ...(exceedsDeckBudget(card, context.remainingBudget) ? (['deck-budget'] as const) : []),
  ]
  if (!reasons.length) return []
  return [
    {
      card,
      reasons,
      manaFit: manaHeld ? manaFitDetail(card, context.manaSupport) : undefined,
    },
  ]
}

/**
 * Commander theme favourites that ranking holds back under Theme first or Balanced, strongest
 * inclusion first. Only queued cards outside the visible batch, and price-capped pool cards the
 * other filters allow, are considered; cards already in the deck never are.
 */
export function themeFavouriteHolds<T extends HoldCard>({
  queue,
  shown,
  priceCapped = [],
  inDeck,
  context,
  cardRoles = () => [],
  limit = 3,
}: {
  queue: T[]
  /** Cards on screen now; they are not waiting. */
  shown: T[]
  /** Pool cards the price cap left out of the queue. */
  priceCapped?: T[]
  inDeck: Set<string>
  context: RecommendationScoreContext
  cardRoles?: (card: T) => string[]
  limit?: number
}): FavouriteHold<T>[] {
  const style = context.recommendationStyle ?? 'balanced'
  if (style !== 'thematic' && style !== 'balanced') return []
  const themes = [context.theme, ...context.activeSubThemes]
  const visible = new Set(shown.map(({ name }) => name))
  const favourite = (card: T) =>
    isTopThemeFavourite(card, themes) && !visible.has(card.name) && !inDeck.has(card.name)
  const queued = queue.filter(favourite)
  const names = new Set(queued.map(({ name }) => name))
  return [
    ...queued.flatMap((card) => queuedHold(card, context, cardRoles)),
    ...rankingEligible(priceCapped.filter(favourite), context)
      .filter((card) => !names.has(card.name) && !withinPriceCap(card, context.maxPrice))
      .map((card): FavouriteHold<T> => ({ card, reasons: ['price-cap'] })),
  ]
    .sort(
      (left, right) =>
        (right.card.inclusion ?? 0) - (left.card.inclusion ?? 0) ||
        left.card.name.localeCompare(right.card.name),
    )
    .slice(0, limit)
}
