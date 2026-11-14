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
 * the pool in its given order, so the first queued card wins over a Later one. Lands are left out:
 * the generic mark is about spells that could carry the theme.
 */
export function findThemeAlternative(
  offer: Card,
  themes: string[],
  pool: { card: Card; source: AlternativeSource }[],
): ThemeAlternative | null {
  const roles = rolesForCard(offer).filter((role) => role !== 'lands')
  // Only a generic pick gets one: a theme-matching offer is already on theme.
  if (!themes.length || !roles.length || themes.some((theme) => hasTag(offer, theme))) return null
  for (const role of roles)
    for (const { card, source } of pool) {
      if (card.name === offer.name || !rolesForCard(card).includes(role)) continue
      const matched = themes.filter((theme) => hasTag(card, theme))
      if (matched.length) return { card, role, themes: matched, source }
    }
  return null
}
