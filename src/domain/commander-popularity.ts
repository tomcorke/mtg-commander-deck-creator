import type { EdhrecCommanderPage } from '../adapters/edhrec.ts'
import type { ScryfallCard } from './card-model.ts'

const colourOrder = 'WUBRG'

/**
 * EDHREC's commander list page for each colour identity, keyed by WUBRG-ordered colours.
 * Slugs from the identity links on https://json.edhrec.com/pages/commanders/colorless.json,
 * checked 2026-11-12. Each page lists that identity's top commanders (100; colourless 75)
 * with `num_decks`.
 */
const identitySlugs: Record<string, string> = {
  '': 'colorless',
  W: 'mono-white',
  U: 'mono-blue',
  B: 'mono-black',
  R: 'mono-red',
  G: 'mono-green',
  WU: 'azorius',
  UB: 'dimir',
  BR: 'rakdos',
  RG: 'gruul',
  WG: 'selesnya',
  WB: 'orzhov',
  UR: 'izzet',
  BG: 'golgari',
  WR: 'boros',
  UG: 'simic',
  WUB: 'esper',
  UBR: 'grixis',
  BRG: 'jund',
  WRG: 'naya',
  WUG: 'bant',
  WBG: 'abzan',
  WUR: 'jeskai',
  UBG: 'sultai',
  WBR: 'mardu',
  URG: 'temur',
  WUBR: 'yore-tiller',
  UBRG: 'glint-eye',
  WBRG: 'dune-brood',
  WURG: 'ink-treader',
  WUBG: 'witch-maw',
  WUBRG: 'five-color',
}

/** Every colour identity's list page slug. */
export const edhrecIdentitySlugs: readonly string[] = Object.values(identitySlugs)

/** The EDHREC commander list page for a colour identity. */
export function edhrecIdentitySlug(colours: readonly string[]) {
  const key = [...new Set(colours)]
    .filter((colour) => colourOrder.includes(colour))
    .sort((left, right) => colourOrder.indexOf(left) - colourOrder.indexOf(right))
    .join('')
  return identitySlugs[key]
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
