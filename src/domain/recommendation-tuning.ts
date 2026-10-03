import { normalizeRecommendationStyle, type RecommendationStyle } from './recommendation-types.ts'

export const priorityLabels: Record<RecommendationStyle, string> = {
  thematic: 'Theme first',
  balanced: 'Balanced',
  competitive: 'Deck needs first',
  fun: 'Surprise me',
}

export const priorityHelp: Record<RecommendationStyle, string> = {
  thematic: 'Favors your themes and selected sets over popularity.',
  balanced: 'Balances theme, synergy, learned preferences, and missing deck roles.',
  competitive: 'Favors missing deck roles, mana fit, and commander evidence.',
  fun: 'Boosts interesting new picks and shows more of them together.',
}

// Keep the stored style names; fold the old health override into the nearest priority.
export function migrateRecommendationPriority(
  value: unknown,
  health?: boolean,
): RecommendationStyle {
  const style = normalizeRecommendationStyle(value)
  if (style === 'thematic' && health === true) return 'balanced'
  if (style === 'balanced' && health === false) return 'thematic'
  return style
}

export const ignoreReasons = [
  'Not my style',
  'Too expensive',
  'Off-theme',
  'Have something similar',
] as const
export type IgnoreReason = (typeof ignoreReasons)[number]

export function normalizeMaxPrice(value: unknown): number | null {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '')
    return null
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 ? price : null
}

export function withinPriceCap(card: { price?: string }, maxPrice?: number | null) {
  const price = card.price?.trim() ? Number(card.price) : NaN
  return maxPrice == null || !Number.isFinite(price) || price <= maxPrice
}

export function suggestedPriceCap(card: { price?: string }) {
  const price = card.price?.trim() ? Number(card.price) : NaN
  return Number.isFinite(price) && price >= 0 ? Math.max(1, Math.floor(price)) : null
}

export function focusedRecommendations<T>(
  queue: T[],
  focusedRole: string | null | undefined,
  cardRoles: (card: T) => string[],
) {
  return focusedRole ? queue.filter((card) => cardRoles(card).includes(focusedRole)) : queue
}
