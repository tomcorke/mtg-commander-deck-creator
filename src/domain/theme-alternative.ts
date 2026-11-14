import { rolesForCard, type TargetKey } from '../deck-analysis.ts'
import type { Card } from './card-model.ts'
import { hasTag } from './creature-types.ts'

export type AlternativeSource = 'queue' | 'later'

export type ThemeAlternative = {
  card: Card
  /** The offer's detected role the alternative shares. Never `lands`. */
  role: Exclude<TargetKey, 'lands'>
  /** Selected themes the alternative's tags match, in selection order. */
  themes: string[]
  source: AlternativeSource
}

/**
 * An on-theme card that shares a generic pick's detected role (#563), from the queue or the Later
 * list. Roles and theme tags are both text heuristics, so a match says the detectors agree, not that
 * the two cards do the same job equally well. The offer's roles are tried in detection order, and
 * the pool in its given order, so the first queued card wins over a Later one. Land cards are left
 * out on both sides, even when they also read as ramp or draw: the swap is between spells.
 */
export function findThemeAlternative(
  offer: Card,
  themes: string[],
  pool: { card: Card; source: AlternativeSource }[],
): ThemeAlternative | null {
  const offerRoles = rolesForCard(offer)
  // Only a nonland generic pick gets one: a theme-matching offer is already on theme.
  if (
    !themes.length ||
    offerRoles.includes('lands') ||
    themes.some((theme) => hasTag(offer, theme))
  )
    return null
  const roles = offerRoles as ThemeAlternative['role'][]
  for (const role of roles)
    for (const { card, source } of pool) {
      const cardRoles = rolesForCard(card)
      // A land that also reads as ramp or draw would swap a spell for a land slot.
      if (card.name === offer.name || cardRoles.includes('lands') || !cardRoles.includes(role))
        continue
      const matched = themes.filter((theme) => hasTag(card, theme))
      if (matched.length) return { card, role, themes: matched, source }
    }
  return null
}
