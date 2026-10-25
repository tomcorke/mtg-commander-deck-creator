import { fetchScryfallCardsByIdentifiers, searchScryfallCached } from '../adapters/scryfall.ts'
import { themeCommanders, randomItems, themeSearchTerm } from './commander-catalog.ts'
import { creatureTypeForTheme, creatureTypeTags } from './creature-types.ts'
import { commanderConstructionError } from './commander-construction.ts'
import { toDeckCard, type ScryfallCard } from './card-model.ts'

export type DiscoveryFilters = {
  theme: string
  colours: string[]
  search: string
  /** More creature types after a creature-type theme; commanders matching any of them are found. */
  creatureTypes?: string[]
}
/** `coverage`: how many of several chosen creature types the commander is or mentions. */
export type CommanderSuggestion = { card: ScryfallCard; reason: string; coverage?: number }

const coveredTypes = (card: ScryfallCard, types: string[]) => {
  const tags = creatureTypeTags(
    [card.type_line, card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
      .filter(Boolean)
      .join('\n'),
  )
  return types.filter((type) => tags.includes(type))
}

// Heuristic curation from live Oracle/type review, 2026-10-04; see docs/a2-a9-first-use-investigation.md.
// These expand the old lists only where the bounded thematic-query trial failed relevance/coverage.
export const discoveryAdditions: Record<string, string[]> = {
  Tokens: [
    'Mondrak, Glory Dominus',
    'Adeline, Resplendent Cathar',
    "Trostani, Selesnya's Voice",
    'Maja, Bretagard Protector',
  ],
  '+1/+1 counters': ['Rishkar, Peema Renegade', 'Bristly Bill, Spine Sower'],
  Enchantments: ['Pearl-Ear, Imperial Advisor', 'Sram, Senior Edificer'],
  Graveyard: ['Six', 'Emry, Lurker of the Loch'],
  Dragons: ['Ganax, Astral Hunter', 'Old Gnawbone'],
  Spellslinger: ['Talrand, Sky Summoner', 'Ashling, Flame Dancer'],
  Artifacts: ['Emry, Lurker of the Loch', 'Sai, Master Thopterist'],
  Lifegain: ['Vito, Thorn of the Dusk Rose', 'Dina, Soul Steeper'],
  Sacrifice: ['Yawgmoth, Thran Physician', 'Yahenni, Undying Partisan'],
  'Group hug': ['Kami of the Crescent Moon', 'Selvala, Explorer Returned'],
  Voltron: ['Halvar, God of Battle // Sword of the Realms', 'Sram, Senior Edificer'],
  'Big mana': ['Neheb, the Eternal', 'Urza, Lord High Artificer'],
  Blink: ['Thassa, Deep-Dwelling', 'Emiel the Blessed'],
  ETB: ['Thassa, Deep-Dwelling', 'Emiel the Blessed'],
  'Death triggers': ['Syr Konrad, the Grim', 'Elenda, the Dusk Rose'],
  Wither: ['The Reaper, King No More', 'Auntie Ool, Cursewretch'],
  Political: ['Gluntch, the Bestower', 'Selvala, Explorer Returned'],
  Vampires: ['Vito, Thorn of the Dusk Rose', 'Yahenni, Undying Partisan'],
  Angels: ['Lyra Dawnbringer', 'Avacyn, Angel of Hope'],
  Demons: ['Kardur, Doomscourge', 'Valgavoth, Harrower of Souls'],
  Faeries: ['Oona, Queen of the Fae', 'Maralen, Fae Ascendant'],
  Vehicles: ['Sram, Senior Edificer', 'Cid, Freeflier Pilot'],
  Indestructible: ['Heliod, Sun-Crowned', 'Xenagos, God of Revels'],
  Mill: ['The Mindskinner', 'Syr Konrad, the Grim'],
  Zombies: ['Zul Ashur, Lich Lord', 'Ratadrabik of Urborg'],
  Elves: ['Rishkar, Peema Renegade', 'Arwen, Weaver of Hope'],
  Goblins: ['General Kreat, the Boltbringer', 'Pashalik Mons'],
  Dinosaurs: ['Etali, Primal Storm', 'Ghalta, Primal Hunger'],
  Merfolk: ['Thrasios, Triton Hero', 'Vorel of the Hull Clade'],
  Knights: [
    'Adeline, Resplendent Cathar',
    "Dion, Bahamut's Dominant // Bahamut, Warden of Light",
    'Danitha Capashen, Paragon',
  ],
  Spirits: ['Kodama of the East Tree', 'Brago, King Eternal'],
  Slivers: ['Sliver Queen'],
}

// Heuristic query relevance passed the live top-12 review for these three themes.
// Other broad queries matched removal, prevention, back faces, or unrelated recursion.
export const discoveryQueries: Record<string, string> = {
  Equipment: 'o:equipment',
  Landfall: 'o:landfall',
  Goad: 'o:goad',
}

export function discoveryNames(theme: string) {
  return [...new Set([...(themeCommanders[theme] ?? []), ...(discoveryAdditions[theme] ?? [])])]
}

export function filterCommanders(cards: ScryfallCard[], filters: DiscoveryFilters) {
  const identity = [...filters.colours].sort().join('')
  const search = filters.search.trim().toLowerCase()
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = card.oracle_id ?? card.name
    if (seen.has(key) || commanderConstructionError([toDeckCard(card)])) return false
    if (identity && [...card.color_identity].sort().join('') !== identity) return false
    if (search.length >= 2 && !card.name.toLowerCase().includes(search)) return false
    seen.add(key)
    return true
  })
}

