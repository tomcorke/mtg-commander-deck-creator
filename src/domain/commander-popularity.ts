import type { EdhrecCommanderPage } from '../adapters/edhrec.ts'
import type { ScryfallCard } from './card-model.ts'
import { identityKey, identitySlugs } from './colour-identity.ts'

/** Every colour identity's list page slug. */
export const edhrecIdentitySlugs: readonly string[] = Object.values(identitySlugs)

/** The EDHREC commander list page for a colour identity. */
export function edhrecIdentitySlug(colours: readonly string[]) {
  return identitySlugs[identityKey(colours)]
}

/** Lower-cased commander name → EDHREC deck count, from one identity list page. */
export function edhrecDeckCounts(page: EdhrecCommanderPage) {
  const counts = new Map<string, number>()
  for (const list of page.container.json_dict.cardlists)
    for (const view of list.cardviews)
      if (view.num_decks !== undefined && view.num_decks > 0)
        counts.set(view.name.toLowerCase(), view.num_decks)
  return counts
}

/** A commander's count by its full name or, for double-faced cards, its front face. */
export function deckCountFor(counts: ReadonlyMap<string, number> | undefined, card: ScryfallCard) {
  const name = card.name.toLowerCase()
  return counts?.get(name) ?? counts?.get(name.split(' // ')[0])
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** "≈12k decks on EDHREC"; counts under 1,000 stay exact. */
export function deckCountLabel(count: number) {
  const decks = count === 1 ? 'deck' : 'decks'
  return count < 1000
    ? `${count} ${decks} on EDHREC`
    : `≈${compact.format(count).toLowerCase()} decks on EDHREC`
}
