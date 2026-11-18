import type { Card, DeckCard } from '../../domain/card-model.ts'
import { hasTag } from '../../domain/creature-types.ts'
import { matchesCardType, rolesForCard, type TargetKey } from '../../deck-analysis.ts'
type DoctorCard = Card | DeckCard

/** Filters are `type:<Type>`, `role:<TargetKey>`, `tag:<Tag>`, or `all`. */
export function matchesCardFilter(card: DoctorCard, filter: string) {
  const [kind, value] = filter.split(/:(.*)/)
  if (kind === 'type') return matchesCardType(card, value)
  if (kind === 'role') return rolesForCard(card).includes(value as TargetKey)
  if (kind === 'tag') return hasTag(card, value)
  return true
}
