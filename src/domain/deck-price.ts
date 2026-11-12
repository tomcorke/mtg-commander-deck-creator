// Provider data: Scryfall syncs USD prices from TCGplayer's market price every 24 hours
// (scryfall.com/docs/faqs/where-do-scryfall-prices-come-from-7, checked 2026-11-12).
// Each deck card's price is its chosen printing and finish (see withBuilderPrinting).
export const priceSourceNote =
  'Prices are TCGplayer market estimates via Scryfall, for each chosen printing and finish. They change daily.'

export type DeckPriceTotal = { total: number; priced: number; unpriced: number }

/** A card's displayed US dollar price, or null when Scryfall has none (unknown, not zero). */
export function cardPrice(card: { price?: string }): number | null {
  const price = card.price?.trim() ? Number(card.price) : NaN
  return Number.isFinite(price) && price >= 0 ? price : null
}

/** Sum each card entry once, in whole cents so totals match the displayed prices. */
export function deckPriceTotal(cards: { price?: string }[]): DeckPriceTotal {
  let cents = 0
  let priced = 0
  for (const card of cards) {
    const price = cardPrice(card)
    if (price === null) continue
    cents += Math.round(price * 100)
    priced += 1
  }
  return { total: cents / 100, priced, unpriced: cards.length - priced }
}

export const formatUsd = (amount: number) =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** "$123.45", with the unpriced count when any card lacks a price. */
export function describeDeckPrice({ total, unpriced }: DeckPriceTotal) {
  return unpriced
    ? `${formatUsd(total)} · ${unpriced} card${unpriced === 1 ? '' : 's'} unpriced`
    : formatUsd(total)
}

/** Budget left after the main deck's priced cards; negative when over. Null without a budget. */
export function remainingDeckBudget(
  budget: number | null | undefined,
  deck: { price?: string }[],
): number | null {
  return budget == null ? null : Math.round((budget - deckPriceTotal(deck).total) * 100) / 100
}

/** True when adding the card would take the deck past its budget. Unpriced and free cards never do. */
export function exceedsDeckBudget(card: { price?: string }, remaining: number | null | undefined) {
  const price = cardPrice(card)
  return remaining != null && price !== null && price > 0 && price > remaining
}

export function describeRemainingBudget(budget: number, remaining: number) {
  return remaining < 0
    ? `${formatUsd(-remaining)} over ${formatUsd(budget)} budget`
    : `${formatUsd(remaining)} left of ${formatUsd(budget)} budget`
}