/**
 * The Scryfall search for a theme, or undefined to use its curated list. Creature types without a
 * curated list search for commanders of, or referring to, that type; several types search for any.
 */
function discoveryTerm(theme: string, types: string[]) {
  if (types.length > 1) return types.map((type) => `(${themeSearchTerm(type)})`).join(' or ')
  if (discoveryQueries[theme]) return discoveryQueries[theme]
  return discoveryNames(theme).length || !creatureTypeForTheme(theme)
    ? undefined
    : themeSearchTerm(theme)
}

export async function discoverCommanders(
  filters: DiscoveryFilters,
  signal?: AbortSignal,
  providers = { search: searchScryfallCached, hydrate: fetchScryfallCardsByIdentifiers },
): Promise<CommanderSuggestion[]> {
  const types = creatureTypeForTheme(filters.theme)
    ? [filters.theme, ...(filters.creatureTypes ?? [])]
    : []
  const term = discoveryTerm(filters.theme, types)
  const curated = filters.theme && !term
  const identity = filters.colours.length
    ? `id=${[...filters.colours].sort().join('').toLowerCase()}`
    : ''
  const name =
    filters.search.trim().length >= 2 ? `name:${JSON.stringify(filters.search.trim())}` : ''
  const cards = curated
    ? await providers.hydrate(
        discoveryNames(filters.theme).map((name) => ({ name })),
        fetch,
        signal,
      )
    : await providers.search(
        `is:commander legal:commander date<=today ${identity} ${name} ${term ? `(${term})` : ''}`.trim(),
        fetch,
        signal,
        'edhrec',
      )
  signal?.throwIfAborted()
  const reason = curated
    ? `Picked for ${filters.theme} decks`
    : term && creatureTypeForTheme(filters.theme)
      ? `${filters.theme}, or commanders whose rules text mentions them`
      : term
        ? `Commanders whose rules text mentions ${filters.theme}`
        : ''
  const commanders = filterCommanders(cards, filters)
  if (types.length < 2) return commanders.map((card) => ({ card, reason }))
  return commanders.map((card) => {
    const covered = coveredTypes(card, types)
    return {
      card,
      reason: covered.length ? `Covers ${covered.join(' and ')}` : reason,
      coverage: covered.length,
    }
  })
}

/** Twelve at random, keeping commanders that cover more of the chosen creature types first. */
export function shuffleCommanders(cards: CommanderSuggestion[]) {
  return randomItems(cards, cards.length)
    .sort((left, right) => (right.coverage ?? 0) - (left.coverage ?? 0))
    .slice(0, 12)
}
